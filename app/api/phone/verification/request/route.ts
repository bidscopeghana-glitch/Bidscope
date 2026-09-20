import { createHmac, randomInt } from "node:crypto";
import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { normalizePhoneNumber, sendSms, smsProviderConfigured } from "@/lib/server/sms";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";
const schema=z.object({countryCode:z.enum(["GH","NG","ZA","TZ","OTHER"]).default("GH"),phoneNumber:z.string().trim().min(7).max(40)});
const digest=(secret:string,...values:string[])=>createHmac("sha256",secret).update(values.join("|")).digest("hex");

export async function POST(request:Request){
  try{
    const{user}=await requireUser(request);const input=schema.parse(await request.json());
    const secret=process.env.PHONE_OTP_SECRET;
    if(!secret||!smsProviderConfigured())throw new ApiError(503,"Phone verification is temporarily unavailable.","sms_unavailable");
    const phone=normalizePhoneNumber(input.phoneNumber,input.countryCode);
    if(!phone)throw new ApiError(400,"Enter a valid mobile number including its country code.","invalid_phone");
    const now=new Date(),fifteenMinutesAgo=new Date(now.getTime()-15*60_000).toISOString(),oneHourAgo=new Date(now.getTime()-60*60_000).toISOString();
    const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
    const ipHash=digest(secret,"ip",forwarded);
    const[{data:recent},{response:ipResponse}]=await Promise.all([
      supabaseRest<Array<{resend_after:string}>>(`phone_verification_codes?select=resend_after&user_id=eq.${user.id}&created_at=gte.${fifteenMinutesAgo}&order=created_at.desc&limit=3`),
      supabaseRest<Array<{id:string}>>(`phone_verification_codes?select=id&request_ip_hash=eq.${ipHash}&created_at=gte.${oneHourAgo}`,{count:"exact"}),
    ]);
    if(recent[0]&&new Date(recent[0].resend_after)>now)throw new ApiError(429,"Please wait 60 seconds before requesting another code.","otp_cooldown");
    if(recent.length>=3||Number(ipResponse.headers.get("content-range")?.split("/")[1]||0)>=10)throw new ApiError(429,"Too many verification requests. Try again later.","otp_rate_limited");
    await supabaseRest(`phone_verification_codes?user_id=eq.${user.id}&verified_at=is.null&invalidated_at=is.null`,{method:"PATCH",body:JSON.stringify({invalidated_at:now.toISOString()})});
    const code=String(randomInt(100000,1_000_000));
    const expiresAt=new Date(now.getTime()+10*60_000).toISOString(),resendAfter=new Date(now.getTime()+60_000).toISOString();
    const{data:created}=await supabaseRest<Array<{id:string}>>("phone_verification_codes",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({user_id:user.id,phone_e164:phone,code_hash:digest(secret,user.id,phone,code),request_ip_hash:ipHash,expires_at:expiresAt,resend_after:resendAfter})});
    const record=created[0];if(!record)throw new ApiError(500,"Verification could not be started.","otp_create_failed");
    const sent=await sendSms({userId:user.id,phoneNumber:phone,eventType:"otp_verification",message:`BidScope: Your verification code is ${code}. It expires in 10 minutes. Do not share this code.`,dedupeKey:`otp:${record.id}`,metadata:{purpose:"phone_verification"}});
    if(sent.status!=="sent"){
      await supabaseRest(`phone_verification_codes?id=eq.${record.id}`,{method:"PATCH",body:JSON.stringify({invalidated_at:new Date().toISOString()})});
      throw new ApiError(503,"The verification message could not be sent. Please try again later.","otp_send_failed");
    }
    return Response.json({data:{sent:true,expiresAt,resendAfter}});
  }catch(error){return apiErrorResponse(error);}
}
