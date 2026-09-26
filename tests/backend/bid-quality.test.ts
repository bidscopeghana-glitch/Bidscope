import test from "node:test";
import assert from "node:assert/strict";
import { bidReferencesValid, checkBidQuality } from "../../lib/bid-quality.ts";

const context = {
  requirements: [{ id: "r1", title: "Safety plan", mandatory: true }, { id: "r2", title: "Optional detail", mandatory: false }],
  requiredDocuments: [{ id: "d1", name: "Registration certificate", mandatory: true }],
  uploadedDocumentIds: [] as string[],
  lotIds: ["l1"],
};
const bid = {
  bidPrice: null,
  technicalResponse: "",
  methodologyResponse: "",
  experienceResponse: "",
  complianceDeclarations: { confirmed: false },
  lotResponses: [] as Array<{ lotId: string; price: number | null; response: string }>,
  responses: [] as Array<{ requirementId: string; responseText: string }>,
};

test("quality check flags missing mandatory answers and documents before submission", () => {
  const result = checkBidQuality(bid, context);
  assert.ok(result.critical.some(issue => issue.includes("Safety plan")));
  assert.ok(result.critical.some(issue => issue.includes("Registration certificate")));
  assert.ok(result.critical.some(issue => issue.includes("Technical response")));
  assert.ok(result.critical.some(issue => issue.includes("declaration")));
  assert.ok(result.critical.some(issue => issue.includes("at least one lot")));
  assert.ok(result.warnings.some(issue => issue.includes("overall bid price")));
});

test("advisory omissions do not block a complete mandatory bid", () => {
  const result = checkBidQuality({
    ...bid,
    technicalResponse: "Meets the specification",
    complianceDeclarations: { confirmed: true },
    lotResponses: [{ lotId: "l1", price: 1200, response: "Lot proposal" }],
    responses: [{ requirementId: "r1", responseText: "Safety plan attached" }],
  }, { ...context, uploadedDocumentIds: ["d1"] });
  assert.deepEqual(result.critical, []);
  assert.ok(result.passed.some(check => check.includes("mandatory requirement")));
  assert.ok(result.passed.some(check => check.includes("mandatory document")));
  assert.ok(result.suggestions.length > 0);
});

test("a selected lot without a price is critical even if another lot is priced", () => {
  const result = checkBidQuality({ ...bid, lotResponses: [
    { lotId: "l1", price: 100, response: "" },
    { lotId: "l2", price: null, response: "" },
  ] }, context);
  assert.ok(result.critical.some(issue => issue.includes("selected lot")));
});

test("draft and final bid references cannot point at another tender or repeat a lot", () => {
  const allowed = { requirementIds: ["r1"], criterionIds: ["c1"], lotIds: ["l1"] };
  assert.equal(bidReferencesValid({ responses: [{ requirementId: "r1", criterionId: "c1" }], lotResponses: [{ lotId: "l1" }] }, allowed), true);
  assert.equal(bidReferencesValid({ responses: [{ requirementId: "other" }], lotResponses: [] }, allowed), false);
  assert.equal(bidReferencesValid({ responses: [{ criterionId: "other" }], lotResponses: [] }, allowed), false);
  assert.equal(bidReferencesValid({ responses: [], lotResponses: [{ lotId: "l1" }, { lotId: "l1" }] }, allowed), false);
});
