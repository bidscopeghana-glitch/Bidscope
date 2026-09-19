import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireUser } from "@/lib/server/auth";
import { primaryOrganization } from "@/lib/server/entitlements";
import { meetingProvider, type MeetingRecord, type MeetingProviderName } from "@/lib/server/meetings";
import { createNotification, stableDedupe } from "@/lib/server/notifications";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";

const schema=z.object({
  title:z.string().trim().min(3).max(200),
  startsAt:z.string().datetime(),
  durationMinutes:z.number().int().min(15).max(480),
  timezone:z.string().trim().min(1).max(80).default("Africa/Accra"),
  provider:z.enum(["daily","google_meet"]),
  meetingType:z.enum(["team","tender","partner"]).default("team"),
  participantUserIds:z.array(z.string().uuid()).max(199).default([]),
  guestEmails:z.array(z.string().trim().toLowerCase().email().max(320)).max(50).default([]),
  relatedOpportunityId:z.string().uuid().nullable().optional(),
  relatedPartnerOrganizationId:z.string().uuid().nullable().optional(),
  agenda:z.string().trim().max(10000).default(""),
  reminderMinutes:z.number().int().min(0).max(10080).default(30),
  recurrenceRule:z.string().trim().max(300).nullable().optional(),
  recordingEnabled:z.boolean().default(false),
  transcriptionEnabled:z.boolean().default(false),
  waitingRoomEnabled:z.boolean().default(true),
});

async function settings(organizationId:string){
  const{data}=await supabaseRest<Array<{enabled:boolean;max_duration_minutes:number;max_participants:number;monthly_participant_minutes:number;recording_allowed:boolean;transcription_allowed:boolean}>>(`meeting_settings?select=*&organization_id=eq.${organizationId}&limit=1`);
  return data[0]||{enabled:true,max_duration_minutes:Number(process.env.BIDSCOPE_MEET_MAX_DURATION_MINUTES||120),max_participants:Number(process.env.BIDSCOPE_MEET_MAX_PARTICIPANTS||20),monthly_participant_minutes:Number(process.env.BIDSCOPE_MEET_MONTHLY_PARTICIPANT_MINUTES||10000),recording_allowed:false,transcription_allowed:false};
}

export async function GET(request:Request){
  try{
    const{user}=await requireUser(request);const membership=await primaryOrganization(user.id);
    if(!membership)return Response.json({data:[],settings:null,googleConnected:false});
    const[{data:meetings},guardrails,{data:connection}]=await Promise.all([
      supabaseRest<Array<Record<string,unknown>>>(`meetings?select=id,organization_id,organizer_user_id,provider,meeting_type,title,agenda,timezone,starts_at,ends_at,status,related_opportunity_id,related_partner_organization_id,reminder_minutes,waiting_room_enabled,recording_enabled,transcription_enabled,provider_status,created_at&organization_id=eq.${membership.organization_id}&order=starts_at.asc`),
      settings(membership.organization_id),
      supabaseRest<Array<{user_id:string}>>(`meeting_oauth_connections?select=user_id&user_id=eq.${user.id}&provider=eq.google&limit=1`),
    ]);
    const ids=meetings.map((item)=>String(item.id));
    const{data:participants}=ids.length?await supabaseRest<Array<Record<string,unknown>>>(`meeting_participants?select=id,meeting_id,user_id,guest_email,guest_name,role,response_status,joined_at,left_at,attendance_seconds&meeting_id=in.(${ids.join(",")})`):{data:[] as Array<Record<string,unknown>>};
    const visible=meetings.filter((meeting)=>meeting.organizer_user_id===user.id||participants.some((participant)=>participant.meeting_id===meeting.id&&participant.user_id===user.id));
    return Response.json({data:visible.map((meeting)=>({...meeting,participants:participants.filter((participant)=>participant.meeting_id===meeting.id)})),settings:guardrails,googleConnected:Boolean(connection[0])});
  }catch(error){return apiErrorResponse(error);}
}

async function sendGuestInvite(email:string,title:string,startsAt:string,token:string){
  if(!process.env.RESEND_API_KEY||!process.env.ALERT_FROM_EMAIL)return;
  const site=process.env.NEXT_PUBLIC_SITE_URL||"https://www.bidscopeghana.com";
  const joinUrl=`${site}/meetings/join/${encodeURIComponent(token)}`;
  await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.ALERT_FROM_EMAIL,to:[email],subject:`BidScope meeting invitation: ${title}`,html:`<div style="font-family:Arial,sans-serif;color:#17362d"><h2>You have been invited to a BidScope meeting.</h2><p><strong>${title}</strong></p><p>${new Date(startsAt).toLocaleString("en-GB")}</p><p><a href="${joinUrl}" style="display:inline-block;background:#116149;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Join BidScope Meet</a></p><p>This secure link is for you only.</p></div>`})});
}

export async function POST(request:Request){
  try{
    const{user}=await requireUser(request);const membership=await primaryOrganization(user.id);
    if(!membership)throw new ApiError(400,"Create a business profile before scheduling meetings.","profile_required");
    await requireOrganizationMember(user.id,membership.organization_id);
    const input=schema.parse(await request.json()),guardrails=await settings(membership.organization_id);
    if(!guardrails.enabled)throw new ApiError(403,"BidScope Meet is disabled for this workspace.","meetings_disabled");
    if(input.durationMinutes>guardrails.max_duration_minutes)throw new ApiError(400,`Meetings are limited to ${guardrails.max_duration_minutes} minutes.`,"meeting_duration_limit");
    if(1+input.participantUserIds.length+input.guestEmails.length>guardrails.max_participants)throw new ApiError(400,`This workspace allows up to ${guardrails.max_participants} participants per meeting.`,"meeting_participant_limit");
    if(input.recordingEnabled&&!guardrails.recording_allowed)throw new ApiError(403,"Recording is not enabled for this workspace.","recording_not_allowed");
    if(input.transcriptionEnabled&&!guardrails.transcription_allowed)throw new ApiError(403,"Transcription is not enabled for this workspace.","transcription_not_allowed");
    const memberIds=[...new Set(input.participantUserIds.filter((id)=>id!==user.id))];
    if(memberIds.length){const{data}=await supabaseRest<Array<{user_id:string}>>(`organization_members?select=user_id&organization_id=eq.${membership.organization_id}&user_id=in.(${memberIds.join(",")})`);if(data.length!==memberIds.length)throw new ApiError(400,"Every selected team attendee must belong to this workspace.","invalid_meeting_attendee");}
    const startsAt=new Date(input.startsAt),endsAt=new Date(startsAt.getTime()+input.durationMinutes*60_000);
    const row={organization_id:membership.organization_id,organizer_user_id:user.id,provider:input.provider,meeting_type:input.meetingType,title:input.title,agenda:input.agenda,timezone:input.timezone,starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),related_opportunity_id:input.relatedOpportunityId||null,related_partner_organization_id:input.relatedPartnerOrganizationId||null,recurrence_rule:input.recurrenceRule||null,reminder_minutes:input.reminderMinutes,waiting_room_enabled:input.waitingRoomEnabled,recording_enabled:input.recordingEnabled,transcription_enabled:input.transcriptionEnabled,provider_status:"creating"};
    const{data:created}=await supabaseRest<MeetingRecord[]>("meetings",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});
    const meeting=created[0];if(!meeting)throw new ApiError(500,"Meeting could not be saved.","meeting_create_failed");
    const guestTokens=input.guestEmails.map((email)=>({email,token:randomBytes(32).toString("base64url")}));
    const participantRows=[{meeting_id:meeting.id,user_id:user.id,role:"organizer",response_status:"accepted"},...memberIds.map((id)=>({meeting_id:meeting.id,user_id:id,role:"attendee",response_status:"invited"})),...guestTokens.map(({email,token})=>({meeting_id:meeting.id,guest_email:email,role:"attendee",response_status:"invited",guest_token_hash:createHash("sha256").update(token).digest("hex"),guest_token_expires_at:new Date(endsAt.getTime()+30*60_000).toISOString()}))];
    await supabaseRest("meeting_participants",{method:"POST",body:JSON.stringify(participantRows)});
    const{data:profiles}=memberIds.length?await supabaseRest<Array<{id:string;email:string;full_name:string}>>(`profiles?select=id,email,full_name&id=in.(${memberIds.join(",")})`):{data:[]};
    try{
      const provider=meetingProvider(input.provider as MeetingProviderName);const provisioned=await provider.createMeeting({meeting,attendeeEmails:[...profiles.map((profile)=>profile.email),...input.guestEmails]});
      await supabaseRest(`meetings?id=eq.${meeting.id}`,{method:"PATCH",body:JSON.stringify({provider_room_id:provisioned.providerRoomId||null,provider_room_name:provisioned.providerRoomName||null,provider_join_url:provisioned.joinUrl,provider_event_id:provisioned.providerEventId||null,provider_metadata:provisioned.metadata||{},provider_status:"ready",provider_created_at:new Date().toISOString()})});
    }catch(error){await supabaseRest(`meetings?id=eq.${meeting.id}`,{method:"PATCH",body:JSON.stringify({status:"provider_failed",provider_status:"failed"})});return Response.json({data:{id:meeting.id,status:"provider_failed"},error:error instanceof Error?error.message:"The meeting platform could not be created."},{status:201});}
    await Promise.all([...memberIds.map((id)=>createNotification({userId:id,organizationId:membership.organization_id,type:"system",title:"Meeting invitation",message:`You have been invited to ${input.title}.`,relatedEntityType:"meeting",relatedEntityId:meeting.id,relatedUrl:`/customer/meetings/${meeting.id}`,priority:"high",frequencyOverride:"instant",dedupeKey:stableDedupe(["meeting-invite",meeting.id,id])})),...guestTokens.map(({email,token})=>sendGuestInvite(email,input.title,startsAt.toISOString(),token))]);
    return Response.json({data:{id:meeting.id,status:"scheduled"}},{status:201});
  }catch(error){return apiErrorResponse(error);}
}
