import {z} from "zod";
import {requireUser} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {primaryOrganization} from "@/lib/server/entitlements";
import {supabaseRest} from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";
const category=z.enum(["GENERAL","TENDER_DATA","AI_ANALYSIS","ALERTS","BILLING","BUYER_WORKSPACE","TECHNICAL","FEATURE_REQUEST"]);

export async function GET(request:Request){try{
  const{user}=await requireUser(request);
  const query=new URLSearchParams({select:"id,category,subject,message,rating,status,created_at,updated_at",user_id:`eq.${user.id}`,order:"created_at.desc",limit:"25"});
  const{data}=await supabaseRest(`platform_feedback?${query}`);
  return Response.json({data},{headers:{"Cache-Control":"private, no-store"}});
}catch(error){return apiErrorResponse(error);}}

export async function POST(request:Request){try{
  const{user}=await requireUser(request);
  const input=z.object({category,subject:z.string().trim().min(3).max(160),message:z.string().trim().min(10).max(5000),rating:z.number().int().min(1).max(5).nullable().optional(),pageUrl:z.string().trim().max(500).optional()}).parse(await request.json());
  const since=new Date(Date.now()-60*60*1000).toISOString();
  const{response}=await supabaseRest(`platform_feedback?select=id&user_id=eq.${user.id}&created_at=gte.${encodeURIComponent(since)}`,{count:"exact"});
  const recent=Number(response.headers.get("content-range")?.split("/")[1]||0);
  if(recent>=5)throw new ApiError(429,"You have sent several feedback messages recently. Please try again in an hour.","feedback_rate_limited");
  const membership=await primaryOrganization(user.id);
  const{data}=await supabaseRest("platform_feedback",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({user_id:user.id,organization_id:membership?.organization_id||null,user_email:user.email,category:input.category,subject:input.subject,message:input.message,rating:input.rating||null,page_url:input.pageUrl||null})});
  return Response.json({data:(data as unknown[])[0]},{status:201});
}catch(error){return apiErrorResponse(error);}}
