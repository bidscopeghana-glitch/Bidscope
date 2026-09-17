import assert from "node:assert/strict";
import test from "node:test";
import { guestOpportunityPreview } from "../../lib/server/procurement/guest-preview.ts";

test("guest opportunity previews hide every actionable source field", () => {
  const preview = guestOpportunityPreview({ slug: "road-contract", title: "Road works for GHANEPS", summary: "Issued by Accra Assembly. Apply at https://source.test or procurement@example.com.", buyer_name: "Accra Assembly", source_name: "GHANEPS", country: "Ghana", category: "works", deadline_at: "2026-12-20T12:00:00Z", status: "OPEN" });
  const payload = JSON.stringify(preview);
  assert.doesNotMatch(payload, /GHANEPS|Accra Assembly|source\.test|procurement@example\.com/i);
  for (const key of ["source_name", "buyer_name", "official_source_url", "official_tender_url", "documents_url", "external_reference", "description"]) assert.equal(key in preview, false);
  assert.equal(preview.access, "preview");
  assert.ok(preview.locked.includes("application_route"));
});

test("guest opportunity previews retain enough discovery context to encourage signup", () => {
  const preview = guestOpportunityPreview({ slug: "supply", title: "Supply of medical equipment", summary: "Supply and installation of clinical equipment for regional facilities.", country: "Ghana", region: "Ashanti", sector: "Health", category: "goods", deadline_at: "2026-12-20T12:00:00Z", status: "OPEN" });
  assert.equal(preview.title, "Supply of medical equipment");
  assert.match(preview.teaser, /Create an account/i);
  assert.doesNotMatch(preview.teaser, /clinical equipment/i);
  assert.equal(preview.region, "Ashanti");
  assert.equal(preview.deadline_at, "2026-12-20T12:00:00Z");
});
