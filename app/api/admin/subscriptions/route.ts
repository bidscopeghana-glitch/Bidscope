import {z} from "zod";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {requireSuperAdmin} from "@/lib/server/auth";
import {listBillingPlans} from "@/lib/server/entitlements";
import {paystackConfigurationStatus,reconcilePendingPaystack} from "@/lib/server/paystack";
import {supabaseRest} from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";
const configurablePlanCodes=["pro_monthly","pro_annual","premium_monthly","premium_annual","platinum_monthly","platinum_annual","pro_launch_monthly","pro_launch_annual","premium_launch_monthly","premium_launch_annual","platinum_launch_monthly","platinum_launch_annual"] as const;
async function count(path:string){const{response}=await supabaseRest<unknown[]>(path,{count:"exact"});return Number(response.headers.get("content-range")?.split("/")[1]||0);}
function minor(input:string){if(!/^\d+(\.\d{1,2})?$/.test(input))throw new ApiError(400,"Enter a valid amount with no more than two decimal places.","invalid_price");const[whole,fraction=""]=input.split(".");return BigInt(whole)*BigInt(100)+BigInt((fraction+"00").slice(0,2));}

export async function GET(request:Request){
  try{
    await requireSuperAdmin(request);
    const since=new Date(Date.now()-30*86400000).toISOString();
    const[plans,{data:subscriptions},{data:transactions},{data:organizations},totalUsers,totalOrganizations,premiumUsers,newPremium,cancelled,pastDue,failedPayments,pricingViews,activated]=await Promise.all([
      listBillingPlans(),
      supabaseRest<Array<{id:string;organization_id:string;plan_code:string;status:string;billing_interval:string|null;amount_minor:number|null;currency:string|null;current_period_ends_at:string|null;provider:string;organization:{name:string}}>>("subscriptions?select=id,organization_id,plan_code,status,billing_interval,amount_minor,currency,current_period_ends_at,provider,organization:organizations(name)&order=updated_at.desc&limit=500"),
      supabaseRest<Array<{id:string;organization_id:string;reference:string;billing_plan_code:string;amount_minor:number;currency:string;payment_kind:string;status:string;paid_at:string|null;created_at:string}>>("payment_transactions?select=id,organization_id,reference,billing_plan_code,amount_minor,currency,payment_kind,status,paid_at,created_at&order=created_at.desc&limit=500"),
      supabaseRest<Array<{id:string;name:string;region:string|null}>>("organizations?select=id,name,region&order=name.asc&limit=1000"),
      count("profiles?select=id"),count("organizations?select=id"),count("subscriptions?select=id&plan_code=eq.premium&status=in.(ACTIVE,GRACE_PERIOD,CANCEL_AT_PERIOD_END)"),count(`subscriptions?select=id&plan_code=eq.premium&started_at=gte.${since}`),count(`subscriptions?select=id&status=in.(CANCELLED,CANCEL_AT_PERIOD_END)&updated_at=gte.${since}`),count("subscriptions?select=id&status=in.(PAST_DUE,GRACE_PERIOD)"),count(`payment_transactions?select=id&status=eq.FAILED&created_at=gte.${since}`),count(`analytics_events?select=id&event_name=eq.PRICING_VIEWED&created_at=gte.${since}`),count(`analytics_events?select=id&event_name=eq.PREMIUM_ACTIVATED&created_at=gte.${since}`),
    ]);
    const recurring=transactions.filter(transaction=>transaction.status==="SUCCESS"&&transaction.payment_kind==="RECURRING_CARD");
    const oneTime=transactions.filter(transaction=>transaction.status==="SUCCESS"&&transaction.payment_kind==="NON_RENEWING");
    const mrr=recurring.reduce((sum,transaction)=>sum+(transaction.billing_plan_code.endsWith("_annual")?Math.round(transaction.amount_minor/12):transaction.amount_minor),0);
    return Response.json({data:{provider:paystackConfigurationStatus(),productionActivation:plans.some(plan=>plan.tier==="PREMIUM"&&plan.enabled&&plan.activation_status==="LIVE")?"LIVE":"PRICING_CONFIGURATION_REQUIRED",plans,metrics:{totalUsers,freeUsers:Math.max(0,totalOrganizations-premiumUsers),premiumUsers,activeSubscriptions:subscriptions.filter(subscription=>["ACTIVE","GRACE_PERIOD","CANCEL_AT_PERIOD_END"].includes(subscription.status)).length,newPremium,cancelled,pastDue,failedPayments,mrrMinor:mrr,arrMinor:mrr*12,oneTimeMomoRevenueMinor:oneTime.reduce((sum,transaction)=>sum+transaction.amount_minor,0),conversionRate:pricingViews?Math.round(activated/pricingViews*1000)/10:0},subscriptions,transactions,organizations}});
  }catch(error){return apiErrorResponse(error);}
}

export async function PATCH(request:Request){
  try{
    const{user}=await requireSuperAdmin(request);
    const input=z.discriminatedUnion("action",[
      z.object({action:z.literal("configure_plan"),code:z.enum(configurablePlanCodes),amountGhs:z.string(),providerPlanCode:z.string().trim().max(120).nullable(),activationStatus:z.enum(["PRICING_CONFIGURATION_REQUIRED","TEST_READY","LIVE"]),enabled:z.boolean()}),
      z.object({action:z.literal("manual_grant"),organizationId:z.string().uuid(),reason:z.string().trim().min(8).max(500),startsAt:z.string().datetime(),expiresAt:z.string().datetime()}),
      z.object({action:z.literal("reconcile")}),
    ]).parse(await request.json());
    if(input.action==="configure_plan"){
      const amount=minor(input.amountGhs);
      if(amount>BigInt(Number.MAX_SAFE_INTEGER))throw new ApiError(400,"Price is too large.","invalid_price");
      if(input.activationStatus!=="PRICING_CONFIGURATION_REQUIRED"&&amount===BigInt(0))throw new ApiError(400,"A paid plan price must be greater than zero.","invalid_price");
      await supabaseRest(`billing_plans?code=eq.${input.code}`,{method:"PATCH",body:JSON.stringify({amount_minor:Number(amount),provider_plan_code:input.providerPlanCode||null,activation_status:input.activationStatus,enabled:input.enabled})});
      await supabaseRest("audit_log",{method:"POST",body:JSON.stringify({actor_user_id:user.id,action:"BILLING_PLAN_CONFIGURED",entity_type:"billing_plan",entity_id:input.code,metadata:{amount_minor:Number(amount),activation_status:input.activationStatus,enabled:input.enabled}})});
      return Response.json({data:{saved:true}});
    }
    if(input.action==="manual_grant"){
      if(Date.parse(input.expiresAt)<=Date.parse(input.startsAt))throw new ApiError(400,"Grant expiry must be after its start.","invalid_grant_period");
      await supabaseRest("subscription_manual_grants",{method:"POST",body:JSON.stringify({organization_id:input.organizationId,admin_user_id:user.id,reason:input.reason,starts_at:input.startsAt,expires_at:input.expiresAt})});
      await supabaseRest("audit_log",{method:"POST",body:JSON.stringify({actor_user_id:user.id,organization_id:input.organizationId,action:"PREMIUM_MANUAL_GRANT",entity_type:"subscription",entity_id:input.organizationId,metadata:{reason:input.reason,starts_at:input.startsAt,expires_at:input.expiresAt}})});
      return Response.json({data:{saved:true}});
    }
    const result=await reconcilePendingPaystack(50);
    await supabaseRest("audit_log",{method:"POST",body:JSON.stringify({actor_user_id:user.id,action:"PAYSTACK_RECONCILIATION_RUN",entity_type:"billing",metadata:result})});
    return Response.json({data:result});
  }catch(error){return apiErrorResponse(error);}
}
