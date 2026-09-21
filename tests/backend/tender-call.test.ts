import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("voice-call migration restricts sessions to tender conversation participants", () => {
  const migration = read("supabase/migrations/20260922003000_tender_voice_calls.sql");
  assert.match(migration, /create table if not exists public\.tender_call_sessions/);
  assert.match(migration, /private\.can_access_tender_conversation\(conversation_id\)/);
  assert.match(migration, /where status='active'/);
  assert.match(migration, /grant select on public\.tender_call_sessions to authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete).*authenticated/);
});

test("voice-call API issues short-lived server tokens after conversation authorization", () => {
  const route = read("app/api/tender-chat/call/route.ts");
  assert.match(route, /requireUser\(request\)/);
  assert.match(route, /conversationAccess\(user, body\.conversationId\)/);
  assert.match(route, /AGORA_APP_CERTIFICATE/);
  assert.match(route, /RtcTokenBuilder\.buildTokenWithUserAccount/);
  assert.match(route, /Math\.min\(1800/);
  assert.match(route, /tender_voice_call_started/);
  assert.match(route, /Incoming BidScope voice call/);
});

test("chat interface contains embedded voice-call controls", () => {
  const component = read("components/chat/tender-chat.tsx");
  assert.match(component, /Start voice call/);
  assert.match(component, /Join call/);
  assert.match(component, /Mute/);
  assert.match(component, /End call/);
  assert.match(component, /agora-rtc-sdk-ng/);
});
