import { ApiError } from "../api-error.ts";
import { supabaseRest, supabaseRpc, encodeFilter } from "../supabase-rest.ts";
import { canonicalUrl, classifyDuplicate, contentHash, extractDiscovery, reviewReason, type CrawlRecord, type TenderCandidate } from "./core.ts";

type Source = { id: string; name: string; organisation: string; base_url: string; country_code: string; trust_level: string; discovery_enabled: boolean; crawl_start_url: string | null; crawl_include_patterns: string[]; crawl_exclude_patterns: string[]; crawl_max_pages: number; crawl_depth: number; crawl_requires_rendering: boolean; crawl_consecutive_failures: number };
type Job = { id: string; source_id: string; cloudflare_job_id: string | null; status: string; started_at: string };
type Discovery = { id: string; source_id: string; canonical_url: string; content_hash: string; processing_status: string; extracted_data: Record<string, unknown>; duplicate_status: string; matched_tender_id: string | null };

function cloudflareConfig() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_BROWSER_TOKEN;
  if (!account || !token) throw new ApiError(503, "Cloudflare discovery credentials are not configured.", "discovery_not_configured");
  return { account, token };
}

async function cloudflareRequest(path: string, method = "GET", body?: unknown) {
  const { account, token } = cloudflareConfig();
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/browser-rendering/crawl${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json() as { success: boolean; result?: unknown; errors?: Array<{ message?: string }> };
  if (!response.ok || !payload.success) throw new Error(`Cloudflare crawl request failed (${response.status}): ${payload.errors?.[0]?.message || "unknown error"}`);
  return payload.result;
}

function sameHost(url: string, source: Source) {
  try { const item = new URL(url); const base = new URL(source.base_url); return item.protocol === "https:" && item.hostname === base.hostname; }
  catch { return false; }
}

function matchesPatterns(url: string, source: Source) {
  if (!sameHost(url, source)) return false;
  if (source.crawl_exclude_patterns.some(pattern => url.includes(pattern))) return false;
  return !source.crawl_include_patterns.length || source.crawl_include_patterns.some(pattern => url.includes(pattern));
}

async function sourceById(id: string) {
  const { data } = await supabaseRest<Source[]>(`procurement_sources?select=*&id=eq.${encodeFilter(id)}&limit=1`);
  if (!data[0]) throw new ApiError(404, "Discovery source not found.");
  return data[0];
}

async function failJob(job: Job, reason: string) {
  const now = new Date().toISOString();
  await supabaseRest(`discovery_crawl_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "failed", completed_at: now, error_message: reason.slice(0, 500) }) });
  const source = await sourceById(job.source_id);
  const failures = source.crawl_consecutive_failures + 1;
  const backoffHours = Math.min(168, 2 ** failures);
  await supabaseRest(`procurement_sources?id=eq.${source.id}`, { method: "PATCH", body: JSON.stringify({ crawl_last_failure_at: now, crawl_consecutive_failures: failures, crawl_next_at: new Date(Date.now() + backoffHours * 3_600_000).toISOString() }) });
}

export async function startDueCrawl(sourceId?: string) {
  cloudflareConfig();
  const { data: claims } = await supabaseRpc<Array<{ job_id: string; source_id: string }>>("claim_discovery_crawl", { p_source_id: sourceId || null });
  const claim = claims[0];
  if (!claim) return { started: false as const };
  const source = await sourceById(claim.source_id);
  const job: Job = { id: claim.job_id, source_id: claim.source_id, cloudflare_job_id: null, status: "reserved", started_at: new Date().toISOString() };
  try {
    const startUrl = source.crawl_start_url || source.base_url;
    if (!sameHost(startUrl, source)) throw new Error("Crawl start URL must be HTTPS and on the source host.");
    const result = await cloudflareRequest("", "POST", {
      url: startUrl, limit: Math.min(100, Math.max(1, source.crawl_max_pages)),
      depth: Math.min(3, Math.max(0, source.crawl_depth)), render: source.crawl_requires_rendering,
      formats: ["markdown"], crawlPurposes: ["search"], contentUse: "reference",
    });
    if (typeof result !== "string" || !result) throw new Error("Cloudflare did not return a crawl job ID.");
    await supabaseRest(`discovery_crawl_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ cloudflare_job_id: result, status: "running" }) });
    return { started: true as const, jobId: job.id, sourceId: source.id };
  } catch (error) {
    await failJob(job, error instanceof Error ? error.message : "Crawl could not start.");
    throw error;
  }
}

async function candidatesFor(record: ReturnType<typeof extractDiscovery>, url: string): Promise<TenderCandidate[]> {
  const clauses = [`official_source_url.eq.${encodeFilter(url)}`];
  if (record.reference) clauses.push(`external_reference.eq.${encodeFilter(record.reference)}`);
  const { data: exact } = await supabaseRest<TenderCandidate[]>(`procurement_opportunities?select=id,title,buyer_name,external_reference,official_source_url,deadline_at,description,category&or=(${clauses.join(",")})&limit=50`);
  const { data: recent } = await supabaseRest<TenderCandidate[]>("procurement_opportunities?select=id,title,buyer_name,external_reference,official_source_url,deadline_at,description,category&order=created_at.desc&limit=500");
  return [...new Map([...exact, ...recent].map(row => [row.id, row])).values()];
}

export async function processCrawlRecord(source: Source, job: Job, record: CrawlRecord) {
  if (record.status !== "completed" || !matchesPatterns(record.url, source)) return { skipped: true, reason: "blocked_or_out_of_scope" };
  const url = canonicalUrl(record.url);
  const hash = contentHash(record);
  const { data: existing } = await supabaseRest<Discovery[]>(`opportunity_discoveries?select=id,source_id,canonical_url,content_hash,processing_status,extracted_data,duplicate_status,matched_tender_id&source_id=eq.${source.id}&canonical_url=eq.${encodeFilter(url)}&limit=1`);
  const now = new Date().toISOString();
  if (existing[0]?.content_hash === hash && existing[0].processing_status !== "discovered") {
    await supabaseRest(`opportunity_discoveries?id=eq.${existing[0].id}`, { method: "PATCH", body: JSON.stringify({ last_seen_at: now, last_checked_at: now, crawl_job_id: job.id }) });
    return { skipped: true, reason: "unchanged" };
  }
  const { data: settings } = await supabaseRest<Array<{ auto_publish: boolean; max_extractions_per_day: number }>>("discovery_settings?select=auto_publish,max_extractions_per_day&singleton_key=eq.default&limit=1");
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const { response: extractionCount } = await supabaseRest<Array<{ id: string }>>(`opportunity_discoveries?select=id&extracted_at=gte.${dayStart.toISOString()}&limit=1`, { count: "exact" });
  const used = Number(extractionCount.headers.get("content-range")?.split("/")[1] || 0);
  if (used >= (settings[0]?.max_extractions_per_day ?? 0)) {
    await supabaseRest("opportunity_discoveries?on_conflict=source_id,canonical_url", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ source_id: source.id, crawl_job_id: job.id, source_url: record.url, canonical_url: url, content_hash: hash, raw_text: (record.markdown || record.html || "").slice(0, 100_000), processing_status: "discovered", last_seen_at: now, last_checked_at: now, error_message: "Daily extraction cap reached; retry on next crawl." }) });
    return { skipped: true, reason: "extraction_cap" };
  }
  const extracted = extractDiscovery(record);
  const candidates = await candidatesFor(extracted, url);
  const duplicate = classifyDuplicate(extracted, url, candidates);
  const qualityIssue = reviewReason(extracted);
  const status = qualityIssue?.includes("expired") ? "expired" : "needs_review";
  const payload = {
    source_id: source.id, crawl_job_id: job.id, source_url: record.url, canonical_url: url,
    source_reference: extracted.reference, content_hash: hash, raw_title: extracted.title,
    raw_text: (record.markdown || record.html || "").slice(0, 100_000), raw_metadata: record.metadata || {},
    extracted_data: extracted, extracted_at: now, last_seen_at: now, last_checked_at: now,
    processing_status: status, duplicate_status: duplicate.status, matched_tender_id: duplicate.matchId,
    confidence_score: extracted.confidence, duplicate_score: duplicate.score, error_message: qualityIssue,
    updated_at: now, reviewed_by: null, reviewed_at: null,
  };
  const { data: saved } = await supabaseRest<Array<{ id: string }>>("opportunity_discoveries?on_conflict=source_id,canonical_url", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(payload),
  });
  if (!existing[0] && saved[0] && settings[0]?.auto_publish && !qualityIssue && extracted.confidence >= 0.89 && duplicate.status === "unique" && ["OFFICIAL", "VERIFIED_OFFICIAL"].includes(source.trust_level)) {
    try { const { reviewDiscovery } = await import("./review.ts"); await reviewDiscovery(saved[0].id, "approve", null); }
    catch { /* Remains in admin review; automation must never conceal a publication error. */ }
  }
  return { skipped: false, status, duplicateStatus: duplicate.status };
}

export async function pollCrawlJobs() {
  cloudflareConfig();
  const { data: jobs } = await supabaseRest<Job[]>("discovery_crawl_jobs?select=*&status=eq.running&order=started_at.asc&limit=2");
  const outcomes = [];
  for (const job of jobs) {
    try {
      if (!job.cloudflare_job_id) throw new Error("Crawl job ID is missing.");
      const result = await cloudflareRequest(`/${encodeURIComponent(job.cloudflare_job_id)}?limit=1`) as { status: string };
      if (result.status === "running") { outcomes.push({ jobId: job.id, status: "running" }); continue; }
      if (result.status !== "completed") throw new Error(`Cloudflare crawl ended: ${result.status}`);
      const source = await sourceById(job.source_id);
      let cursor: string | number | undefined;
      let examined = 0; let found = 0;
      do {
        const page = await cloudflareRequest(`/${encodeURIComponent(job.cloudflare_job_id)}?limit=20${cursor === undefined ? "" : `&cursor=${encodeURIComponent(String(cursor))}`}`) as { records?: CrawlRecord[]; cursor?: string | number };
        for (const record of page.records || []) {
          if (examined >= source.crawl_max_pages) break;
          examined++;
          const outcome = await processCrawlRecord(source, job, record);
          if (!outcome.skipped) found++;
        }
        cursor = examined >= source.crawl_max_pages ? undefined : page.cursor;
      } while (cursor !== undefined);
      const now = new Date().toISOString();
      await supabaseRest(`discovery_crawl_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "completed", completed_at: now, pages_examined: examined, discoveries_found: found }) });
      await supabaseRest(`procurement_sources?id=eq.${source.id}`, { method: "PATCH", body: JSON.stringify({ crawl_last_success_at: now, crawl_consecutive_failures: 0 }) });
      outcomes.push({ jobId: job.id, status: "completed", pages: examined, discoveries: found });
    } catch (error) {
      await failJob(job, error instanceof Error ? error.message : "Unknown crawl error.");
      outcomes.push({ jobId: job.id, status: "failed" });
    }
  }
  return outcomes;
}

export async function discoveryTick() {
  const polled = await pollCrawlJobs();
  const started = await startDueCrawl();
  return { polled, started };
}
