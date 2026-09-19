import { DailyMeetingProvider } from "./daily-provider";
import { GoogleMeetingProvider } from "./google-provider";
import type { MeetingProviderName } from "./types";

export function meetingProvider(name: MeetingProviderName) {
  return name === "google_meet" ? new GoogleMeetingProvider() : new DailyMeetingProvider();
}

export type { MeetingRecord, MeetingProviderName } from "./types";
