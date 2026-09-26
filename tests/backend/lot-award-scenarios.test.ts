import test from "node:test";
import assert from "node:assert/strict";
import { modelLotAwards, type LotOffer } from "../../lib/lot-award-scenarios.ts";

const offers: LotOffer[] = [
  { lotId: "a", bidId: "a1", supplierId: "s1", supplierName: "Alpha", price: 100 },
  { lotId: "b", bidId: "a2", supplierId: "s1", supplierName: "Alpha", price: 150 },
  { lotId: "a", bidId: "b1", supplierId: "s2", supplierName: "Beta", price: 120 },
  { lotId: "b", bidId: "b2", supplierId: "s2", supplierName: "Beta", price: 90 },
];

test("price comparison shows independent minimum and complete single-supplier alternative", () => {
  const result = modelLotAwards(["a", "b"], offers, { maxLotsPerSupplier: 2, minSuppliers: 1 });
  assert.equal(result[0].total, 190);
  assert.equal(result[0].supplierCount, 2);
  assert.ok(result.some((scenario) => scenario.name === "One supplier for every lot" && scenario.total === 210));
});

test("supplier and budget limits remove infeasible comparisons", () => {
  const result = modelLotAwards(["a", "b"], offers, { maxLotsPerSupplier: 1, minSuppliers: 2, budgetCap: 195 });
  assert.equal(result.length, 1);
  assert.equal(result[0].total, 190);
  assert.deepEqual(modelLotAwards(["a", "b"], offers, { maxLotsPerSupplier: 1, minSuppliers: 2, budgetCap: 180 }), []);
});

test("missing lot prices never produce a complete scenario", () => {
  assert.deepEqual(modelLotAwards(["a", "b"], offers.filter((offer) => offer.lotId === "a"), { maxLotsPerSupplier: 2, minSuppliers: 1 }), []);
});
