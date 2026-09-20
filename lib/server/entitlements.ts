import {ApiError} from "./api-error.ts";
import {supabaseRest,supabaseRpc} from "./supabase-rest.ts";
import {BIDSCOPE_ADMIN_EMAIL,type AuthenticatedUser} from "./auth.ts";

export const PREMIUM_FEATURES=["advanced_feed","best_match","advanced_matching","smart_alerts","follow_buyers","buyer_intelligence","bid_advisor","procurement_radar","change_monitoring","readiness_score","tender_intelligence_report","ai_assistant","bid_workspace","international_eligibility","market_intelligence","csv_exports","multi_recipient_alerts","tender_source_access","tender_documents","incumbent_intelligence","document_analysis","partner_marketplace","bid_writer","advanced_alerts"] as const;
export type EntitlementFeature=typeof PREMIUM_FEATURES[number];
export type SubscriptionStatus="FREE"|"PENDING"|"ACTIVE"|"PAST_DUE"|"GRACE_PERIOD"|"CANCEL_AT_PERIOD_END"|"CANCELLED"|"EXPIRED"|"PAYMENT_FAILED"|"INCOMPLETE";
type Plan={code:string;tier:"FREE"|"PREMIUM";name:string;description:string;billing_interval:string;payment_kind:string;currency:string;amount_minor:number|null;provider_plan_code:string|null;features:Record<string,boolean>;limits:Record<string,number>;access_days:number|null;activation_status:string;enabled:boolean};
type Subscription={id:string;organization_id:string;plan_code:string;status:SubscriptionStatus;provider:string;provider_customer_code:string|null;provider_subscription_code:string|null;provider_plan_code:string|null;billing_interval:string|null;currency:string|null;amount_minor:number|null;started_at:string|null;current_period_starts_at:string|null;current_period_ends_at:string|null;cancel_at_period_end:boolean;cancelled_at:string|null;last_payment_at:string|null;next_payment_at:string|null;grace_period_end:string|null;payment_method_summary:Record<string,unknown>;metadata:Record<string,unknown>};
export async function primaryOrganization(userId:string){const{data}=await supabaseRest<Array<{organization_id:string;role:string}>>(`organization_members?select=organization_id,role&user_id=eq.${userId}&order=created_at.asc&limit=1`);return data[0]||null;}
export async function listBillingPlans(){const{data}=await supabaseRest<Plan[]>("billing_plans?select=*&order=amount_minor.asc.nullslast");return data;}
async function planByCode(code:string){const{data}=await supabaseRest<Plan[]>(`billing_plans?select=*&code=eq.${encodeURIComponent(code)}&limit=1`);return data[0]||null;}
function periodValid(subscription:Subscription,now=Date.now()){if(["ACTIVE","CANCEL_AT_PERIOD_END"].includes(subscription.status))return !subscription.current_period_ends_at||Date.parse(subscription.current_period_ends_at)>now;if(subscription.status==="GRACE_PERIOD")return Boolean(subscription.grace_period_end&&Date.parse(subscription.grace_period_end)>now);return false;}

async function isBuilderAdmin(actor?:AuthenticatedUser){
 if(!actor||actor.email.trim().toLowerCase()!==BIDSCOPE_ADMIN_EMAIL)return false;
 const{data}=await supabaseRest<Array<{is_super_admin:boolean}>>(`profiles?select=is_super_admin&id=eq.${actor.id}&limit=1`);
 return data[0]?.is_super_admin===true;
}

export async function getEntitlement(organizationId:string,actor?:AuthenticatedUser){
 const [{data:subscriptions},{data:grants},free]=await Promise.all([
  supabaseRest<Subscription[]>(`subscriptions?select=*&organization_id=eq.${organizationId}&limit=1`),
  supabaseRest<Array<{id:string;starts_at:string;expires_at:string}>>(`subscription_manual_grants?select=id,starts_at,expires_at,revoked_at&organization_id=eq.${organizationId}&revoked_at=is.null&starts_at=lte.${new Date().toISOString()}&expires_at=gt.${new Date().toISOString()}&order=expires_at.desc&limit=1`),
  planByCode("free")
 ]);
 if(await isBuilderAdmin(actor)){
  const adminPlan=await planByCode("platinum_monthly")||free;
  if(!adminPlan)throw new ApiError(503,"Subscription configuration is unavailable.","billing_configuration_unavailable");
  return{organizationId,tier:"PREMIUM" as const,plan:adminPlan,subscription:null,status:"ACTIVE" as SubscriptionStatus,manualGrant:null,adminOverride:true,features:Object.fromEntries(PREMIUM_FEATURES.map(feature=>[feature,true])) as Record<EntitlementFeature,boolean>,limits:adminPlan.limits};
 }
 const subscription=subscriptions[0]||null;const manualGrant=grants[0]||null;const billingCode=String(subscription?.metadata?.billing_plan_code||subscription?.plan_code||"").toLowerCase();const premium=Boolean(manualGrant||(subscription&&/^(pro|premium|platinum)(?:_launch)?_(?:monthly|annual|momo_30|momo_365)$/.test(billingCode)&&periodValid(subscription)));
 let plan=free;if(premium){const code=billingCode||"platinum_monthly";plan=await planByCode(code)||await planByCode("platinum_monthly")||free;}
 if(!plan)throw new ApiError(503,"Subscription configuration is unavailable.","billing_configuration_unavailable");
 return{organizationId,tier:premium?"PREMIUM" as const:"FREE" as const,plan,subscription,status:subscription?.status||"FREE" as SubscriptionStatus,manualGrant,adminOverride:false,features:premium?plan.features:free?.features||{},limits:premium?plan.limits:free?.limits||{}};
}

export async function hasEntitlement(organizationId:string,feature:EntitlementFeature,actor?:AuthenticatedUser){const entitlement=await getEntitlement(organizationId,actor);return{allowed:Boolean(entitlement.features[feature]),entitlement};}
export async function requireEntitlement(organizationId:string,feature:EntitlementFeature,actor?:AuthenticatedUser){const result=await hasEntitlement(organizationId,feature,actor);if(!result.allowed)throw new ApiError(402,"Upgrade your BidScope plan to use this feature.","premium_required");return result.entitlement;}
export function getPlanLimit(entitlement:Awaited<ReturnType<typeof getEntitlement>>,key:string){const value=entitlement.limits[key];return Number.isFinite(value)?Number(value):0;}
export async function requireResourceCapacity(input:{organizationId:string;limitKey:string;table:string;filter?:string;selectColumn?:string;actor?:AuthenticatedUser}){const entitlement=await getEntitlement(input.organizationId,input.actor);const limit=getPlanLimit(entitlement,input.limitKey);const suffix=input.filter?`&${input.filter}`:"";const{response}=await supabaseRest<unknown[]>(`${input.table}?select=${input.selectColumn||"id"}&organization_id=eq.${input.organizationId}${suffix}`,{count:"exact"});const used=Number(response.headers.get("content-range")?.split("/")[1]||0);if(used>=limit)throw new ApiError(402,`Your plan limit has been reached.`,"plan_limit_reached");return{entitlement,used,limit};}
export async function requireUserResourceCapacity(input:{userId:string;organizationId:string;limitKey:string;table:string;actor?:AuthenticatedUser}){const entitlement=await getEntitlement(input.organizationId,input.actor),limit=getPlanLimit(entitlement,input.limitKey);const{response}=await supabaseRest<unknown[]>(`${input.table}?select=id&user_id=eq.${input.userId}`,{count:"exact"});const used=Number(response.headers.get("content-range")?.split("/")[1]||0);if(used>=limit)throw new ApiError(402,`Your plan limit has been reached.`,"plan_limit_reached");return{entitlement,used,limit};}
export async function getUsageAllowance(organizationId:string,feature:string,actor?:AuthenticatedUser){const entitlement=await getEntitlement(organizationId,actor);const limit=getPlanLimit(entitlement,"ai_analyses_per_period");const start=entitlement.subscription?.current_period_starts_at||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString();const end=entitlement.subscription?.current_period_ends_at||new Date(new Date().getFullYear(),new Date().getMonth()+1,1).toISOString();const{data}=await supabaseRest<Array<{usage_count:number}>>(`entitlement_usage?select=usage_count&organization_id=eq.${organizationId}&feature=eq.${encodeURIComponent(feature)}&period_start=eq.${encodeURIComponent(start)}&limit=1`);const used=data[0]?.usage_count||0;return{entitlement,used,limit,remaining:Math.max(0,limit-used),periodStart:start,periodEnd:end};}
export async function recordSuccessfulUsage(input:{organizationId:string;feature:string;periodStart:string;periodEnd:string}){await supabaseRpc("increment_entitlement_usage",{p_organization_id:input.organizationId,p_feature:input.feature,p_period_start:input.periodStart,p_period_end:input.periodEnd});}
export async function recordConversionEvent(input:{userId:string;organizationId?:string|null;eventName:string;feature?:string;metadata?:Record<string,unknown>}){await supabaseRest("analytics_events",{method:"POST",body:JSON.stringify({user_id:input.userId,organization_id:input.organizationId||null,event_name:input.eventName,metadata:{upgrade_feature:input.feature||"Other",...(input.metadata||{})}})});}
