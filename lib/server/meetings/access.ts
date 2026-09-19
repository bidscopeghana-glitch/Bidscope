import { ApiError } from "@/lib/server/api-error";
import { requireOrganizationMember } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";
import type { MeetingRecord } from "./types";

export type MeetingParticipant = { id:string; meeting_id:string; user_id:string|null; guest_email:string|null; guest_name:string|null; role:"organizer"|"host"|"attendee"; response_status:string; joined_at:string|null; left_at:string|null; attendance_seconds:number };

export async function meetingForUser(meetingId:string,userId:string) {
  const { data } = await supabaseRest<MeetingRecord[]>(`meetings?select=*&id=eq.${meetingId}&limit=1`);
  const meeting = data[0];
  if (!meeting) throw new ApiError(404,"Meeting not found.","meeting_not_found");
  await requireOrganizationMember(userId,meeting.organization_id);
  const { data: participants } = await supabaseRest<MeetingParticipant[]>(`meeting_participants?select=*&meeting_id=eq.${meeting.id}`);
  const participant = participants.find((item)=>item.user_id===userId);
  if (meeting.organizer_user_id!==userId&&!participant) throw new ApiError(403,"You are not invited to this meeting.","meeting_access_denied");
  return { meeting, participants, participant };
}

export function assertJoinWindow(meeting:MeetingRecord) {
  if (meeting.status==="cancelled") throw new ApiError(409,"This meeting was cancelled.","meeting_cancelled");
  if (meeting.status==="completed") throw new ApiError(409,"This meeting has ended.","meeting_ended");
  if (meeting.status==="provider_failed") throw new ApiError(409,"This meeting room is unavailable. Ask the organiser to retry or switch platforms.","meeting_provider_failed");
  const start=Date.parse(meeting.starts_at),end=Date.parse(meeting.ends_at),now=Date.now();
  if(now<start-15*60_000)throw new ApiError(409,"This meeting opens 15 minutes before its scheduled start.","meeting_not_open");
  if(now>end+30*60_000)throw new ApiError(409,"This meeting access window has expired.","meeting_expired");
}
