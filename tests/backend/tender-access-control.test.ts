import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { guestOpportunityPreview } from "../../lib/server/procurement/guest-preview.ts";

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8");

test("public preview omits buyer, source, references, contacts and URLs", () => {
  const preview = guestOpportunityPreview({
    slug: "road-works-12345678",
    title: "Road works for Secret Buyer",
    summary: "Apply to Secret Buyer at tenders@example.com https://official.test/tender",
    buyer_name: "Secret Buyer",
    source_name: "GHANEPS",
    country: "Ghana",
    country_code: "GH",
    status: "OPEN",
  });
  const json = JSON.stringify(preview);
  for (const forbidden of ["Secret Buyer", "GHANEPS", "tenders@example.com", "official.test"]) assert.equal(json.includes(forbidden), false);
  for (const forbiddenKey of ["buyer_name", "source_name", "official_source_url", "external_reference", "contact_email", "documents_url"]) assert.equal(forbiddenKey in preview, false);
  assert.equal(preview.locked.includes("application_route"), true);
});

test("all tender data surfaces use the central server-side gate", () => {
  const customer = read("app/api/customer/route.ts");
  assert.match(customer, /tenderAccessForUser/);
  assert.match(customer, /guestOpportunityPreview/);
  for (const path of [
    "app/api/opportunities/route.ts",
    "app/api/opportunities/[slug]/route.ts",
    "app/api/opportunities/[slug]/submission/route.ts",
    "app/api/buyers/route.ts",
    "app/api/buyers/[slug]/route.ts",
    "app/api/awards/route.ts",
    "app/api/saved-opportunities/route.ts",
  ]) assert.match(read(path), /canViewTenderSource/);
});

test("direct database access to sensitive tender tables is revoked", () => {
  const migration = read("supabase/migrations/20260918111500_tender_access_rls.sql");
  assert.match(migration, /revoke select on table public\.procurement_opportunities from anon, authenticated, public/);
  assert.match(migration, /opportunity_documents/);
  assert.match(migration, /procuring_entities/);
  assert.match(migration, /grant all[\s\S]*service_role/);
});

test("paid feature flags exist and source access is admin-overridable", () => {
  const entitlements = read("lib/server/entitlements.ts");
  const gate = read("lib/server/tender-access.ts");
  for (const feature of ["tender_source_access", "tender_documents", "buyer_intelligence", "incumbent_intelligence", "document_analysis", "partner_marketplace", "bid_writer", "advanced_alerts"]) assert.match(entitlements, new RegExp(feature));
  assert.match(gate, /adminOverride/);
  assert.match(gate, /tier === "PREMIUM"/);
});
