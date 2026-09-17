import assert from "node:assert/strict";
import test from "node:test";
import { enrichNormalizedOpportunity } from "../../lib/server/procurement/enrichment.ts";
import { normalize } from "../../lib/server/procurement/normalization.ts";

function opportunity(description: string) {
  return normalize({
    title: "Construction and supply contract",
    description,
    buyer_name: "Official buyer",
    country: "Ghana",
    country_code: "GH",
    source_name: "Any future source",
    source_type: "OPEN_API",
    official_source_url: "https://example.gov/notice/1",
  });
}

test("source-wide enrichment promotes published requirements into structured fields", () => {
  const result = enrichNormalizedOpportunity(opportunity(`
    Eligible bidders shall provide a Tax Clearance Certificate, SSNIT Clearance Certificate,
    audited financial statements and a method statement. Bids must be submitted electronically
    through the buyer portal before the deadline. Bid security: GHS 25,000. Tender fee: GHS 500.
    Bid validity is 120 days. Contract completion period is 8 months.
    Evaluation criteria: technical capacity, relevant experience and evaluated price.
    Questions may be sent to procurement@example.gov or +233 30 200 0000.
  `));

  assert.match(result.qualification_requirements || "", /bidders shall provide/i);
  assert.match(result.submission_instructions || "", /submitted electronically/i);
  assert.match(result.bid_security_requirement || "", /25,000/i);
  assert.equal(result.participation_fee_amount, 500);
  assert.equal(result.participation_fee_currency, "GHS");
  assert.equal(result.bid_validity_days, 120);
  assert.equal(result.contact_email, "procurement@example.gov");
  assert.match(String(result.source_details["Contract duration"]), /8 months/i);
  assert.ok(result.required_documents?.some((item) => item.name === "Tax Clearance Certificate"));
});

test("source-wide enrichment never manufactures absent tender requirements", () => {
  const result = enrichNormalizedOpportunity(opportunity("Purchase of office supplies. Review the official source for complete details."));
  assert.equal(result.qualification_requirements, null);
  assert.equal(result.submission_instructions, null);
  assert.equal(result.bid_security_requirement, null);
  assert.equal(result.participation_fee_amount, null);
  assert.deepEqual(result.required_documents, []);
});

test("URL-only descriptions are not presented as tender narratives", () => {
  const result = enrichNormalizedOpportunity(opportunity("https://api.example.gov/noticedesc?id=123"));
  assert.equal(result.description, "");
  assert.equal(result.summary, "");
});
