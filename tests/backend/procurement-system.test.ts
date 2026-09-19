import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, statSync } from "node:fs";
import {
  bidInputSchema,
  tenderInputSchema,
} from "../../lib/server/procurement/schemas.ts";

const base = {
  title: "Supply and installation of network equipment",
  referenceNumber: null,
  description:
    "A complete procurement scope with structured supplier requirements.",
  tenderType: "rfp" as const,
  procurementCategory: "Information technology",
  classification: "goods" as const,
  location: "Accra",
  currency: "GHS",
  estimatedBudget: 100000,
  issueDate: null,
  clarificationDeadline: null,
  submissionDeadline: new Date(Date.now() + 14 * 86400000).toISOString(),
  expectedAwardDate: null,
  expectedContractStartDate: null,
  eligibilityRequirements: "Registered companies",
  technicalRequirements: "Provide a methodology",
  commercialRequirements: "Provide a complete price",
  deliveryRequirements: "Deliver within eight weeks",
  termsAndConditions: "Buyer standard conditions",
  procurementOwnerName: "Procurement Lead",
  procurementOwnerEmail: "procurement@example.com",
  awardStructure: "single" as const,
  bidOpeningModel: "sealed" as const,
  visibility: "open" as const,
  questionsAllowed: true,
  supplierIdentityVisibleBeforeOpening: false,
  withdrawalAllowed: true,
  approvalRequired: true,
  publishAwardPublicly: false,
  lots: [],
  requirements: [],
  requiredDocuments: [],
  criteria: [
    {
      name: "Price",
      description: "",
      criterionType: "scored" as const,
      weight: 40,
      scoreMin: 0,
      scoreMax: 10,
      guidance: "",
      mandatory: true,
      section: "commercial" as const,
      displayOrder: 0,
      lotNumber: null,
    },
    {
      name: "Technical quality",
      description: "",
      criterionType: "scored" as const,
      weight: 60,
      scoreMin: 0,
      scoreMax: 10,
      guidance: "",
      mandatory: true,
      section: "technical" as const,
      displayOrder: 1,
      lotNumber: null,
    },
  ],
};

test("weighted procurement criteria must total 100 percent", () => {
  assert.equal(tenderInputSchema.safeParse(base).success, true);
  const invalid = {
    ...base,
    criteria: base.criteria.map((item, index) => ({
      ...item,
      weight: index ? 50 : 40,
    })),
  };
  assert.equal(tenderInputSchema.safeParse(invalid).success, false);
});
test("lot awards require at least one structured lot", () => {
  assert.equal(
    tenderInputSchema.safeParse({ ...base, awardStructure: "lots" }).success,
    false,
  );
  assert.equal(
    tenderInputSchema.safeParse({
      ...base,
      awardStructure: "lots",
      lots: [
        {
          lotNumber: "1",
          title: "Routers",
          description: "",
          quantity: 10,
          budget: null,
          requirements: "",
          evaluationCriteria: [],
        },
      ],
    }).success,
    true,
  );
});
test("submission deadlines must be in the future", () => {
  assert.equal(
    tenderInputSchema.safeParse({
      ...base,
      submissionDeadline: new Date(Date.now() - 1000).toISOString(),
    }).success,
    false,
  );
});
test("structured bid input preserves lots and explicit submission intent", () => {
  const parsed = bidInputSchema.parse({
    tenderId: "00000000-0000-4000-8000-000000000001",
    bidPrice: 45000,
    currency: "GHS",
    priceBreakdown: [{ label: "Equipment", amount: 40000 }],
    deliveryPeriod: "6 weeks",
    bidValidityDays: 90,
    technicalResponse: "Compliant",
    methodologyResponse: "Phased delivery",
    experienceResponse: "Three similar projects",
    complianceDeclarations: { confirmed: true },
    notes: "",
    lotResponses: [
      {
        lotId: "00000000-0000-4000-8000-000000000002",
        price: 45000,
        currency: "GHS",
        response: "All items",
      },
    ],
    responses: [],
    submit: true,
  });
  assert.equal(parsed.submit, true);
  assert.equal(parsed.lotResponses.length, 1);
});

test("procurement workflows enforce documents, approvals and outcome notices", () => {
  const route = readFileSync(
    new URL("../../app/api/procurement/route.ts", import.meta.url),
    "utf8",
  );
  const documents = readFileSync(
    new URL("../../app/api/procurement/documents/route.ts", import.meta.url),
    "utf8",
  );
  const supplier = readFileSync(
    new URL(
      "../../components/procurement/supplier-tenders.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const buyer = readFileSync(
    new URL("../../components/procurement/bid-inbox.tsx", import.meta.url),
    "utf8",
  );
  const hardening = readFileSync(
    new URL(
      "../../supabase/migrations/20260919200912_procurement_audit_hardening.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(route, /mandatory_documents_missing/);
  assert.match(route, /respond_clarification/);
  assert.match(route, /award-unsuccessful-/);
  assert.match(route, /award-approval-/);
  assert.match(route, /finalize_awards/);
  assert.match(route, /incomplete_lot_awards/);
  assert.match(route, /cancel_tender/);
  assert.match(route, /update_deadline/);
  assert.match(documents, /document_type_not_accepted/);
  assert.match(
    documents,
    /This document is available only to submitted bidders/,
  );
  assert.match(supplier, /Your secure bid documents/);
  assert.match(supplier, /Ask a private tender question/);
  assert.match(buyer, /Award recommendations/);
  assert.match(buyer, /Approve recommendation/);
  assert.match(buyer, /Finalise approved awards/);
  assert.match(hardening, /revoke all on table public\.supplier_bids from authenticated/);
  assert.match(hardening, /validate_procurement_scope/);
  assert.match(hardening, /lot already has an active award/);
});

test("buyer team management stays inside the procurement workspace", () => {
  const buyer = readFileSync(
    new URL("../../components/procurement/buyer-workspace.tsx", import.meta.url),
    "utf8",
  );
  const teamRoute = readFileSync(
    new URL("../../app/api/team/route.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(buyer, /href="\/customer\/team"/);
  assert.match(buyer, /workspace:\s*"procurement"/);
  assert.match(buyer, /window\.history\.replaceState\(\{\},\s*"",\s*"\/procurement\/team"\)/);
  assert.match(teamRoute, /body\.workspace==="procurement"\?"\/procurement\/team"/);
});

test("seller navigation does not offer tender publishing", () => {
  const shell = readFileSync(
    new URL("../../components/customer/shell.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(shell, /Post a Tender/);
  assert.doesNotMatch(shell, /\/post-tender/);
});

test("buyer workspace uses a lightweight premium visual system", () => {
  const css = readFileSync(
    new URL("../../app/procurement/procurement.css", import.meta.url),
    "utf8",
  );
  const workspace = readFileSync(
    new URL("../../components/procurement/buyer-workspace.tsx", import.meta.url),
    "utf8",
  );
  const evaluations = readFileSync(
    new URL("../../components/procurement/evaluations-workspace.tsx", import.meta.url),
    "utf8",
  );
  const meetings = readFileSync(
    new URL("../../components/procurement/procurement-meetings.tsx", import.meta.url),
    "utf8",
  );
  const artworks = [
    "buyer-procurement-boardroom.webp",
    "buyer-tender-evaluation.webp",
    "buyer-team-collaboration.webp",
  ].map((name) => new URL(`../../public/images/${name}`, import.meta.url));
  assert.match(css, /buyer-procurement-boardroom\.webp/);
  assert.match(css, /buyer-tender-evaluation\.webp/);
  assert.match(css, /buyer-team-collaboration\.webp/);
  assert.match(workspace, /pw-hero-\$\{visual\}/);
  assert.match(evaluations, /pw-hero-tenders/);
  assert.match(meetings, /pw-hero-collaboration/);
  assert.match(css, /\.pw-stat-icon/);
  assert.match(workspace, /pw-hero-mark/);
  assert.match(workspace, /pw-card-heading/);
  for (const artwork of artworks) {
    assert.ok(statSync(artwork).size < 100_000, "buyer banner must remain under 100 KB");
  }
});

test("dual-capability sellers can return to the buyer workspace", () => {
  const shell = readFileSync(
    new URL("../../components/customer/shell.tsx", import.meta.url),
    "utf8",
  );
  const data = readFileSync(
    new URL("../../components/customer/data.ts", import.meta.url),
    "utf8",
  );
  assert.match(shell, /organization\.can_procure/);
  assert.match(shell, /href="\/procurement"/);
  assert.match(shell, /Switch to procurement/);
  assert.match(data, /can_procure\?:boolean/);
});
