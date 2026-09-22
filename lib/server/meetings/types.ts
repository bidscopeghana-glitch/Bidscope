export type MeetingProviderName = "daily" | "google_meet";

export type MeetingRecord = {
  id: string;
  organization_id: string;
  procurement_tender_id?: string | null;
  organizer_user_id: string;
  provider: MeetingProviderName;
  title: string;
  agenda: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  provider_room_id: string | null;
  provider_room_name: string | null;
  provider_join_url: string | null;
  provider_event_id: string | null;
  recording_enabled: boolean;
  transcription_enabled: boolean;
  waiting_room_enabled: boolean;
};

export type ProviderCreateInput = {
  meeting: MeetingRecord;
  attendeeEmails: string[];
};

export type ProviderMeeting = {
  providerRoomId?: string | null;
  providerRoomName?: string | null;
  joinUrl: string;
  providerEventId?: string | null;
  metadata?: Record<string, unknown>;
};

export type JoinAccessInput = {
  meeting: MeetingRecord;
  userId: string;
  userName: string;
  isHost: boolean;
};

export type JoinAccess = { url: string; token?: string; expiresAt: string };

export interface MeetingProvider {
  createMeeting(input: ProviderCreateInput): Promise<ProviderMeeting>;
  updateMeeting(meeting: MeetingRecord): Promise<void>;
  cancelMeeting(meeting: MeetingRecord): Promise<void>;
  createJoinAccess(input: JoinAccessInput): Promise<JoinAccess>;
}
