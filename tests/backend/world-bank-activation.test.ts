import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WorldBankAdapter } from "../../lib/server/procurement/world-bank-adapter.ts";

test("World Bank notice fetch keeps Ghana opportunities and excludes contract awards", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ total: 2, procnotices: [
    { id:"OP1", project_ctry_name:"Ghana", bid_description:"Supply equipment", notice_type:"Invitation for Bids" },
    { id:"OP2", project_ctry_name:"Ghana", bid_description:"Award", notice_type:"Contract Award" },
  ] }), { status:200, headers:{ "content-type":"application/json" } });
  try { const rows = await new WorldBankAdapter().fetchOpportunities(); assert.equal(rows.length, 1); assert.equal(rows[0].id, "OP1"); }
  finally { globalThis.fetch = originalFetch; }
});

test("World Bank project metadata is normalised and deduplicated", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ projects:{ P123:{ id:"P123", project_name:"Ghana Digital Acceleration", countryname:["Republic of Ghana"], regionname:"Western and Central Africa", sector_name:["Digital Development"], status:"Active" } } }), { status:200 });
  try { const rows = await new WorldBankAdapter().fetchProjects?.([{ project_id:"P123" }, { project_id:"P123" }]); assert.equal(rows?.length, 1); assert.equal(rows?.[0].external_project_id, "P123"); assert.equal(rows?.[0].status, "Active"); }
  finally { globalThis.fetch = originalFetch; }
});

test("World Bank awards use the official IPF dataset and retain verified values", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /datasetId=DS00005/);
    return new Response(JSON.stringify({ count:1, data:[{ borrower_country:"Ghana", wb_contract_number:"WB-1", project_id:"P123", contract_description:"Network equipment", contract_signing_date:"01-Sep-2026", supplier:"Example Supplier", supplier_country:"Ghana", supplier_contract_amount_usd:250000, procurement_method:"Request for Bids" }] }), { status:200 });
  };
  try { const rows = await new WorldBankAdapter().fetchAwards?.(); assert.equal(rows?.length, 1); assert.equal(rows?.[0].value, 250000); assert.equal(rows?.[0].supplier_name, "Example Supplier"); }
  finally { globalThis.fetch = originalFetch; }
});

test("World Bank activation migration adds projects, official source metadata, and no API key", async () => {
  const migration = await readFile(new URL("../../supabase/migrations/20260912170000_activate_world_bank_open_data.sql", import.meta.url), "utf8");
  const environment = await readFile(new URL("../../.env.example", import.meta.url), "utf8");
  assert.match(migration, /create table if not exists public\.procurement_projects/i);
  assert.match(migration, /integration_type = 'OPEN_API'/i);
  assert.match(migration, /'authentication', 'NONE'/i);
  assert.doesNotMatch(environment, /WORLD_BANK_API_KEY/);
});
