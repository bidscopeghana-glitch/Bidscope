import { apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireUser } from "@/lib/server/auth";
import { watchedEntitySchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";
export async function GET(request:Request){try{const{user}=await requireUser(request);const{data}=await supabaseRest<unknown[]>(`watched_entities?select=*&user_id=eq.${user.id}&order=created_at.desc`);return Response.json({data});}catch(error){return apiErrorResponse(error);}}
export async function POST(request:Request){try{const{user}=await requireUser(request);const input=watchedEntitySchema.parse(await request.json());if(input.organizationId)await requireOrganizationMember(user.id,input.organizationId);const{data}=await supabaseRest<unknown[]>("watched_entities",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({user_id:user.id,organization_id:input.organizationId||null,entity_type:input.entityType,entity_id:input.entityId||null,entity_name:input.entityName||null})});return Response.json({data:data[0]},{status:201});}catch(error){return apiErrorResponse(error);}}
export async function DELETE(request:Request){try{const{user}=await requireUser(request);const id=new URL(request.url).searchParams.get("id");if(!id)return Response.json({error:"id is required."},{status:400});await supabaseRest(`watched_entities?id=eq.${id}&user_id=eq.${user.id}`,{method:"DELETE"});return new Response(null,{status:204});}catch(error){return apiErrorResponse(error);}}
