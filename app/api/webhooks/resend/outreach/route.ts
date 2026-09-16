import {Webhook} from "svix";
import {apiErrorResponse,ApiError} from "@/lib/server/api-error";
import {supabaseRest,encodeFilter} from "@/lib/server/supabase-rest";
import {normalizeEmail} from "@/lib/server/outreach/intelligence";

export const runtime="nodejs";
type Event={type:string;created_at:string;data:{email_id?:string;to?:string[];[key:string]:unknown}};
export async function POST(request:Request){
 try{
  const secret=process.env.RESEND_WEBHOOK_SECRET;
  if(!secret)throw new ApiError(503,"Webhook verification is not configured.","webhook_unavailable");
  const raw=await request.text(),eventId=request.headers.get("svix-id"),timestamp=request.headers.get("svix-timestamp"),signature=request.headers.get("svix-signature");
  if(!eventId||!timestamp||!signature)throw new ApiError(400,"Missing webhook signature.","invalid_webhook");
  const event=new Webhook(secret).verify(raw,{"svix-id":eventId,"svix-timestamp":timestamp,"svix-signature":signature}) as unknown as Event;
  const messageId=event.data.email_id||null;
  const{data:messages}=messageId?await supabaseRest<Array<{id:string;prospect_id:string;campaign_id:string}>>(`campaign_messages?provider_message_id=eq.${encodeFilter(messageId)}&select=id,prospect_id,campaign_id&limit=1`):{data:[]};
  const message=messages[0];
  await supabaseRest("email_events?on_conflict=provider,provider_event_id",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({provider:"resend",provider_event_id:eventId,provider_message_id:messageId,campaign_message_id:message?.id||null,event_type:event.type,occurred_at:event.created_at||new Date().toISOString(),payload:event})});
  if(message){
   const statusMap:Record<string,Record<string,unknown>>={"email.delivered":{status:"delivered",delivered_at:event.created_at},"email.opened":{status:"opened",opened_at:event.created_at},"email.clicked":{status:"clicked",clicked_at:event.created_at},"email.bounced":{status:"bounced",bounced_at:event.created_at},"email.complained":{status:"complained"}};
   if(statusMap[event.type])await supabaseRest(`campaign_messages?id=eq.${encodeFilter(message.id)}`,{method:"PATCH",body:JSON.stringify(statusMap[event.type])});
   if(event.type==="email.bounced"||event.type==="email.complained"){
    const email=normalizeEmail(event.data.to?.[0]);
    if(email){
     const reason=event.type==="email.bounced"?"Hard Bounce":"Spam Complaint";
     await supabaseRest("suppression_list?on_conflict=normalized_email",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({email,normalized_email:email,reason,source:"resend_webhook",prospect_id:message.prospect_id,campaign_id:message.campaign_id})});
     await supabaseRest(`prospects?id=eq.${encodeFilter(message.prospect_id)}`,{method:"PATCH",body:JSON.stringify({do_not_contact:true,bounced_at:event.type==="email.bounced"?event.created_at:null,outreach_status:"suppressed"})});
     await supabaseRest(`campaign_recipients?campaign_id=eq.${encodeFilter(message.campaign_id)}&prospect_id=eq.${encodeFilter(message.prospect_id)}`,{method:"PATCH",body:JSON.stringify({status:"stopped",stopped_reason:reason,stopped_at:event.created_at})});
    }
   }
  }
  return Response.json({received:true});
 }catch(error){return apiErrorResponse(error);}
}
