import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { supplierReport, type SupplierReportAward, type SupplierReportBid, type SupplierReportTender } from "../../lib/supplier-report.ts";

const bids: SupplierReportBid[] = [
  { id: "draft", tender_id: "works", status: "draft", created_at: "2026-01-01T00:00:00Z", submitted_at: null },
  { id: "won", tender_id: "goods", status: "awarded", created_at: "2026-02-01T00:00:00Z", submitted_at: "2026-02-03T00:00:00Z" },
  { id: "lost", tender_id: "goods", status: "unsuccessful", created_at: "2026-02-04T00:00:00Z", submitted_at: "2026-02-05T00:00:00Z" },
];
const tenders: SupplierReportTender[] = [
  { id: "works", procurement_category: "Works" }, { id: "goods", procurement_category: "Goods" },
];
const awards: SupplierReportAward[] = [
  { bid_id: "won", approval_status: "pending", contract_value: 999, currency: "GHS" },
  { bid_id: "won", approval_status: "finalised", contract_value: 250, currency: "GHS" },
  { bid_id: "won", approval_status: "finalised", contract_value: 50, currency: "USD" },
];

test("supplier report counts own recorded bid outcomes and only finalised value", () => {
  const result = supplierReport(bids, tenders, awards);
  assert.equal(result.counts.started, 3);
  assert.equal(result.counts.drafts, 1);
  assert.equal(result.counts.submitted, 2);
  assert.equal(result.counts.awarded, 1);
  assert.equal(result.counts.unsuccessful, 1);
  assert.equal(result.counts.completionRate, 66.7);
  assert.equal(result.counts.averagePreparationDays, 1.5);
  assert.deepEqual(result.awardValueByCurrency, [{ currency: "GHS", amount: 250 }, { currency: "USD", amount: 50 }]);
  assert.deepEqual(result.categories.find((row) => row.name === "Goods"), { name: "Goods", started: 2, submitted: 2, awarded: 1 });
});

test("supplier report route is restricted to the current supplier organisation", () => {
  const route = readFileSync(new URL("../../app/api/procurement/route.ts", import.meta.url), "utf8");
  const section = route.slice(route.indexOf('if (resource === "supplier_reports")'), route.indexOf('if (resource === "clarifications")'));
  assert.match(section, /context\.organization\.can_bid/);
  assert.match(section, /supplier_organization_id=eq\.\$\{context\.organizationId\}/);
  assert.match(section, /reportRows<SupplierReportBid>/);
  assert.match(section, /approval_status=eq\.finalised/);
});
