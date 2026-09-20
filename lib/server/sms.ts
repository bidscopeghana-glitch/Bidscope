import { createHmac } from "node:crypto";
import { supabaseRest } from "./supabase-rest";

export const SMS_EVENT_TYPES = [
  "bid_received",
  "meeting_reminder",
  "bid_awarded",
  "otp_verification",
  "matching_tender",
  "watched_tender_closing",
] as const;

export type SmsEventType=(typeof SMS_EVENT_TYPES)[number];
export const SMS_EVENT_ALLOWLIST=new Set<string>(SMS_EVENT_TYPES);

type SmsInput={
  userId:string;
  phoneNumber:string;
  eventType:SmsEventType;
  message:string;
  dedupeKey:string;
  notificationId?:string|null;
  deliveryId?:string|null;
  metadata?:Record<string,unknown>;
};

type SmsResult=
  |{status:"sent";providerMessageId:string|null}
  |{status:"skipped"|"failed";reason:string;transient?:boolean;errorCode?:string};

export function normalizePhoneNumber(value:string,countryCode="GH"){
  const trimmed=value.trim();
  if(!trimmed)return null;
  const leadingPlus=trimmed.startsWith("+");
  let digits=trimmed.replace(/\D/g,"");
  const dialCodes:Record<string,string>={GH:"233",NG:"234",ZA:"27",TZ:"255"};
  const dial=dialCodes[countryCode.toUpperCase()];
  if(digits.startsWith("00"))digits=digits.slice(2);
  if(dial&&!leadingPlus){
    if(digits.startsWith("0"))digits=`${dial}${digits.slice(1)}`;
    else if(!digits.startsWith(dial))digits=`${dial}${digits}`;
  }
  if(dial&&digits.startsWith(dial)&&digits.length>=10&&digits.length<=15)return`+${digits}`;
  if(leadingPlus&&digits.length>=8&&digits.length<=15)return`+${digits}`;
  if(digits.length>=8&&digits.length<=15&&!digits.startsWith("0"))return`+${digits}`;
  return null;
}

export function maskPhoneNumber(phone:string){return phone.length>7?`${phone.slice(0,4)}••••${phone.slice(-3)}`:"••••";}

function configured(){return Boolean(process.env.ARKESEL_API_KEY&&process.env.ARKESEL_SENDER_ID&&process.env.ARKESEL_SENDER_ID.length<=11);}
export function smsProviderConfigured(){return configured();}

export async function phoneForUser(userId:string){
  const{data}=await supabaseRest<Array<{phone_e164:string|null;phone_verified_at:string|null}>>(`profiles?select=phone_e164,phone_verified_at&id=eq.${userId}&limit=1`);
  const profile=data[0];
  return profile?.phone_e164&&profile.phone_verified_at?profile.phone_e164:null;
}

export async function sendSms(input:SmsInput):Promise<SmsResult>{
  if(!SMS_EVENT_ALLOWLIST.has(input.eventType))return{status:"failed",reason:"SMS is not permitted for this event.",errorCode:"unsupported_event"};
  const phone=normalizePhoneNumber(input.phoneNumber);
  if(!phone)return{status:"failed",reason:"The destination mobile number is invalid.",errorCode:"invalid_phone"};
  if(!configured())return{status:"skipped",reason:"The SMS provider is not configured."};

  const{data:rows}=await supabaseRest<Array<{id:string;status:string;provider_message_id:string|null}>>("sms_delivery_logs?on_conflict=dedupe_key",{
    method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=representation"},body:JSON.stringify({
      notification_id:input.notificationId||null,delivery_id:input.deliveryId||null,user_id:input.userId,event_type:input.eventType,
      recipient_masked:maskPhoneNumber(phone),status:"sending",dedupe_key:input.dedupeKey,metadata:input.metadata||{},
    }),
  });
  let log=rows[0];
  if(!log){
    const{data:existing}=await supabaseRest<Array<{id:string;status:string;provider_message_id:string|null}>>(`sms_delivery_logs?select=id,status,provider_message_id&dedupe_key=eq.${encodeURIComponent(input.dedupeKey)}&limit=1`);
    log=existing[0];
    if(log&&["sending","sent","delivered"].includes(log.status))return{status:"sent",providerMessageId:log.provider_message_id};
    if(!log)return{status:"skipped",reason:"This SMS event has already been processed."};
    await supabaseRest(`sms_delivery_logs?id=eq.${log.id}`,{method:"PATCH",body:JSON.stringify({status:"sending",error_code:null,error_message:null})});
  }

  const site=process.env.NEXT_PUBLIC_SITE_URL||"https://www.bidscopeghana.com";
  const webhookSecret=process.env.ARKESEL_WEBHOOK_SECRET;
  const callbackToken=webhookSecret?createHmac("sha256",webhookSecret).update("delivery-callback").digest("hex"):null;
  const callbackUrl=new URL("/api/webhooks/arkesel",site);
  if(callbackToken)callbackUrl.searchParams.set("token",callbackToken);
  try{
    const response=await fetch(process.env.ARKESEL_SMS_ENDPOINT||"https://sms.arkesel.com/api/v2/sms/send",{
      method:"POST",signal:AbortSignal.timeout(8_000),headers:{"api-key":process.env.ARKESEL_API_KEY!,"Content-Type":"application/json"},
      body:JSON.stringify({sender:process.env.ARKESEL_SENDER_ID,message:input.message,recipients:[phone],callback_url:callbackUrl.toString()}),
    });
    const payload=await response.json().catch(()=>({})) as {status?:string;message?:string;data?:Array<{id?:string}>|{id?:string}};
    const item=Array.isArray(payload.data)?payload.data.find(value=>value?.id):payload.data;
    const providerMessageId=item?.id||null;
    if(!response.ok||payload.status==="error"||!providerMessageId){
      const transient=response.status===429||response.status>=500;
      const reason=payload.message||`Arkesel returned ${response.status}.`;
      await supabaseRest(`sms_delivery_logs?id=eq.${log.id}`,{method:"PATCH",body:JSON.stringify({status:"failed",error_code:`http_${response.status}`,error_message:reason})});
      return{status:"failed",reason,transient,errorCode:`http_${response.status}`};
    }
    await supabaseRest(`sms_delivery_logs?id=eq.${log.id}`,{method:"PATCH",body:JSON.stringify({status:"sent",provider_message_id:providerMessageId,sent_at:new Date().toISOString(),error_code:null,error_message:null})});
    return{status:"sent",providerMessageId};
  }catch(error){
    const timeout=error instanceof Error&&(error.name==="TimeoutError"||error.name==="AbortError");
    const reason=timeout?"Arkesel timed out.":"Arkesel could not be reached.";
    await supabaseRest(`sms_delivery_logs?id=eq.${log.id}`,{method:"PATCH",body:JSON.stringify({status:"failed",error_code:timeout?"timeout":"network_error",error_message:reason})});
    return{status:"failed",reason,transient:true,errorCode:timeout?"timeout":"network_error"};
  }
}
