import assert from "node:assert/strict";
import test from "node:test";
import { canAutoPublish, canCrawl, canPublish, validateRights, type SourceRights } from "../../lib/server/discovery/rights.ts";

const licensed: SourceRights = {
  reuse_status: "explicitly_licensed", license_name: "Example licence", license_url: "https://example.org/licence",
  content_reuse_allowed: true, commercial_reuse_allowed: true, document_reuse_allowed: false,
  metadata_reuse_allowed: true, discovery_enabled: true, discovery_auto_publish_enabled: true,
  crawl_robots_allowed: true, crawl_terms_reviewed: true,
};

test("unknown and prohibited sources cannot crawl or publish", () => {
  for (const reuse_status of ["permission_unknown", "prohibited"] as const) {
    const source = { ...licensed, reuse_status };
    assert.equal(canCrawl(source), false);
    assert.equal(canPublish(source), false);
    assert.equal(canAutoPublish(source), false);
    assert.match(validateRights(source) || "", /disabled/);
  }
});
test("licence requires evidence and permission cannot be expired", () => {
  assert.equal(canCrawl({ ...licensed, license_url: null }), false);
  assert.equal(canCrawl({ ...licensed, permission_expiry: "2020-01-01" }), false);
  assert.equal(canCrawl(licensed), true);
  assert.equal(canAutoPublish(licensed), true);
});
test("public link only cannot reuse content, documents or auto publish", () => {
  const source: SourceRights = { ...licensed, reuse_status: "public_link_only", license_name: null, license_url: null,
    content_reuse_allowed: false, document_reuse_allowed: false, commercial_reuse_allowed: false,
    discovery_auto_publish_enabled: false };
  assert.equal(canCrawl(source), true);
  assert.equal(canPublish(source), true);
  assert.equal(canAutoPublish({ ...source, discovery_auto_publish_enabled: true }), false);
  assert.match(validateRights({ ...source, document_reuse_allowed: true }) || "", /not source content/);
});
test("official API is not sent to generic crawler", () => {
  const source: SourceRights = { ...licensed, reuse_status: "official_api", permission_evidence: "https://example.org/api-terms" };
  assert.equal(canCrawl(source), false);
  assert.equal(canAutoPublish(source), false);
});
test("written permission requires evidence and permission date", () => {
  assert.equal(canCrawl({ ...licensed, reuse_status: "written_permission" }), false);
  assert.equal(canCrawl({ ...licensed, reuse_status: "written_permission", permission_evidence: "Signed permission", permission_date: "2026-09-23" }), true);
});
