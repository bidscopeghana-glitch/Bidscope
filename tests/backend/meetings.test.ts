import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path:string)=>readFileSync(path,"utf8");

test("BidScope Meet schema persists meetings, attendance, notes, actions, usage and OAuth securely",()=>{
  const migration=read("supabase/migrations/20260919090000_bidscope_meet.sql");
  for(const table of ["meeting_settings","meetings","meeting_participants","meeting_notes","meeting_action_items","meeting_usage_events","meeting_provider_events","meeting_oauth_connections","meeting_oauth_states"]){
    assert.match(migration,new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(migration,/alter table public\.meetings enable row level security/);
  assert.match(migration,/security definer set search_path=public/);
  assert.match(migration,/revoke all on public\.meetings[\s\S]+from anon, authenticated/);
  assert.match(migration,/grant select \(id,organization_id,organizer_user_id[\s\S]+on public\.meetings to authenticated/);
  assert.doesNotMatch(migration,/(AIza|sk-|gsk_)[A-Za-z0-9_-]{10,}/);
});

test("meeting providers keep API keys server-side and create scoped private BidScope rooms",()=>{
  const daily=read("lib/server/meetings/daily-provider.ts");
  const google=read("lib/server/meetings/google-provider.ts");
  const env=read(".env.example");
  assert.match(daily,/process\.env\.DAILY_API_KEY/);
  assert.match(daily,/privacy:\s*"private"/);
  assert.match(daily,/room_name/);
  assert.match(daily,/eject_at_token_exp:\s*true/);
  assert.match(google,/conferenceDataVersion=1/);
  assert.match(google,/process\.env\.GOOGLE_MEET_CLIENT_SECRET/);
  assert.match(env,/DAILY_API_KEY=/);
  assert.doesNotMatch(env,/NEXT_PUBLIC_(?:DAILY|GOOGLE_MEET)/);
});

test("meeting UI uses BidScope branding and supports explicit invitation responses",()=>{
  const workspace=read("components/meetings/meetings-workspace.tsx");
  const room=read("components/meetings/meeting-room.tsx");
  assert.match(workspace,/provider==="daily"\?"BidScope Meet":"Google Meet"/);
  assert.match(workspace,/>Accept</);
  assert.match(workspace,/>Tentative</);
  assert.match(workspace,/>Decline</);
  assert.match(room,/import\("@daily-co\/daily-js"\)/);
  assert.doesNotMatch(workspace,/>Daily</);
});

test("external tenders cannot enter the managed meeting workflow",()=>{
  const detail=read("components/customer/detail.tsx");
  const route=read("app/api/meetings/route.ts");
  assert.doesNotMatch(detail,/customer\/meetings\?schedule=1&opportunity=/);
  assert.match(detail,/External tender/);
  assert.match(detail,/Apply on official portal/);
  assert.match(route,/external_tender_meeting_not_allowed/);
});

test("buyer meeting navigation stays inside the procurement workspace",()=>{
  const procurement=read("components/procurement/procurement-meetings.tsx");
  const shell=read("components/procurement/buyer-workspace.tsx");
  assert.match(procurement,/href={`\/procurement\/meetings\/\$\{m\.id\}`}/);
  assert.doesNotMatch(procurement,/href="\/customer\/meetings"/);
  assert.match(shell,/<ProcurementMeetings meetingId={identifier}/);
});
