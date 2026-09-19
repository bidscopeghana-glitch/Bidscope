import { ApiError } from "@/lib/server/api-error";
import type { JoinAccess, JoinAccessInput, MeetingProvider, MeetingRecord, ProviderCreateInput, ProviderMeeting } from "./types";

const base = () => (process.env.DAILY_API_BASE_URL || "https://api.daily.co/v1").replace(/\/$/, "");

async function dailyRequest<T>(path: string, init: RequestInit = {}) {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new ApiError(503, "BidScope Meet is not configured yet.", "meeting_provider_unavailable");
  const response = await fetch(`${base()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as T & { error?: string; info?: string };
  if (!response.ok) {
    console.error("Meeting provider request failed", response.status, path, result.error || result.info || "unknown");
    throw new ApiError(502, "BidScope Meet could not be created. You can retry or choose Google Meet.", "meeting_provider_failed");
  }
  return result;
}

function epochs(meeting: MeetingRecord) {
  const start = Math.floor(Date.parse(meeting.starts_at) / 1000);
  const end = Math.floor(Date.parse(meeting.ends_at) / 1000);
  return { nbf: start - 15 * 60, exp: end + 30 * 60 };
}

export class DailyMeetingProvider implements MeetingProvider {
  async createMeeting({ meeting }: ProviderCreateInput): Promise<ProviderMeeting> {
    const { nbf, exp } = epochs(meeting);
    const properties:Record<string,unknown>={nbf,exp,eject_at_room_exp:true,enable_prejoin_ui:true,enable_chat:true,enable_emoji_reactions:true,enable_transcription_storage:meeting.transcription_enabled,max_participants:Math.max(2,Number(process.env.BIDSCOPE_MEET_MAX_PARTICIPANTS||20))};
    if(meeting.recording_enabled)properties.enable_recording="cloud";
    const room = await dailyRequest<{ id: string; name: string; url: string }>("/rooms", {
      method: "POST",
      body: JSON.stringify({
        privacy: "private",
        properties,
      }),
    });
    return { providerRoomId: room.id, providerRoomName: room.name, joinUrl: room.url, metadata: { privacy: "private" } };
  }

  async updateMeeting(meeting: MeetingRecord) {
    if (!meeting.provider_room_name) return;
    const { nbf, exp } = epochs(meeting);
    await dailyRequest(`/rooms/${encodeURIComponent(meeting.provider_room_name)}`, { method: "POST", body: JSON.stringify({ properties: { nbf, exp, eject_at_room_exp: true } }) });
  }

  async cancelMeeting(meeting: MeetingRecord) {
    if (!meeting.provider_room_name) return;
    await dailyRequest(`/rooms/${encodeURIComponent(meeting.provider_room_name)}`, { method: "DELETE" });
  }

  async createJoinAccess({ meeting, userId, userName, isHost }: JoinAccessInput): Promise<JoinAccess> {
    if (!meeting.provider_room_name || !meeting.provider_join_url) throw new ApiError(409, "This BidScope Meet room is not ready.", "meeting_room_not_ready");
    const { nbf, exp } = epochs(meeting);
    const result = await dailyRequest<{ token: string }>("/meeting-tokens", {
      method: "POST",
      body: JSON.stringify({ properties: { room_name: meeting.provider_room_name, user_id: userId.slice(0, 64), user_name: userName.slice(0, 80), is_owner: isHost, nbf, exp, eject_at_token_exp: true, enable_screenshare: true } }),
    });
    return { url: meeting.provider_join_url, token: result.token, expiresAt: new Date(exp * 1000).toISOString() };
  }
}
