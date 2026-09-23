// Run with: node --env-file=.env.local --experimental-strip-types scripts/verify-ghaneps-ocds.mjs
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { extractReleases, latestReleases, ocdsToHistory, GHANEPS_DATASET_URL } from "../lib/server/discovery/ocds.ts";
import { supabaseRest } from "../lib/server/supabase-rest.ts";

const { data: sources } = await supabaseRest("procurement_sources?select=id&slug=eq.ghaneps&limit=1");
assert.equal(sources.length, 1);
const { data: stats } = await supabaseRest("rpc/ocds_source_stats", { method: "POST", body: JSON.stringify({ p_source_id: sources[0].id }) });
assert.equal(Number(stats[0]?.processes), 7058);
assert.equal(Number(stats[0]?.current_open), 0);
const response = await fetch(GHANEPS_DATASET_URL, { signal: AbortSignal.timeout(90_000) });
assert.equal(response.ok, true);
const lines = createInterface({ input: Readable.fromWeb(response.body).pipe(createGunzip()), crlfDelay: Infinity });
const samples = new Map();
let index = 0;
let awardSample = false;
let contractSample = false;
for await (const line of lines) {
  if (!line.trim()) continue;
  const releases = latestReleases(extractReleases(JSON.parse(line)));
  const normalized = ocdsToHistory(releases, sources[0].id, null);
  if ([73, 4021, 7001].includes(index) || (!awardSample && normalized.award_count > 0) || (!contractSample && normalized.contract_count > 0)) {
    samples.set(normalized.ocid, normalized);
  }
  if (normalized.award_count > 0) awardSample = true;
  if (normalized.contract_count > 0) contractSample = true;
  index++;
}
assert.equal(index, 7058);
assert.equal(awardSample, true);
assert.equal(contractSample, true);
assert.ok(samples.size >= 3);
for (const [ocid, expected] of samples) {
  const { data: stored } = await supabaseRest(`ocds_processes?select=ocid,title,buyer_name,tender_start_at,tender_end_at,stage,award_count,contract_count,source_attribution,registry_url,source_hash&source_id=eq.${sources[0].id}&ocid=eq.${encodeURIComponent(ocid)}&limit=1`);
  assert.equal(stored.length, 1);
  for (const key of ["ocid", "title", "buyer_name", "stage", "award_count", "contract_count", "source_attribution", "registry_url", "source_hash"]) assert.equal(stored[0][key], expected[key], `${ocid}: ${key}`);
  assert.equal(stored[0].tender_start_at ? new Date(stored[0].tender_start_at).toISOString() : null, expected.tender_start_at);
  assert.equal(stored[0].tender_end_at ? new Date(stored[0].tender_end_at).toISOString() : null, expected.tender_end_at);
  console.log(JSON.stringify({ ocid, buyer: stored[0].buyer_name, stage: stored[0].stage, awards: stored[0].award_count, contracts: stored[0].contract_count, validated: true }));
}
console.log(JSON.stringify({ processes: Number(stats[0].processes), awards: Number(stats[0].awards), contracts: Number(stats[0].contracts), currentOpen: Number(stats[0].current_open), sampled: samples.size }));
