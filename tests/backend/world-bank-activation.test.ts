import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WorldBankAdapter } from "../../lib/server/procurement/world-bank-adapter.ts";

test("World Bank notice fetch keeps African opportunities and excludes contract awards", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin + url.pathname, "https://search.worldbank.org/api/v2/procnotices");
    assert.equal(url.searchParams.get("project_ctry_name"), null);
    return new Response(JSON.stringify({ total: 4, procnotices: [
    { id:"OP1", project_ctry_name:"Ghana", bid_description:"Supply equipment", notice_type:"Invitation for Bids" },
    { id:"OP2", project_ctry_name:"Ghana", bid_description:"Award", notice_type:"Contract Award" },
    { id:"OP3", project_ctry_name:"Nigeria", bid_description:"Supply solar equipment", notice_type:"Invitation for Bids" },
    { id:"OP4", project_ctry_name:"Sri Lanka", bid_description:"Road works", notice_type:"Invitation for Bids" },
    ] }), { status:200, headers:{ "content-type":"application/json" } });
  };
  try { const rows = await new WorldBankAdapter().fetchOpportunities(); assert.deepEqual(rows.map((row) => row.id), ["OP1", "OP3"]); }
  finally { globalThis.fetch = originalFetch; }
});

test("World Bank notice fetch starts with the newest page instead of the oldest offset", async () => {
  const originalFetch = globalThis.fetch;
  const originalPageSize = process.env.WORLD_BANK_PAGE_SIZE;
  const originalMaxPages = process.env.WORLD_BANK_MAX_PAGES;
  const offsets: string[] = [];
  process.env.WORLD_BANK_PAGE_SIZE = "2";
  process.env.WORLD_BANK_MAX_PAGES = "2";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const offset = url.searchParams.get("os") || "0";
    offsets.push(offset);
    const records = offset === "0"
      ? [{ id:"NEW-1", project_ctry_name:"Ghana", notice_type:"Invitation for Bids" }, { id:"NEW-2", project_ctry_name:"Ghana", notice_type:"Request for Expressions of Interest" }]
      : [{ id:"NEXT-1", project_ctry_name:"Ghana", notice_type:"Invitation for Bids" }, { id:"NEXT-2", project_ctry_name:"Ghana", notice_type:"Invitation for Bids" }];
    return new Response(JSON.stringify({ total: 100, procnotices: records }), { status:200 });
  };
  try {
    const rows = await new WorldBankAdapter().fetchOpportunities();
    assert.deepEqual(offsets, ["0", "2"]);
    assert.deepEqual(rows.map((row) => row.id), ["NEW-1", "NEW-2", "NEXT-1", "NEXT-2"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalPageSize === undefined) delete process.env.WORLD_BANK_PAGE_SIZE; else process.env.WORLD_BANK_PAGE_SIZE = originalPageSize;
    if (originalMaxPages === undefined) delete process.env.WORLD_BANK_MAX_PAGES; else process.env.WORLD_BANK_MAX_PAGES = originalMaxPages;
  }
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
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("filter"), "borrower_country='Ghana'");
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
