import {apiErrorResponse} from "@/lib/server/api-error";
import {requireSuperAdmin} from "@/lib/server/auth";
import {supabaseRest} from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  try{
    const{user}=await requireSuperAdmin(request);
    const query=new URLSearchParams({select:"full_name",id:`eq.${user.id}`,limit:"1"});
    const{data}=await supabaseRest<Array<{full_name:string|null}>>(`profiles?${query}`);
    return Response.json({data:{id:user.id,email:user.email,name:data[0]?.full_name||"BidScope Administrator",role:"BUILDER_ADMIN",permissions:["platform_overview","customer_access","procurement_sources","billing_plans","subscriptions","alerts","ai_operations","audit_log"]}});
  }catch(error){return apiErrorResponse(error);}
}
