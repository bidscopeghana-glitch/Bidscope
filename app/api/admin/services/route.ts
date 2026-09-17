import {z} from "zod";
import {requireSuperAdmin} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest} from "@/lib/server/supabase-rest";
import type {ServiceRequest} from "@/lib/service-catalog";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{await requireSuperAdmin(request);const{data}=await supabaseRest<ServiceRequest[]>("service_requests?select=*&order=created_at.desc&limit=200");return Response.json({data},{headers:{"Cache-Control":"private, no-store"}});}catch(error){return apiErrorResponse(error);}}
export async function PATCH(request:Request){try{
 await requireSuperAdmin(request);
 const input=z.discriminatedUnion("action",[
 z.object({action:z.literal("quote"),id:z.string().uuid(),version:z.number().int().positive(),scope:z.string().trim().min(30).max(5000),amountMinor:z.number().int().min(100).max(100000000),terms:z.string().trim().min(30).max(3000),expiresAt:z.string().datetime(),turnaroundDays:z.number().int().min(1).max(365)}),
 z.object({action:z.enum(["start","complete","decline"]),id:z.string().uuid(),version:z.number().int().positive()})]).parse(await request.json());
 if(input.action==="quote"&&Date.parse(input.expiresAt)<=Date.now())throw new ApiError(400,"Quote expiry must be in the future.");
 const before=input.action==="quote"?"in.(REQUESTED,QUOTED)":input.action==="start"?"eq.ACCEPTED":input.action==="complete"?"eq.IN_PROGRESS":"in.(REQUESTED,QUOTED)";
 const patch=input.action==="quote"?{status:"QUOTED",quote_scope:input.scope,quote_amount_minor:input.amountMinor,quote_terms:input.terms,quote_expires_at:input.expiresAt,turnaround_days:input.turnaroundDays}:{status:input.action==="start"?"IN_PROGRESS":input.action==="complete"?"COMPLETED":"DECLINED"};
 const{data}=await supabaseRest<ServiceRequest[]>(`service_requests?id=eq.${input.id}&version=eq.${input.version}&status=${before}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({...patch,version:input.version+1,updated_at:new Date().toISOString()})});
 if(!data.length)throw new ApiError(409,"Request changed or this transition is not permitted. Refresh and try again.");
 return Response.json({data:data[0]});
}catch(error){return apiErrorResponse(error);}}
