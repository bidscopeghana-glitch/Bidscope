import assert from "node:assert/strict";
import test from "node:test";
import { classifyOcds, extractReleases, latestReleases, ocdsToHistory, ocdsToOpportunity, GHANEPS_REGISTRY_URL } from "../../lib/server/discovery/ocds.ts";

const base = { ocid: "ocds-uhveoc-123", id: "release-1", date: "2026-09-01T12:00:00Z", tag: ["tender"], buyer: { id: "buyer-1", name: "Accra Buyer" }, tender: { id: "123", title: "Build a drain", description: "Drain construction", status: "active", tenderPeriod: { startDate: "2026-09-01T09:00:00Z", endDate: "2026-12-01T10:00:00+00:00" } } };
const now = new Date("2026-09-23T10:00:00Z");
test("release packages and record packages preserve OCIDs", () => {
  assert.equal(extractReleases({ releases: [base] }).length, 1);
  assert.equal(extractReleases({ records: [{ releases: [base] }] })[0].ocid, base.ocid);
  assert.equal(extractReleases({ records: [{ compiledRelease: base }] }).length, 1);
});
test("malformed records are rejected", () => { assert.equal(extractReleases({ tender: base.tender }).length, 0); assert.equal(extractReleases(null).length, 0); });
test("same release ID is idempotent", () => assert.equal(latestReleases([base, base]).length, 1));
test("multiple releases form one procurement process", () => assert.equal(ocdsToOpportunity([base, { ...base, id: "release-2" }], now).external_opportunity_id, base.ocid));
test("latest amendment wins", () => assert.equal(ocdsToOpportunity([base, { ...base, id: "release-2", date: "2026-09-02T12:00:00Z", tag: ["tenderAmendment"], tender: { ...base.tender, title: "Revised drain" } }], now).title, "Revised drain"));
test("active future-deadline tender is open", () => assert.equal(classifyOcds([base], now).status, "OPEN"));
test("expired active tender is closed", () => assert.equal(classifyOcds([base], new Date("2027-01-01")).status, "CLOSED"));
test("cancellation is not open", () => assert.equal(classifyOcds([{ ...base, tag: ["tenderCancellation"] }], now).status, "CANCELLED"));
test("award is not open", () => assert.equal(classifyOcds([base, { ...base, id: "award-1", tag: ["award"], awards: [{ id: "a" }] }], now).status, "AWARDED"));
test("contract is tracked as contracted stage", () => assert.equal(classifyOcds([base, { ...base, id: "contract-1", tag: ["contract"], contracts: [{ id: "c" }] }], now).stage, "contracted"));
test("missing deadline is not open", () => assert.equal(classifyOcds([{ ...base, tender: { ...base.tender, tenderPeriod: {} } }], now).status, "UNKNOWN"));
test("invalid deadline is not open", () => assert.equal(classifyOcds([{ ...base, tender: { ...base.tender, tenderPeriod: { endDate: "not-a-date" } } }], now).status, "UNKNOWN"));
test("award and contract data are preserved", () => { const r = ocdsToOpportunity([{ ...base, awards: [{ id: "a" }], contracts: [{ id: "c" }] }], now); assert.equal(r.status, "AWARDED"); assert.equal(r.source_details.current_stage, "contracted"); });
test("attribution and official source are retained", () => { const r = ocdsToOpportunity([base], now); assert.match(r.source_name, /Public Procurement Authority/); assert.match(r.official_tender_url || "", /ghaneps\.gov\.gh/); assert.equal(r.source_details.registry_url, GHANEPS_REGISTRY_URL); });
test("OCID identity is stable across releases", () => { const a = ocdsToOpportunity([base], now); const b = ocdsToOpportunity([base, { ...base, id: "release-2", date: "2026-09-02T12:00:00Z" }], now); assert.equal(a.external_opportunity_id, b.external_opportunity_id); assert.equal(a.document_fingerprint, b.document_fingerprint); });
test("documents are linked and not mirrored", () => { const r = ocdsToOpportunity([{ ...base, tender: { ...base.tender, documents: [{ title: "Notice", url: "https://www.ghaneps.gov.gh/notice.pdf", format: "application/pdf" }] } }], now); assert.equal(r.documents_url, "https://www.ghaneps.gov.gh/notice.pdf"); assert.equal((r.source_details.documents as Array<{ title: string }>)[0]?.title, "Notice"); });
test("unsafe document URL is not accepted", () => { const r = ocdsToOpportunity([{ ...base, tender: { ...base.tender, documents: [{ url: "javascript:alert(1)" }] } }], now); assert.equal(r.documents_url, null); });
test("buyer identity and eligibility are not invented", () => { const r = ocdsToOpportunity([base], now); assert.equal(r.buyer_name, "Accra Buyer"); assert.equal(r.eligibility_text, null); });
test("historical process retains provenance and releases under one OCID", () => {
  const award = { ...base, id: "award-1", date: "2026-09-05T12:00:00Z", tag: ["award"], awards: [{ id: "award-a", suppliers: [{ name: "Supplier Ltd" }], value: { amount: 400, currency: "GHS" } }] };
  const contract = { ...base, id: "contract-1", date: "2026-09-06T12:00:00Z", tag: ["contract"], contracts: [{ id: "contract-a" }] };
  const row = ocdsToHistory([base, award, contract, award], "source-id", "run-id", now);
  assert.equal(row.ocid, base.ocid); assert.equal(row.release_history.length, 3);
  assert.equal(row.award_count, 1); assert.equal(row.contract_count, 1);
  assert.deepEqual(row.supplier_names, ["Supplier Ltd"]);
  assert.equal(row.stage, "contracted"); assert.match(row.source_attribution, /Public Procurement Authority/);
  assert.equal(row.registry_url, GHANEPS_REGISTRY_URL);
  assert.equal(ocdsToHistory([base, award, contract], "source-id", "run-id", now).source_hash, row.source_hash);
});
