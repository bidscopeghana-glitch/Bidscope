import test from "node:test";
import assert from "node:assert/strict";
import { amendmentFingerprint, meaningfulAmendmentChanges } from "../../lib/server/procurement/amendments.ts";
import { futureDeadlineItems, isFormattingOnlyTenderAmendment, uniqueAttentionItems } from "../../lib/customer-dashboard.ts";
import { readFileSync } from "node:fs";

test("timestamp formatting alone is not a tender amendment", () => {
  const changes = meaningfulAmendmentChanges([
    { field: "deadline_at", previous: "2026-09-16T12:00:00+00:00", current: "2026-09-16T12:00:00.000Z" },
  ]);
  assert.deepEqual(changes, []);
});

test("real amendment fingerprints are stable across timestamp formats", () => {
  const first = [{ field: "deadline_at", previous: "2026-09-16T12:00:00Z", current: "2026-09-20T12:00:00+00:00" }];
  const second = [{ field: "deadline_at", previous: "2026-09-17T12:00:00Z", current: "2026-09-20T12:00:00.000Z" }];
  assert.equal(amendmentFingerprint(first), amendmentFingerprint(second));
});

test("upcoming deadlines exclude expired and completed bids", () => {
  const now = Date.parse("2026-09-24T12:00:00Z");
  const rows = [
    { status: "PREPARING", opportunity: { deadline_at: "2026-09-15T12:00:00Z" } },
    { status: "PREPARING", opportunity: { deadline_at: "2026-09-26T12:00:00Z" } },
    { status: "SUBMITTED", opportunity: { deadline_at: "2026-09-25T12:00:00Z" } },
  ];
  assert.deepEqual(futureDeadlineItems(rows, now), [rows[1]]);
});

test("attention feed collapses duplicate unread high-priority notices", () => {
  const base = { title: "Tender deadline changed", message: "deadline at: old → new", type: "tender_amendment", priority: "urgent", related_url: "/customer/opportunity/one", read_at: null };
  const rows = [{ ...base, id: "1" }, { ...base, id: "2" }, { ...base, id: "3", read_at: "2026-09-24T10:00:00Z" }];
  assert.deepEqual(uniqueAttentionItems(rows).map((row) => row.id), ["1"]);
});

test("historical timestamp-format-only alerts are suppressed without deleting audit data", () => {
  const falseChange = { type: "tender_amendment", message: "deadline at: 2026-09-16T12:00:00+00:00 → 2026-09-16T12:00:00.000Z" };
  const realChange = { type: "tender_amendment", message: "deadline at: 2026-09-16T12:00:00Z → 2026-09-17T12:00:00Z" };
  assert.equal(isFormattingOnlyTenderAmendment(falseChange), true);
  assert.equal(isFormattingOnlyTenderAmendment(realChange), false);
});

test("the deadline workspace explains when tracked bids have no future dates", () => {
  const source = readFileSync(new URL("../../components/customer/bids.tsx", import.meta.url), "utf8");
  assert.match(source, /No upcoming deadlines/);
});
