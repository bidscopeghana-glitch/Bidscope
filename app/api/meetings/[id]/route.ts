import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { meetingForUser } from "@/lib/server/meetings/access";
import { meetingProvider } from "@/lib/server/meetings";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const{user}=await requireUser(request),{id}=await params;const{meeting,participants}=await meetingForUser(z.string().uuid().parse(id),user.id);
    const[{data:profiles},{data:notes},{data:actions}]=await Promise.all([
      supabaseRest<Array<{id:string;full_name:string;email:string}>>(`profiles?select=id,full_name,email&id=in.(${participants.map((item)=>item.user_id).filter(Boolean).join(",")||"00000000-0000-0000-0000-000000000000"})`),
      supabaseRest<Array<{content:string;updated_at:string}>>(`meeting_notes?select=content,updated_at&meeting_id=eq.${meeting.id}&limit=1`),
      supabaseRest<Array<Record<string,unknown>>>(`meeting_action_items?select=*&meeting_id=eq.${meeting.id}&order=created_at.asc`),
    ]);
    return Response.json({data:{...meeting,provider_room_id:undefined,provider_room_name:undefined,provider_join_url:undefined,provider_metadata:undefined,currentParticipant:participants.find((participant)=>participant.user_id===user.id)||null,participants:participants.map((participant)=>({...participant,profile:profiles.find((profile)=>profile.id===participant.user_id)||null,guest_token_hash:undefined})),notes:notes[0]||{content:"",updated_at:null},actions}});
  }catch(error){return apiErrorResponse(error);}
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const{user}=await requireUser(request),{id}=await params;const{meeting}=await meetingForUser(z.string().uuid().parse(id),user.id);
    if(meeting.organizer_user_id!==user.id)throw new ApiError(403,"Only the organiser can change this meeting.","meeting_manage_denied");
    const input=z.object({action:z.enum(["retry","switch_google","cancel"])}).parse(await request.json());
    if(input.action==="cancel"){
      await meetingProvider(meeting.provider).cancelMeeting(meeting).catch(()=>{});
      await supabaseRest(`meetings?id=eq.${meeting.id}`,{method:"PATCH",body:JSON.stringify({status:"cancelled",provider_status:"cancelled"})});
      return Response.json({data:{status:"cancelled"}});
    }
    const providerName=input.action==="switch_google"?"google_meet":meeting.provider;
    const{data:participantRows}=await supabaseRest<Array<{user_id:string|null;guest_email:string|null}>>(`meeting_participants?select=user_id,guest_email&meeting_id=eq.${meeting.id}`);
    const memberIds=participantRows.map((item)=>item.user_id).filter(Boolean) as string[];
    const{data:profiles}=memberIds.length?await supabaseRest<Array<{email:string}>>(`profiles?select=email&id=in.(${memberIds.join(",")})`):{data:[]};
    const updated={...meeting,provider:providerName,status:"scheduled"};
    const provisioned=await meetingProvider(providerName).createMeeting({meeting:updated,attendeeEmails:[...profiles.map((profile)=>profile.email),...participantRows.map((item)=>item.guest_email).filter(Boolean) as string[]]});
    await supabaseRest(`meetings?id=eq.${meeting.id}`,{method:"PATCH",body:JSON.stringify({provider:providerName,status:"scheduled",provider_status:"ready",provider_room_id:provisioned.providerRoomId||null,provider_room_name:provisioned.providerRoomName||null,provider_join_url:provisioned.joinUrl,provider_event_id:provisioned.providerEventId||null,provider_metadata:provisioned.metadata||{},provider_created_at:new Date().toISOString()})});
    return Response.json({data:{status:"scheduled",provider:providerName}});
  }catch(error){return apiErrorResponse(error);}
}
