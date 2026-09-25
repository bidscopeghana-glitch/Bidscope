import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { meetingForUser } from "@/lib/server/meetings/access";
import { meetingProvider } from "@/lib/server/meetings";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { createNotification, stableDedupe } from "@/lib/server/notifications";

export const dynamic="force-dynamic";

async function notifyDailyGuests(emails: string[], title: string, message: string) {
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_FROM_EMAIL || !emails.length) return;
  await Promise.allSettled([...new Set(emails)].map(async email => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.ALERT_FROM_EMAIL, to: [email], subject: `BidScope meeting update: ${title}`, text: `${message}\n\nIf the meeting is still scheduled, use the secure link in your original invitation. If you need help, contact the organiser.` }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error("Guest meeting update could not be delivered", response.status);
  }));
}

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
    const{user}=await requireUser(request),{id}=await params;const{meeting,participants}=await meetingForUser(z.string().uuid().parse(id),user.id);
    if(meeting.organizer_user_id!==user.id)throw new ApiError(403,"Only the organiser can change this meeting.","meeting_manage_denied");
    const input=z.object({action:z.enum(["retry","switch_google","cancel","reschedule"]),startsAt:z.string().datetime().optional(),durationMinutes:z.number().int().min(15).max(480).optional()}).parse(await request.json());
    if(input.action==="reschedule"){
      if(meeting.status!=="scheduled")throw new ApiError(409,"Only upcoming meetings with a ready provider can be rescheduled.","meeting_reschedule_denied");
      if(!input.startsAt||!input.durationMinutes)throw new ApiError(400,"Choose a new start time and duration.","meeting_time_required");
      const start=new Date(input.startsAt),end=new Date(start.getTime()+input.durationMinutes*60000);
      if(!Number.isFinite(start.getTime())||start.getTime()<=Date.now())throw new ApiError(400,"Choose a future date and time.","meeting_in_past");
      const {data:settings}=await supabaseRest<Array<{max_duration_minutes:number}>>(`meeting_settings?select=max_duration_minutes&organization_id=eq.${meeting.organization_id}&limit=1`);
      if(input.durationMinutes>(settings[0]?.max_duration_minutes||120))throw new ApiError(400,"This meeting exceeds the workspace duration limit.","meeting_duration_limit");
      const updated={...meeting,starts_at:start.toISOString(),ends_at:end.toISOString()};
      await meetingProvider(meeting.provider).updateMeeting(updated);
      try { await supabaseRest(`meetings?id=eq.${meeting.id}`,{method:"PATCH",body:JSON.stringify({starts_at:updated.starts_at,ends_at:updated.ends_at})}); }
      catch (error) { await meetingProvider(meeting.provider).updateMeeting(meeting).catch(rollback => console.error("Meeting provider rollback failed",rollback)); throw error; }
      await Promise.all(participants.filter(item=>item.user_id&&item.user_id!==user.id).map(item=>createNotification({userId:item.user_id!,organizationId:meeting.organization_id,type:"system",title:"Meeting rescheduled",message:`${meeting.title} now starts ${start.toLocaleString("en-GB",{timeZone:meeting.timezone,timeZoneName:"short"})}.`,pushEventKey:"meeting_changed",relatedEntityType:"meeting",relatedEntityId:meeting.id,relatedUrl:meeting.procurement_tender_id?`/procurement/meetings/${meeting.id}`:`/customer/meetings/${meeting.id}`,frequencyOverride:"instant",dedupeKey:stableDedupe(["meeting-rescheduled",meeting.id,item.user_id,updated.starts_at])})));
      if(meeting.provider==="daily")await notifyDailyGuests(participants.map(item=>item.guest_email).filter((email):email is string=>Boolean(email)),meeting.title,`This meeting has been rescheduled to ${start.toLocaleString("en-GB",{timeZone:meeting.timezone,timeZoneName:"short"})}.`);
      return Response.json({data:{status:"scheduled",startsAt:updated.starts_at}});
    }
    if(input.action==="cancel"){
      if(meeting.status==="cancelled")return Response.json({data:{status:"cancelled"}});
      await meetingProvider(meeting.provider).cancelMeeting(meeting);
      await supabaseRest(`meetings?id=eq.${meeting.id}`,{method:"PATCH",body:JSON.stringify({status:"cancelled",provider_status:"cancelled"})});
      await Promise.all(participants.filter((item)=>item.user_id&&item.user_id!==user.id).map((item)=>createNotification({userId:item.user_id!,organizationId:meeting.organization_id,type:"system",title:"Meeting cancelled",message:"A BidScope meeting has been cancelled. Open your workspace for details.",pushEventKey:"meeting_cancelled",relatedEntityType:"meeting",relatedEntityId:meeting.id,relatedUrl:meeting.procurement_tender_id?`/procurement/meetings/${meeting.id}`:`/customer/meetings/${meeting.id}`,frequencyOverride:"instant",dedupeKey:stableDedupe(["meeting-cancelled",meeting.id,item.user_id])})));
      if(meeting.provider==="daily")await notifyDailyGuests(participants.map(item=>item.guest_email).filter((email):email is string=>Boolean(email)),meeting.title,"This BidScope meeting has been cancelled.");
      return Response.json({data:{status:"cancelled"}});
    }
    const providerName=input.action==="switch_google"?"google_meet":meeting.provider;
    const{data:participantRows}=await supabaseRest<Array<{user_id:string|null;guest_email:string|null}>>(`meeting_participants?select=user_id,guest_email&meeting_id=eq.${meeting.id}`);
    const memberIds=participantRows.map((item)=>item.user_id).filter(Boolean) as string[];
    const{data:profiles}=memberIds.length?await supabaseRest<Array<{email:string}>>(`profiles?select=email&id=in.(${memberIds.join(",")})`):{data:[]};
    const updated={...meeting,provider:providerName,status:"scheduled"};
    const provisioned=await meetingProvider(providerName).createMeeting({meeting:updated,attendeeEmails:[...profiles.map((profile)=>profile.email),...participantRows.map((item)=>item.guest_email).filter(Boolean) as string[]]});
    await supabaseRest(`meetings?id=eq.${meeting.id}`,{method:"PATCH",body:JSON.stringify({provider:providerName,status:"scheduled",provider_status:"ready",provider_room_id:provisioned.providerRoomId||null,provider_room_name:provisioned.providerRoomName||null,provider_join_url:provisioned.joinUrl,provider_event_id:provisioned.providerEventId||null,provider_metadata:provisioned.metadata||{},provider_created_at:new Date().toISOString()})});
    await Promise.all(participants.filter((item)=>item.user_id&&item.user_id!==user.id).map((item)=>createNotification({userId:item.user_id!,organizationId:meeting.organization_id,type:"system",title:"Meeting details changed",message:"A BidScope meeting was updated. Open your workspace for the latest details.",pushEventKey:"meeting_changed",relatedEntityType:"meeting",relatedEntityId:meeting.id,relatedUrl:meeting.procurement_tender_id?`/procurement/meetings/${meeting.id}`:`/customer/meetings/${meeting.id}`,frequencyOverride:"instant",dedupeKey:stableDedupe(["meeting-changed",meeting.id,item.user_id,provisioned.providerEventId||provisioned.providerRoomId||Date.now()])})));
    return Response.json({data:{status:"scheduled",provider:providerName}});
  }catch(error){return apiErrorResponse(error);}
}
