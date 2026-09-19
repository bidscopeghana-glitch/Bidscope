import { z } from "zod";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { meetingProvider } from "@/lib/server/meetings";
import { assertJoinWindow, meetingForUser } from "@/lib/server/meetings/access";
import { supabaseRest } from "@/lib/server/supabase-rest";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const{user}=await requireUser(request),{id}=await params;const{meeting,participant}=await meetingForUser(z.string().uuid().parse(id),user.id);assertJoinWindow(meeting);
    const{data:profiles}=await supabaseRest<Array<{full_name:string;email:string}>>(`profiles?select=full_name,email&id=eq.${user.id}&limit=1`);
    const access=await meetingProvider(meeting.provider).createJoinAccess({meeting,userId:user.id,userName:profiles[0]?.full_name||profiles[0]?.email||"BidScope participant",isHost:meeting.organizer_user_id===user.id||participant?.role==="host"});
    if(participant)await supabaseRest(`meeting_participants?id=eq.${participant.id}`,{method:"PATCH",body:JSON.stringify({response_status:"joined",joined_at:participant.joined_at||new Date().toISOString()})});
    await supabaseRest(`meetings?id=eq.${meeting.id}`,{method:"PATCH",body:JSON.stringify({status:"live"})});
    return Response.json({data:{provider:meeting.provider,url:access.url,token:access.token||null,expiresAt:access.expiresAt,meeting:{id:meeting.id,title:meeting.title,agenda:meeting.agenda,startsAt:meeting.starts_at,endsAt:meeting.ends_at}}});
  }catch(error){return apiErrorResponse(error);}
}
