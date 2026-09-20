import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";

const schema=z.object({
  returnPath:z.enum(["/customer/meetings","/procurement/meetings"]).default("/customer/meetings"),
});

export async function POST(request:Request){
  try{
    const{user}=await requireUser(request),clientId=process.env.GOOGLE_MEET_CLIENT_ID;
    if(!clientId||!process.env.GOOGLE_MEET_CLIENT_SECRET)throw new ApiError(503,"Google Meet OAuth is not configured.","google_meet_not_configured");
    const input=schema.parse(await request.json().catch(()=>({})));
    const state=randomBytes(32).toString("base64url"),site=(process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin).replace(/\/$/,"");
    await supabaseRest("meeting_oauth_states",{method:"POST",body:JSON.stringify({state_hash:createHash("sha256").update(state).digest("hex"),user_id:user.id,return_path:input.returnPath,expires_at:new Date(Date.now()+10*60_000).toISOString()})});
    const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id",clientId);url.searchParams.set("redirect_uri",`${site}/api/meetings/google/callback`);url.searchParams.set("response_type","code");url.searchParams.set("access_type","offline");url.searchParams.set("prompt","consent");url.searchParams.set("include_granted_scopes","true");url.searchParams.set("scope","openid email https://www.googleapis.com/auth/calendar.events");url.searchParams.set("state",state);
    return Response.json({data:{url:url.toString()}});
  }catch(error){return apiErrorResponse(error);}
}
