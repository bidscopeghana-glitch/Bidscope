import { createHash } from "node:crypto";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { encryptSecret } from "@/lib/server/meetings/crypto";
import { supabaseRest } from "@/lib/server/supabase-rest";

export async function GET(request:Request){
  const requestUrl=new URL(request.url),site=(process.env.NEXT_PUBLIC_SITE_URL||requestUrl.origin).replace(/\/$/,"");
  try{
    const state=requestUrl.searchParams.get("state"),code=requestUrl.searchParams.get("code");
    if(!state||!code)throw new ApiError(400,"Google Calendar connection was cancelled or invalid.","google_oauth_invalid");
    const stateHash=createHash("sha256").update(state).digest("hex");
    const{data}=await supabaseRest<Array<{user_id:string;return_path:string;expires_at:string}>>(`meeting_oauth_states?select=*&state_hash=eq.${stateHash}&limit=1`),saved=data[0];
    if(!saved||Date.parse(saved.expires_at)<Date.now())throw new ApiError(400,"Google Calendar connection has expired. Start again.","google_oauth_expired");
    const body=new URLSearchParams({code,client_id:process.env.GOOGLE_MEET_CLIENT_ID||"",client_secret:process.env.GOOGLE_MEET_CLIENT_SECRET||"",redirect_uri:`${site}/api/meetings/google/callback`,grant_type:"authorization_code"});
    const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
    const token=await response.json() as {access_token?:string;refresh_token?:string;expires_in?:number;scope?:string;id_token?:string;error_description?:string};
    if(!response.ok||!token.access_token||!token.refresh_token)throw new ApiError(502,token.error_description||"Google did not provide long-term calendar access.","google_oauth_failed");
    const profileResponse=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:`Bearer ${token.access_token}`}});const profile=await profileResponse.json() as {email?:string};
    await supabaseRest("meeting_oauth_connections?on_conflict=user_id,provider",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({user_id:saved.user_id,provider:"google",encrypted_refresh_token:encryptSecret(token.refresh_token),encrypted_access_token:encryptSecret(token.access_token),access_token_expires_at:new Date(Date.now()+(token.expires_in||3600)*1000).toISOString(),scopes:(token.scope||"").split(" ").filter(Boolean),provider_email:profile.email||null})});
    await supabaseRest(`meeting_oauth_states?state_hash=eq.${stateHash}`,{method:"DELETE"});
    return Response.redirect(`${site}${saved.return_path}?calendar=connected`);
  }catch(error){const response=apiErrorResponse(error);const payload=await response.json().catch(()=>({error:"Google Calendar could not be connected."})) as {error?:string};return Response.redirect(`${site}/customer/meetings?calendar=error&message=${encodeURIComponent(payload.error||"Connection failed")}`);}
}
