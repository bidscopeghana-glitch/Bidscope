import {apiErrorResponse} from "@/lib/server/api-error";
import {requireSuperAdmin} from "@/lib/server/auth";
import {supabaseRest} from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";
async function count(path:string){const{response}=await supabaseRest<unknown[]>(path,{count:"exact"});return Number(response.headers.get("content-range")?.split("/")[1]||0);}

export async function GET(request:Request){
  try{
    await requireSuperAdmin(request);
    const since=new Date(Date.now()-24*60*60*1000).toISOString();
    const [users,businesses,openOpportunities,sources,degradedSources,pendingPayments,activeSubscriptions,failedDeliveries,failedSyncs,aiRequests,{data:recentBusinesses},{data:recentPayments},{data:sourceAlerts},{data:auditLog}]=await Promise.all([
      count("profiles?select=id"),count("organizations?select=id"),count(`procurement_opportunities?select=id&status=in.(OPEN,CLOSING_SOON)&deadline_at=gt.${new Date().toISOString()}`),count("procurement_sources?select=id"),count("procurement_sources?select=id&status=in.(DEGRADED,ERROR,UNAVAILABLE)"),count("payment_transactions?select=id&status=in.(PENDING,UNVERIFIED)"),count("subscriptions?select=id&status=in.(ACTIVE,GRACE_PERIOD,CANCEL_AT_PERIOD_END)"),count(`notification_deliveries?select=id&status=eq.failed&created_at=gte.${since}`),count(`source_sync_runs?select=id&status=in.(FAILED,PARTIALLY_SUCCEEDED)&started_at=gte.${since}`),count(`ai_usage?select=id&created_at=gte.${since}`),
      supabaseRest("organizations?select=id,name,region,created_at&order=created_at.desc&limit=8"),
      supabaseRest("payment_transactions?select=id,reference,billing_plan_code,amount_minor,currency,status,created_at&order=created_at.desc&limit=8"),
      supabaseRest("procurement_source_alerts?select=id,severity,alert_type,message,created_at,source:procurement_sources(name,slug)&resolved_at=is.null&order=created_at.desc&limit=8"),
      supabaseRest("audit_log?select=id,action,entity_type,entity_id,created_at&order=created_at.desc&limit=8"),
    ]);
    return Response.json({data:{window:"24 hours",metrics:{users,businesses,openOpportunities,sources,degradedSources,pendingPayments,activeSubscriptions,failedDeliveries,failedSyncs,aiRequests},recentBusinesses,recentPayments,sourceAlerts,auditLog,services:{database:"connected",payments:process.env.PAYSTACK_SECRET_KEY?"configured":"not configured",email:process.env.RESEND_API_KEY?"configured":"not configured",ai:process.env.OPENAI_API_KEY?"model configured":"grounded fallback"}}});
  }catch(error){return apiErrorResponse(error);}
}
