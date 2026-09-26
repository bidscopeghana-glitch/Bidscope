import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { supplierClarificationView } from "../../lib/server/procurement/clarifications.ts";

test("participant-wide clarification omits private supplier and bid identifiers", () => {
  const view = supplierClarificationView({
    id: "public-1", tender_id: "t1", kind: "buyer_response",
    subject: "Anonymous delivery question", message: "Delivery is due in 30 days.",
    status: "answered", visibility: "all_participants", created_at: "2026-09-26",
    response_to_id: "private-question", requester_user_id: "supplier-user",
    requester_organization_id: "supplier-org", recipient_organization_id: "supplier-org",
    bid_id: "supplier-bid", attachment_paths: ["private/document.pdf"],
  });
  assert.equal(view.response_to_id, null);
  assert.ok(!("requester_user_id" in view));
  assert.ok(!("requester_organization_id" in view));
  assert.ok(!("bid_id" in view));
  assert.ok(!("attachment_paths" in view));
  assert.equal(view.message, "Delivery is due in 30 days.");
});

test("clarification route keeps invitation and buyer-manager checks at the API boundary", () => {
  const route = readFileSync(new URL("../../app/api/procurement/route.ts", import.meta.url), "utf8");
  assert.match(route, /resource === "clarifications"[\s\S]*tender_invitations\?select=id[\s\S]*clarification_forbidden/);
  assert.match(route, /input\.action === "publish_clarification"[\s\S]*requireTenderManager\(user, original\.tender_id\)/);
  assert.match(route, /data: isBuyer \? data : data\.map\(supplierClarificationView\)/);
  assert.match(route, /invalid_clarification_bid/);
});
