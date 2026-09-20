import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";
const schema=z.object({code:z.string().regex(/^\d{6}$/)});
const digest=(secret:string,...values:string[])=>createHmac("sha256",secret).update(values.join("|")).digest("hex");

export async function POST(request:Request){
  try{
    const{user}=await requireUser(request);const{code}=schema.parse(await request.json());const secret=process.env.PHONE_OTP_SECRET;
    if(!secret)throw new ApiError(503,"Phone verification is temporarily unavailable.","sms_unavailable");
    const{data}=await supabaseRest<Array<{id:string;phone_e164:string;code_hash:string;attempts:number;expires_at:string}>>(`phone_verification_codes?select=id,phone_e164,code_hash,attempts,expires_at&user_id=eq.${user.id}&verified_at=is.null&invalidated_at=is.null&order=created_at.desc&limit=1`);
    const record=data[0];
    if(!record||record.attempts>=5||new Date(record.expires_at)<=new Date())throw new ApiError(400,"The verification code is invalid or expired.","invalid_otp");
    const expected=Buffer.from(record.code_hash,"hex"),actual=Buffer.from(digest(secret,user.id,record.phone_e164,code),"hex");
    const valid=expected.length===actual.length&&timingSafeEqual(expected,actual);
    if(!valid){await supabaseRest(`phone_verification_codes?id=eq.${record.id}`,{method:"PATCH",body:JSON.stringify({attempts:record.attempts+1,invalidated_at:record.attempts+1>=5?new Date().toISOString():null})});throw new ApiError(400,"The verification code is invalid or expired.","invalid_otp");}
    const verifiedAt=new Date().toISOString();
    await Promise.all([
      supabaseRest(`phone_verification_codes?id=eq.${record.id}`,{method:"PATCH",body:JSON.stringify({verified_at:verifiedAt})}),
      supabaseRest(`profiles?id=eq.${user.id}`,{method:"PATCH",body:JSON.stringify({phone:record.phone_e164,phone_e164:record.phone_e164,phone_verified_at:verifiedAt})}),
    ]);
    return Response.json({data:{verified:true}});
  }catch(error){return apiErrorResponse(error);}
}
