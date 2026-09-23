import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { ApiError } from "../api-error.ts";
import { canPublish, type SourceRights } from "./rights.ts";
import { ingestNormalizedRecords } from "../procurement/ingestion.ts";
import type { ProcurementSource } from "../procurement/types.ts";
import { encodeFilter, supabaseRest } from "../supabase-rest.ts";
import { classifyOcds, extractReleases, GHANEPS_DATASET_URL, GHANEPS_REGISTRY_URL, latestReleases, ocdsToOpportunity } from "./ocds.ts";

type GhanepsSource = ProcurementSource & SourceRights & { ocds_paused: boolean; ocds_limited_passed: boolean; ocds_dataset_etag: string | null; ocds_dataset_last_modified: string | null; ocds_last_sync_at: string | null };
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
  const { data: runs } = await supabaseRest("source_sync_runs?select=id,started_at,completed_at,status,mode,dataset_hash,dataset_etag,records_fetched,unique_ocids,active_count,closed_count,awarded_count,inserted_count,updated_count,unchanged_count,duplicate_count,failed_count,error_summary&source_id=eq." + s.id + "&mode=not.is.null&order=started_at.desc&limit=20");
  return { source: { id: s.id, name: s.name, registryUrl: GHANEPS_REGISTRY_URL, rights: s.reuse_status, metadataReuse: s.metadata_reuse_allowed, commercialReuse: s.commercial_reuse_allowed, documentReuse: s.document_reuse_allowed, paused: s.ocds_paused, limitedPassed: s.ocds_limited_passed, lastSync: s.ocds_last_sync_at, etag: s.ocds_dataset_etag, lastModified: s.ocds_dataset_last_modified, configuration: s.configuration }, runs };
}

export async function setGhanepsOcdsPaused(paused: boolean, actorUserId: string) {
  const s = await source();
  if (!paused && (!s.ocds_limited_passed || !canPublish(s) || !s.commercial_reuse_allowed)) throw new ApiError(409, "Complete the rights review and limited validation before enabling monthly imports.");
  await supabaseRest(`procurement_sources?id=eq.${s.id}`, { method: "PATCH", body: JSON.stringify({ ocds_paused: paused }) });
  await supabaseRest("audit_log", { method: "POST", body: JSON.stringify({ actor_user_id: actorUserId, action: "ghaneps.ocds.pause", entity_type: "procurement_source", entity_id: s.id, metadata: { paused } }) });
  return { paused };
}

export async function runGhanepsOcds(mode: Mode, actorUserId?: string, scheduled = false) {
  const s = await source();
  if (scheduled && (s.ocds_paused || !s.ocds_limited_passed || !canPublish(s) || !s.commercial_reuse_allowed)) return { mode, skipped: true, reason: "rights review, limited validation or unpause pending" };
  if (mode === "limited" || mode === "full") {
    if (s.ocds_paused || !canPublish(s) || !s.commercial_reuse_allowed || !s.metadata_reuse_allowed) throw new ApiError(409, "GHANEPS OCDS publication is blocked until its licence and commercial metadata-reuse scope are verified.");
    if (mode === "full" && !s.ocds_limited_passed) throw new ApiError(409, "A successful reviewed limited import is required before full sync.");
  }
  const head = await registryFetch("HEAD");
  const etag = head.headers.get("etag");
  const modified = head.headers.get("last-modified");
  const unchanged = Boolean(mode !== "dry_run" && etag && etag === s.ocds_dataset_etag && modified === s.ocds_dataset_last_modified);
  if (mode === "check") return { mode, changed: !unchanged, etag, lastModified: modified, contentLength: Number(head.headers.get("content-length") || 0), registryUrl: GHANEPS_REGISTRY_URL };
  if (scheduled && unchanged) return { mode, skipped: true, reason: "unchanged dataset" };

  const { data: created } = await supabaseRest<Array<{ id: string }>>("source_sync_runs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ source_id: s.id, mode, triggered_by: actorUserId ? "admin" : "schedule", actor_user_id: actorUserId || null, dataset_etag: etag, dataset_last_modified: modified, status: "RUNNING" }) });
  const runId = created[0]?.id;
  if (!runId) throw new ApiError(503, "Could not create OCDS audit run.");
  const counts = { recordsRead: 0, uniqueOcids: 0, active: 0, closed: 0, awarded: 0, malformed: 0, duplicateReleases: 0, possibleDuplicates: 0, unchanged: 0, inserted: 0, updated: 0, duplicates: 0, rejected: 0, errors: 0 };
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
    if (mode === "limited" && eligible.length === 0) throw new ApiError(409, "No current active opportunities exist in this registry snapshot. Limited import was not run.");
    if (mode === "limited" || mode === "full") {
      const selected = mode === "limited" ? eligible.slice(0, 20) : [...grouped.values()].map(latestReleases);
      for (let offset = 0; offset < selected.length; offset += 25) {
        const batch = selected.slice(offset, offset + 25);
        const changed = [];
        for (const releases of batch) {
          const record = ocdsToOpportunity(releases);
          const existing = await supabaseRest<Array<{ opportunity_id: string }>>(`opportunity_sources?select=opportunity_id&source_id=eq.${s.id}&external_id=eq.${encodeFilter(record.external_opportunity_id || "")}&limit=1`);
          if (existing.data.length) {
            const prior = await supabaseRest<Array<{ raw_source_hash: string }>>(`procurement_opportunities?select=raw_source_hash&id=eq.${existing.data[0].opportunity_id}&limit=1`);
            if (prior.data[0]?.raw_source_hash === record.raw_source_hash) { counts.unchanged++; continue; }
          }
          changed.push({ record, releases });
        }
        if (!changed.length) continue;
        const ingested = await ingestNormalizedRecords(s, changed.map(item => item.record), actorUserId);
        counts.inserted += ingested.inserted; counts.updated += ingested.updated; counts.duplicates += ingested.duplicates; counts.errors += ingested.failed;
        for (const { record, releases } of changed) {
          try {
            await supabaseRest(`opportunity_sources?source_id=eq.${s.id}&external_id=eq.${encodeFilter(record.external_opportunity_id || "")}`, { method: "PATCH", body: JSON.stringify({ release_id: releases.at(-1)?.id, registry_url: GHANEPS_REGISTRY_URL, original_source_url: record.official_tender_url, latest_import_run_id: runId, last_seen_at: new Date().toISOString() }) });
            await supabaseRest("ocds_release_history?on_conflict=source_id,ocid,release_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(releases.map(release => ({ source_id: s.id, ocid: release.ocid, release_id: release.id, release_date: release.date || null, tags: release.tag || [], source_hash: createHash("sha256").update(JSON.stringify(release)).digest("hex"), import_run_id: runId, last_seen_at: new Date().toISOString() }))) });
          } catch { counts.errors++; }
        }
      }
      if (mode === "limited" && counts.errors === 0 && counts.inserted + counts.updated + counts.duplicates > 0) await supabaseRest(`procurement_sources?id=eq.${s.id}`, { method: "PATCH", body: JSON.stringify({ ocds_limited_passed: true }) });
      await supabaseRest(`procurement_sources?id=eq.${s.id}`, { method: "PATCH", body: JSON.stringify({ ocds_dataset_etag: etag, ocds_dataset_last_modified: modified, ocds_last_sync_at: new Date().toISOString() }) });
    }
    const result = { mode, runId, datasetHash, etag, lastModified: modified, registryUrl: GHANEPS_REGISTRY_URL, ...counts };
    await supabaseRest(`source_sync_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status: counts.errors || counts.malformed ? "PARTIALLY_SUCCEEDED" : "SUCCEEDED", completed_at: new Date().toISOString(), dataset_hash: datasetHash, records_fetched: counts.recordsRead, unique_ocids: counts.uniqueOcids, active_count: counts.active, closed_count: counts.closed, awarded_count: counts.awarded, unchanged_count: counts.unchanged, duplicate_count: counts.duplicates, inserted_count: counts.inserted, updated_count: counts.updated, failed_count: counts.errors + counts.malformed, error_summary: counts.malformed ? `${counts.malformed} malformed records` : null }) });
    return result;
  } catch (error) {
    await supabaseRest(`source_sync_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status: "FAILED", completed_at: new Date().toISOString(), records_fetched: counts.recordsRead, failed_count: counts.errors + counts.malformed + 1, error_summary: safeError(error) }) }).catch(() => undefined);
    throw error;
  }
}
