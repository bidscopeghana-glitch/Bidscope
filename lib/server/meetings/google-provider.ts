import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/server/api-error";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { decryptSecret, encryptSecret } from "./crypto";
import type { JoinAccess, JoinAccessInput, MeetingProvider, MeetingRecord, ProviderCreateInput, ProviderMeeting } from "./types";

type Connection = { encrypted_refresh_token: string; encrypted_access_token: string | null; access_token_expires_at: string | null };

async function accessToken(userId: string) {
  const { data } = await supabaseRest<Connection[]>(`meeting_oauth_connections?select=encrypted_refresh_token,encrypted_access_token,access_token_expires_at&user_id=eq.${userId}&provider=eq.google&limit=1`);
  const connection = data[0];
  if (!connection) throw new ApiError(409, "Connect Google Calendar before scheduling a Google Meet.", "google_calendar_not_connected");
  if (connection.encrypted_access_token && connection.access_token_expires_at && Date.parse(connection.access_token_expires_at) > Date.now() + 60_000) return decryptSecret(connection.encrypted_access_token);
  const refreshToken = decryptSecret(connection.encrypted_refresh_token);
  const body = new URLSearchParams({ client_id: process.env.GOOGLE_MEET_CLIENT_ID || "", client_secret: process.env.GOOGLE_MEET_CLIENT_SECRET || "", refresh_token: refreshToken, grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const result = await response.json() as { access_token?: string; expires_in?: number };
  if (!response.ok || !result.access_token) throw new ApiError(502, "Google Calendar connection needs to be renewed.", "google_calendar_refresh_failed");
  await supabaseRest(`meeting_oauth_connections?user_id=eq.${userId}&provider=eq.google`, { method: "PATCH", body: JSON.stringify({ encrypted_access_token: encryptSecret(result.access_token), access_token_expires_at: new Date(Date.now() + (result.expires_in || 3600) * 1000).toISOString() }) });
  return result.access_token;
}

export class GoogleMeetingProvider implements MeetingProvider {
  async createMeeting({ meeting, attendeeEmails }: ProviderCreateInput): Promise<ProviderMeeting> {
    const token = await accessToken(meeting.organizer_user_id);
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bidscopeghana.com";
    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: meeting.title,
        description: `${meeting.agenda}\n\nMeeting managed in BidScope: ${site}/customer/meetings/${meeting.id}`,
        start: { dateTime: meeting.starts_at, timeZone: meeting.timezone },
        end: { dateTime: meeting.ends_at, timeZone: meeting.timezone },
        attendees: attendeeEmails.map((email) => ({ email })),
        conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
      }),
    });
    const event = await response.json() as { id?: string; htmlLink?: string; hangoutLink?: string; conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> }; error?: { message?: string } };
    if (!response.ok || !event.id) throw new ApiError(502, event.error?.message || "Google Meet could not be created.", "google_meet_create_failed");
    const joinUrl = event.hangoutLink || event.conferenceData?.entryPoints?.find((point) => point.entryPointType === "video")?.uri;
    if (!joinUrl) throw new ApiError(502, "Google is still preparing the meeting link. Retry shortly.", "google_meet_pending");
    return { joinUrl, providerEventId: event.id, metadata: { calendarEventUrl: event.htmlLink } };
  }

  async updateMeeting(meeting: MeetingRecord) {
    if (!meeting.provider_event_id) throw new ApiError(409, "This Google Calendar event is unavailable.", "google_event_missing");
    const token = await accessToken(meeting.organizer_user_id);
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(meeting.provider_event_id)}?sendUpdates=all`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ start: { dateTime: meeting.starts_at, timeZone: meeting.timezone }, end: { dateTime: meeting.ends_at, timeZone: meeting.timezone } }),
    });
    if (!response.ok) throw new ApiError(502, "Google Calendar could not reschedule the meeting.", "google_meet_update_failed");
  }

  async cancelMeeting(meeting: MeetingRecord) {
    if (!meeting.provider_event_id) return;
    const token = await accessToken(meeting.organizer_user_id);
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(meeting.provider_event_id)}?sendUpdates=all`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok && response.status !== 404 && response.status !== 410) throw new ApiError(502, "Google Calendar could not cancel the meeting. Please try again.", "google_meet_cancel_failed");
  }

  async createJoinAccess({ meeting }: JoinAccessInput): Promise<JoinAccess> {
    if (!meeting.provider_join_url) throw new ApiError(409, "The Google Meet link is not ready.", "meeting_room_not_ready");
    return { url: meeting.provider_join_url, expiresAt: meeting.ends_at };
  }
}
