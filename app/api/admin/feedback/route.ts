import {z} from "zod";
import {requireSuperAdmin} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest} from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";
const status=z.enum(["NEW","REVIEWING","RESOLVED","CLOSED"]),priority=z.enum(["LOW","NORMAL","HIGH","URGENT"]);

export async function GET(request:Request){try{
  await requireSuperAdmin(request);const params=new URL(request.url).searchParams;const selected=status.optional().parse(params.get("status")||undefined);
  const query=new URLSearchParams({select:"*",order:"created_at.desc",limit:"250"});if(selected)query.set("status",`eq.${selected}`);
  const{data}=await supabaseRest(`platform_feedback?${query}`);return Response.json({data},{headers:{"Cache-Control":"private, no-store"}});
}catch(error){return apiErrorResponse(error);}}

export async function PATCH(request:Request){try{
  await requireSuperAdmin(request);const input=z.object({id:z.string().uuid(),version:z.number().int().positive(),status,priority,adminNotes:z.string().trim().max(5000)}).parse(await request.json());
  const{data}=await supabaseRest<unknown[]>(`platform_feedback?id=eq.${input.id}&version=eq.${input.version}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status:input.status,priority:input.priority,admin_notes:input.adminNotes||null,version:input.version+1,updated_at:new Date().toISOString()})});
  if(!data.length)throw new ApiError(409,"This feedback item changed. Refresh before saving again.","feedback_conflict");
  return Response.json({data:data[0]});
}catch(error){return apiErrorResponse(error);}}
