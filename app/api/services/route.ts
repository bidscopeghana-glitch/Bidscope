import {z} from "zod";
import {requireUser} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest} from "@/lib/server/supabase-rest";
import {SERVICE_CATALOG,SERVICE_CODES,type ServiceRequest} from "@/lib/service-catalog";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:Request){try{const{user}=await requireUser(request);const{data}=await supabaseRest<ServiceRequest[]>(`service_requests?select=*&user_id=eq.${user.id}&order=created_at.desc&limit=100`);return Response.json({data},{headers});}catch(error){return apiErrorResponse(error);}}
export async function POST(request:Request){try{
 const{user}=await requireUser(request);
 const input=z.object({serviceCode:z.enum(SERVICE_CODES),brief:z.string().trim().min(30).max(5000),deliverables:z.array(z.string().max(120)).min(1).max(3),quantity:z.number().int().min(1).max(100),requestedDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()}).parse(await request.json());
 const service=SERVICE_CATALOG.find(item=>item.code===input.serviceCode)!;
 if(input.deliverables.some(value=>!(service.deliverables as readonly string[]).includes(value)))throw new ApiError(400,"Select deliverables from this service.");
 if(input.requestedDate&&(!Number.isFinite(Date.parse(input.requestedDate))||input.requestedDate<new Date().toISOString().slice(0,10)))throw new ApiError(400,"Choose a valid future date.");
 const{data:recent}=await supabaseRest<{id:string}[]>(`service_requests?select=id&user_id=eq.${user.id}&created_at=gte.${new Date(Date.now()-86400000).toISOString()}&limit=10`);
 if(recent.length>=10)throw new ApiError(429,"Daily request limit reached. Please contact support.");
 const{data}=await supabaseRest<ServiceRequest[]>("service_requests",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({user_id:user.id,service_code:input.serviceCode,brief:input.brief,deliverables:[...new Set(input.deliverables)],quantity:input.quantity,requested_date:input.requestedDate})});
 return Response.json({data:data[0]},{status:201,headers});
}catch(error){return apiErrorResponse(error);}}
export async function PATCH(request:Request){try{
 const{user}=await requireUser(request);const input=z.object({id:z.string().uuid(),version:z.number().int().positive(),action:z.enum(["accept","decline"]),agreed:z.boolean().optional()}).parse(await request.json());
 if(input.action==="accept"&&!input.agreed)throw new ApiError(400,"Confirm that you accept the quoted scope, fee and terms.");
 const query=new URLSearchParams({id:`eq.${input.id}`,user_id:`eq.${user.id}`,version:`eq.${input.version}`,status:"eq.QUOTED"});
 if(input.action==="accept")query.set("quote_expires_at",`gt.${new Date().toISOString()}`);
 const{data}=await supabaseRest<ServiceRequest[]>(`service_requests?${query}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status:input.action==="accept"?"ACCEPTED":"DECLINED",version:input.version+1,accepted_at:input.action==="accept"?new Date().toISOString():null,updated_at:new Date().toISOString()})});
 if(!data.length)throw new ApiError(409,"This quote changed, expired or is no longer available. Refresh before continuing.");
 return Response.json({data:data[0]},{headers});
}catch(error){return apiErrorResponse(error);}}
