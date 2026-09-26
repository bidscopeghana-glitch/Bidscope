import test from "node:test";
import assert from "node:assert/strict";
import { procurementReport, type ReportAward, type ReportBid, type ReportTender } from "../../lib/procurement-report.ts";

const tenders: ReportTender[] = [
  { id: "a", status: "awarded", procurement_category: "Works", created_at: "2026-01-02T00:00:00Z", published_at: "2026-01-03T00:00:00Z" },
  { id: "b", status: "live", procurement_category: "Goods", created_at: "2026-02-02T00:00:00Z", published_at: "2026-02-03T00:00:00Z" },
  { id: "c", status: "draft", procurement_category: "Goods", created_at: "2026-02-04T00:00:00Z", published_at: null },
];
const bids: ReportBid[] = [
  { id: "draft", tender_id: "a", supplier_organization_id: "s1", submitted_at: null },
  { id: "one", tender_id: "a", supplier_organization_id: "s1", submitted_at: "2026-01-04T00:00:00Z" },
  { id: "two", tender_id: "a", supplier_organization_id: "s2", submitted_at: "2026-01-05T00:00:00Z" },
];
const awards: ReportAward[] = [
  { id: "pending", tender_id: "a", supplier_organization_id: "s2", approval_status: "pending", contract_value: 1000, currency: "GHS", finalised_at: null },
  { id: "paid", tender_id: "a", supplier_organization_id: "s1", approval_status: "finalised", contract_value: 200, currency: "GHS", finalised_at: "2026-01-13T00:00:00Z" },
  { id: "foreign", tender_id: "a", supplier_organization_id: "s2", approval_status: "finalised", contract_value: 50, currency: "USD", finalised_at: "2026-01-13T00:00:00Z" },
];

test("buyer report excludes drafts and pending awards and separates currencies", () => {
  const result = procurementReport(tenders, bids, awards);
  assert.equal(result.counts.tenders, 3);
  assert.equal(result.counts.published, 2);
  assert.equal(result.counts.bidsSubmitted, 2);
  assert.equal(result.counts.averageBids, 1);
  assert.equal(result.counts.tenderResponseRate, 50);
  assert.equal(result.counts.averageCycleDays, 10);
  assert.deepEqual(result.spendByCurrency, [{ currency: "GHS", amount: 200 }, { currency: "USD", amount: 50 }]);
  assert.ok(result.supplierConcentration.every((row) => row.topSupplierShare === 100));
  assert.deepEqual(result.categories.find((row) => row.name === "Works"), { name: "Works", tenders: 1, submittedBids: 2 });
  assert.deepEqual(result.monthlyTenders, [{ month: "2026-01", count: 1 }, { month: "2026-02", count: 2 }]);
});

test("empty report uses zero counts and no implied cycle or spend", () => {
  const result = procurementReport([], [], []);
  assert.equal(result.counts.averageBids, 0);
  assert.equal(result.counts.tenderResponseRate, 0);
  assert.equal(result.counts.averageCycleDays, null);
  assert.deepEqual(result.spendByCurrency, []);
});
