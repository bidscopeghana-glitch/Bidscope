import assert from "node:assert/strict";
import test from "node:test";
import { ghanepsFactualDisplay } from "../../lib/server/procurement/ghaneps-factual-display.ts";

const record = {
  id: "notice-1", slug: "ghana-school", title: "Construction of a school", buyer_name: "District Assembly",
  source_name: "GHANEPS", source_type: "STRUCTURED_WEB", external_reference: "GH-123",
  country: "Ghana", country_code: "GH", deadline_at: "2026-10-20T10:00:00Z", status: "OPEN",
  summary: "Copied source summary", description: "Long copied notice text", eligibility_text: "Copied eligibility",
  qualification_requirements: "Copied criteria", source_details: { "Evaluation criteria": "Copied evaluation prose" },
  raw_payload: { detailHtml: "Copied HTML" }, documents: [{ url: "https://example.com/copied.pdf" }],
  official_source_url: "https://www.ghaneps.gov.gh/epps/cft/prepareViewCfTWS.do?resourceId=123",
  official_tender_url: "https://www.ghaneps.gov.gh/epps/cft/prepareViewCfTWS.do?resourceId=123",
  documents_url: "https://www.ghaneps.gov.gh/epps/cft/downloadNoticeForAdvSearch.do?resourceId=123",
};

test("live GHANEPS display keeps factual fields and official links, not copied content", () => {
  const displayed = ghanepsFactualDisplay(record) as Record<string, unknown>;
  assert.equal(displayed.title, record.title);
  assert.equal(displayed.buyer_name, record.buyer_name);
  assert.equal(displayed.external_reference, record.external_reference);
  assert.equal(displayed.deadline_at, record.deadline_at);
  assert.match(String(displayed.summary), /Review the official notice/);
  assert.equal(displayed.documents_url, record.documents_url);
  assert.deepEqual(displayed.source_details, {});
  for (const key of ["raw_payload", "documents", "eligibility_text", "qualification_requirements"]) {
    assert.equal(Object.hasOwn(displayed, key), false);
  }
  assert.equal(JSON.stringify(displayed).includes("Copied"), false);
});

test("live GHANEPS display does not return off-site document links", () => {
  const displayed = ghanepsFactualDisplay({ ...record, documents_url: "https://example.com/copied.pdf" });
  assert.equal(displayed.documents_url, null);
});

test("licensed GHANEPS OCDS and other sources are unchanged", () => {
  const ocds = { ...record, source_type: "OCDS" };
  assert.equal(ghanepsFactualDisplay(ocds), ocds);
  const worldBank = { ...record, source_name: "World Bank", source_type: "OPEN_API" };
  assert.equal(ghanepsFactualDisplay(worldBank), worldBank);
});
