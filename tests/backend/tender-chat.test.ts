import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("managed tender chat is participant restricted and bid scoped", () => {
  const migration = read("supabase/migrations/20260921225221_managed_tender_chat.sql");
  assert.match(migration, /create table if not exists public\.tender_conversations/);
  assert.match(migration, /supplier_bid_id uuid not null unique references public\.supplier_bids/);
  assert.match(migration, /create table if not exists public\.tender_messages/);
  assert.match(migration, /alter table public\.tender_conversations enable row level security/);
  assert.match(migration, /private\.can_access_tender_conversation/);
  assert.match(migration, /sender_user_id=auth\.uid\(\)/);
  assert.match(migration, /created_by=\(select auth\.uid\(\)\)/);
  assert.match(migration, /Chat is unavailable while this bid remains sealed/);
  assert.match(migration, /revoke all on public\.tender_conversations,public\.tender_messages from anon,authenticated/);
  assert.match(migration, /revoke execute on function private\.can_access_tender_conversation\(uuid\) from public,anon/);
});

test("chat API rejects external notices and sealed or draft bids", () => {
  const route = read("app/api/tender-chat/route.ts");
  assert.match(route, /supplier_bids\?select=/);
  assert.match(route, /tenderById\(bid\.tender_id\)/);
  assert.match(route, /sealed_bid_chat_unavailable/);
  assert.match(route, /bid_not_submitted/);
  assert.match(route, /conversation_access_denied/);
  assert.doesNotMatch(route, /procurement_opportunities/);
});

test("buyer and seller workspaces expose only managed tender messages", () => {
  const buyer = read("components/procurement/buyer-workspace.tsx");
  const seller = read("components/customer/navigation.ts");
  const inbox = read("components/procurement/bid-inbox.tsx");
  const tenders = read("components/procurement/supplier-tenders.tsx");
  const chat = read("components/chat/tender-chat.tsx");
  assert.match(buyer, /Tender Messages/);
  assert.match(seller, /Tender Messages/);
  assert.match(inbox, /Message supplier/);
  assert.match(tenders, /Message buyer/);
  assert.match(chat, /BIDSCOPE MANAGED PROCUREMENT/);
  assert.match(chat, /Participant restricted/);
  assert.match(chat, /maxLength=\{4000\}/);
});
