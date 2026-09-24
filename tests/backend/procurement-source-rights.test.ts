import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertApprovedOpenDataRights, assertLegacySourceRights } from "../../lib/server/procurement/source-rights.ts";
import type { SourceRights } from "../../lib/server/discovery/rights.ts";
import type { ProcurementSource } from "../../lib/server/procurement/types.ts";

const approved = {
  reuse_status: "explicitly_licensed", license_name: "CC BY 4.0", license_url: "https://creativecommons.org/licenses/by/4.0/",
  content_reuse_allowed: true, metadata_reuse_allowed: true, commercial_reuse_allowed: true,
  document_reuse_allowed: false,
} satisfies SourceRights;

function check(rights: SourceRights) {
  assertLegacySourceRights({ slug: "test-source", ...rights } as ProcurementSource & SourceRights);
}

test("legacy connectors require current commercial content rights", () => {
  assert.doesNotThrow(() => check(approved));
  for (const reuse_status of ["permission_unknown", "prohibited", "public_link_only", "official_open_data"] as const) {
    assert.throws(() => check({ ...approved, reuse_status }), /Source rights|structured-data/);
  }
  assert.throws(() => check({ ...approved, content_reuse_allowed: false }), /Source rights/);
  assert.throws(() => check({ ...approved, permission_expiry: "2020-01-01" }), /Source rights/);
});

test("approved OCDS importer is restricted to GHANEPS and current publication rights", () => {
  const ghaneps = { slug: "ghaneps", ...approved, reuse_status: "official_open_data", permission_evidence: "OCDS registry publication" } as ProcurementSource & SourceRights;
  assert.doesNotThrow(() => assertApprovedOpenDataRights(ghaneps));
  assert.throws(() => assertApprovedOpenDataRights({ ...ghaneps, slug: "other-source" }), /structured-data/);
  assert.throws(() => assertApprovedOpenDataRights({ ...ghaneps, metadata_reuse_allowed: false }), /structured-data/);
});

test("rights review licences World Bank datasets and pauses UNGM without enabling Ministry of Finance", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/20260925000000_review_ghana_source_rights.sql", import.meta.url), "utf8");
  assert.match(sql, /reuse_status = 'explicitly_licensed'/);
  assert.match(sql, /slug = 'world-bank'/);
  assert.match(sql, /document_reuse_allowed = false/);
  assert.match(sql, /reuse_status = 'prohibited'/);
  assert.match(sql, /slug = 'ungm'/);
  assert.match(sql, /sync_enabled = false/);
  assert.doesNotMatch(sql, /slug = 'ghana-ministry-finance'/);
});
