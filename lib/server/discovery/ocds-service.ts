import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { ApiError } from "../api-error.ts";
import { canPublish, type SourceRights } from "./rights.ts";
import { ingestNormalizedRecords } from "../procurement/ingestion.ts";
import type { ProcurementSource } from "../procurement/types.ts";
import { supabaseRest } from "../supabase-rest.ts";
import { classifyOcds, extractReleases, GHANEPS_DATASET_URL, GHANEPS_REGISTRY_URL, latestReleases, ocdsToHistory, ocdsToOpportunity } from "./ocds.ts";

type GhanepsSource = ProcurementSource & SourceRights & { ocds_paused: boolean; ocds_limited_passed: boolean; ocds_import_cursor: number; ocds_dataset_etag: string | null; ocds_dataset_last_modified: string | null; ocds_last_sync_at: string | null };
type Mode = "check" | "dry_run" | "limited" | "full";
const registryHost = "data.open-contracting.org";
const downloadHost = "fastly.data.open-contracting.org";
const sourceQuery = "procurement_sources?select=*&slug=eq.ghaneps&limit=1";
const safeError = (error: unknown) => error instanceof Error ? error.message.slice(0, 250) : "Unknown OCDS error";

async function source() {
  const { data } = await supabaseRest<GhanepsSource[]>(sourceQuery);
  if (!data[0]) throw new ApiError(503, "GHANEPS source has not been configured.");
  return data[0];
}

async function registryFetch(method: "GET" | "HEAD") {
  let next = GHANEPS_DATASET_URL;
  for (let attempt = 0; attempt < 4; attempt++) {
    const target = new URL(next);
    if (target.protocol !== "https:" || ![registryHost, downloadHost].includes(target.hostname)) throw new ApiError(502, "Registry redirected outside its trusted download hosts.");
    const response = await fetch(target, { method, cache: "no-store", signal: AbortSignal.timeout(90_000), redirect: "manual" });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new ApiError(502, "Registry redirect is missing a destination.");
      next = new URL(location, target).href;
      continue;
    }
    if (!response.ok) throw new ApiError(502, "Trusted GHANEPS registry download is unavailable.");
    return response;
  }
  throw new ApiError(502, "Too many registry redirects.");
}

export async function ghanepsOcdsStatus() {
  const s = await source();
  const [{ data: runs }, { data: stats }, { data: insights }] = await Promise.all([
    supabaseRest("source_sync_runs?select=id,started_at,completed_at,status,mode,dataset_hash,dataset_etag,records_fetched,unique_ocids,active_count,closed_count,awarded_count,contract_count,inserted_count,updated_count,unchanged_count,duplicate_count,failed_count,no_change,error_summary&source_id=eq." + s.id + "&mode=not.is.null&order=started_at.desc&limit=20"),
    supabaseRest<Array<{ processes: number; awards: number; contracts: number; current_open: number }>>("rpc/ocds_source_stats", { method: "POST", body: JSON.stringify({ p_source_id: s.id }) }),
    supabaseRest<{ buyers: unknown[]; categories: unknown[]; suppliers: unknown[] }>("rpc/ocds_intelligence_summary", { method: "POST", body: JSON.stringify({ p_source_id: s.id }) }),
  ]);
  return { source: { id: s.id, name: s.name, registryUrl: GHANEPS_REGISTRY_URL, rights: s.reuse_status, metadataReuse: s.metadata_reuse_allowed, commercialReuse: s.commercial_reuse_allowed, documentReuse: s.document_reuse_allowed, paused: s.ocds_paused, limitedPassed: s.ocds_limited_passed, importCursor: s.ocds_import_cursor, lastSync: s.ocds_last_sync_at, etag: s.ocds_dataset_etag, lastModified: s.ocds_dataset_last_modified, configuration: s.configuration }, runs, stats: stats[0] || null, insights };
}

export async function setGhanepsOcdsPaused(paused: boolean, actorUserId: string) {
  const s = await source();
  if (!paused && (!canPublish(s) || !s.commercial_reuse_allowed)) throw new ApiError(409, "Complete the source-rights review before enabling monthly imports.");
  await supabaseRest(`procurement_sources?id=eq.${s.id}`, { method: "PATCH", body: JSON.stringify({ ocds_paused: paused }) });
  await supabaseRest("audit_log", { method: "POST", body: JSON.stringify({ actor_user_id: actorUserId, action: "ghaneps.ocds.pause", entity_type: "procurement_source", entity_id: s.id, metadata: { paused } }) });
  return { paused };
}

export async function runGhanepsOcds(mode: Mode, actorUserId?: string, scheduled = false) {
  const s = await source();
  if (scheduled && (s.ocds_paused || !canPublish(s) || !s.commercial_reuse_allowed)) return { mode, skipped: true, reason: "rights review or unpause pending" };
  if (mode === "limited" || mode === "full") {
    if (s.ocds_paused || !canPublish(s) || !s.commercial_reuse_allowed || !s.metadata_reuse_allowed) throw new ApiError(409, "GHANEPS OCDS publication is blocked until its licence and commercial metadata-reuse scope are verified.");
  }
  const head = await registryFetch("HEAD");
  const etag = head.headers.get("etag");
  const modified = head.headers.get("last-modified");
  const unchanged = Boolean(mode !== "dry_run" && s.ocds_last_sync_at && etag && etag === s.ocds_dataset_etag && modified === s.ocds_dataset_last_modified && s.ocds_import_cursor === 0);
  if (mode === "check") return { mode, changed: !unchanged, etag, lastModified: modified, contentLength: Number(head.headers.get("content-length") || 0), registryUrl: GHANEPS_REGISTRY_URL };
  if (scheduled && unchanged) {
    const { data: created } = await supabaseRest<Array<{ id: string }>>("source_sync_runs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ source_id: s.id, mode, triggered_by: "schedule", dataset_etag: etag, dataset_last_modified: modified, status: "SUCCEEDED", no_change: true, completed_at: new Date().toISOString() }) });
    return { mode, skipped: true, reason: "unchanged dataset", runId: created[0]?.id };
  }

  const { data: created } = await supabaseRest<Array<{ id: string }>>("source_sync_runs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ source_id: s.id, mode, triggered_by: actorUserId ? "admin" : "schedule", actor_user_id: actorUserId || null, dataset_etag: etag, dataset_last_modified: modified, status: "RUNNING" }) });
  const runId = created[0]?.id;
  if (!runId) throw new ApiError(503, "Could not create OCDS audit run.");
  const counts = { recordsRead: 0, uniqueOcids: 0, active: 0, closed: 0, awarded: 0, contracts: 0, malformed: 0, duplicateReleases: 0, possibleDuplicates: 0, unchanged: 0, inserted: 0, updated: 0, duplicates: 0, rejected: 0, errors: 0 };
  let nextCursor: number | null = null;
  const grouped = new Map<string, ReturnType<typeof extractReleases>>();
  const hash = createHash("sha256");
  try {
    const response = await registryFetch("GET");
    if (!response.body) throw new Error("Registry response has no body");
    const stream = Readable.fromWeb(response.body as never);
    stream.on("data", chunk => hash.update(chunk));
    const lines = createInterface({ input: stream.pipe(createGunzip()), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      counts.recordsRead++;
      try {
        const releases = extractReleases(JSON.parse(line));
        if (!releases.length) { counts.malformed++; continue; }
        for (const release of releases) grouped.set(release.ocid, [...(grouped.get(release.ocid) || []), release]);
      } catch { counts.malformed++; }
    }
    counts.uniqueOcids = grouped.size;
    const eligible = [];
    for (const releases of grouped.values()) {
      const state = classifyOcds(releases);
      const unique = latestReleases(releases);
      counts.duplicateReleases += releases.length - unique.length;
      counts.contracts += unique.flatMap(release => Array.isArray(release.contracts) ? release.contracts : []).length;
      if (state.status === "OPEN") { counts.active++; eligible.push(unique); }
      else if (state.status === "AWARDED") counts.awarded++;
      else counts.closed++;
    }
    const datasetHash = hash.digest("hex");
    // Exact source/OCID links are useful for a dry-run duplicate estimate. Cross-source
    // fuzzy matches remain the responsibility of the existing ingestion engine.
    for (let offset = 0; ; offset += 1000) {
      const { data: linked } = await supabaseRest<Array<{ external_id: string }>>(`opportunity_sources?select=external_id&source_id=eq.${s.id}&limit=1000&offset=${offset}`);
      counts.possibleDuplicates += linked.filter(row => grouped.has(row.external_id)).length;
      if (linked.length < 1000) break;
    }
    if (mode === "limited" || mode === "full") {
      const all = [...grouped.values()].map(latestReleases).sort((a, b) => a[0].ocid.localeCompare(b[0].ocid));
      const cursor = mode === "limited" ? 0 : etag === s.ocds_dataset_etag ? s.ocds_import_cursor : 0;
      const selected = mode === "limited" ? all.slice(0, 20) : all.slice(cursor, cursor + 500);
      const known = new Map<string, string>();
      for (let offset = 0; ; offset += 1000) {
        const { data: rows } = await supabaseRest<Array<{ ocid: string; source_hash: string }>>(`ocds_processes?select=ocid,source_hash&source_id=eq.${s.id}&order=ocid.asc&limit=1000&offset=${offset}`);
        rows.forEach(row => known.set(row.ocid, row.source_hash));
        if (rows.length < 1000) break;
      }
      for (let offset = 0; offset < selected.length; offset += 25) {
        const batch = selected.slice(offset, offset + 25);
        const changed = batch.map(releases => ({ releases, history: ocdsToHistory(releases, s.id, runId) }))
          .filter(item => { if (known.get(item.history.ocid) === item.history.source_hash) { counts.unchanged++; return false; } return true; });
        if (changed.length) {
          try {
            await supabaseRest("ocds_processes?on_conflict=source_id,ocid", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(changed.map(item => item.history)) });
            changed.forEach(item => { if (known.has(item.history.ocid)) counts.updated++; else counts.inserted++; });
          } catch {
            // Isolate malformed rows, preserving progress for the rest of the batch.
            for (const item of changed) {
              try {
                await supabaseRest("ocds_processes?on_conflict=source_id,ocid", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(item.history) });
                if (known.has(item.history.ocid)) counts.updated++; else counts.inserted++;
              } catch { counts.errors++; }
            }
          }
        }
        const current = changed.filter(item => classifyOcds(item.releases).status === "OPEN");
        if (current.length) {
          const ingested = await ingestNormalizedRecords(s, current.map(item => ocdsToOpportunity(item.releases)), actorUserId);
          counts.duplicates += ingested.duplicates; counts.errors += ingested.failed;
        }
      }
      nextCursor = mode === "limited" ? null : cursor + selected.length;
      const complete = mode !== "limited" && nextCursor !== null && nextCursor >= all.length && counts.errors === 0;
      await supabaseRest(`procurement_sources?id=eq.${s.id}`, { method: "PATCH", body: JSON.stringify({
        ...(mode === "limited" ? { ocds_limited_passed: counts.errors === 0 } : { ocds_import_cursor: complete ? 0 : counts.errors ? cursor : nextCursor }),
        ocds_dataset_etag: etag, ocds_dataset_last_modified: modified,
        ...(complete ? { ocds_last_sync_at: new Date().toISOString() } : {}),
      }) });
      nextCursor = complete ? null : counts.errors ? cursor : nextCursor;
    }
    const result = { mode, runId, datasetHash, etag, lastModified: modified, registryUrl: GHANEPS_REGISTRY_URL, nextCursor, ...counts };
    await supabaseRest(`source_sync_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status: counts.errors || counts.malformed ? "PARTIALLY_SUCCEEDED" : "SUCCEEDED", completed_at: new Date().toISOString(), dataset_hash: datasetHash, records_fetched: counts.recordsRead, unique_ocids: counts.uniqueOcids, active_count: counts.active, closed_count: counts.closed, awarded_count: counts.awarded, contract_count: counts.contracts, unchanged_count: counts.unchanged, duplicate_count: counts.duplicates, inserted_count: counts.inserted, updated_count: counts.updated, failed_count: counts.errors + counts.malformed, error_summary: counts.malformed ? `${counts.malformed} malformed records` : null }) });
    return result;
  } catch (error) {
    await supabaseRest(`source_sync_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status: "FAILED", completed_at: new Date().toISOString(), records_fetched: counts.recordsRead, failed_count: counts.errors + counts.malformed + 1, error_summary: safeError(error) }) }).catch(() => undefined);
    throw error;
  }
}
