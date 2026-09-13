import { apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { notificationUpdateSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) { try { const {user}=await requireUser(request); const {id}=await context.params; const input=notificationUpdateSchema.parse(await request.json()); const updates:Record<string,string|null>={}; if(input.read!==undefined)updates.read_at=input.read?new Date().toISOString():null;if(input.dismissed!==undefined)updates.dismissed_at=input.dismissed?new Date().toISOString():null; const {data}=await supabaseRest<unknown[]>(`notifications?id=eq.${id}&user_id=eq.${user.id}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(updates)}); return Response.json({data:data[0]||null}); } catch(error){return apiErrorResponse(error);} }
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}) { try { const {user}=await requireUser(request); const {id}=await context.params; await supabaseRest(`notifications?id=eq.${id}&user_id=eq.${user.id}`,{method:"DELETE"}); return new Response(null,{status:204}); } catch(error){return apiErrorResponse(error);} }
