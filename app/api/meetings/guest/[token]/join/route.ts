import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { meetingProvider, type MeetingRecord } from "@/lib/server/meetings";
import { assertJoinWindow } from "@/lib/server/meetings/access";
import { supabaseRest } from "@/lib/server/supabase-rest";

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
  try{
    const{token}=await params,hash=createHash("sha256").update(z.string().min(32).max(256).parse(token)).digest("hex");
    const{data}=await supabaseRest<Array<{id:string;meeting_id:string;guest_email:string;guest_name:string|null;role:"host"|"attendee";guest_token_expires_at:string}>>(`meeting_participants?select=id,meeting_id,guest_email,guest_name,role,guest_token_expires_at&guest_token_hash=eq.${hash}&limit=1`),participant=data[0];
    if(!participant||Date.parse(participant.guest_token_expires_at)<Date.now())throw new ApiError(403,"This secure meeting invitation is invalid or expired.","guest_invitation_invalid");
    const{data:meetings}=await supabaseRest<MeetingRecord[]>(`meetings?select=*&id=eq.${participant.meeting_id}&limit=1`),meeting=meetings[0];if(!meeting)throw new ApiError(404,"Meeting not found.","meeting_not_found");assertJoinWindow(meeting);
    const access=await meetingProvider(meeting.provider).createJoinAccess({meeting,userId:participant.id,userName:participant.guest_name||participant.guest_email.split("@")[0],isHost:participant.role==="host"});
    await supabaseRest(`meeting_participants?id=eq.${participant.id}`,{method:"PATCH",body:JSON.stringify({response_status:"joined",joined_at:new Date().toISOString()})});
    return Response.json({data:{meeting:{id:meeting.id,title:meeting.title,agenda:meeting.agenda,startsAt:meeting.starts_at,endsAt:meeting.ends_at,provider:meeting.provider},url:access.url,token:access.token||null}});
  }catch(error){return apiErrorResponse(error);}
}
