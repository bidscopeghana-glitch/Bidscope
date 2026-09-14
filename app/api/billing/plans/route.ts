import {apiErrorResponse} from "@/lib/server/api-error";
import {listBillingPlans} from "@/lib/server/entitlements";
import {paystackConfigurationStatus} from "@/lib/server/paystack";
export const dynamic="force-dynamic";
export async function GET(){try{const plans=await listBillingPlans();return Response.json({data:plans.map(({provider_plan_code,...plan})=>({...plan,providerConfigured:Boolean(provider_plan_code)})),provider:paystackConfigurationStatus(),productionActivation:plans.some(p=>p.tier==="PREMIUM"&&p.activation_status==="LIVE"&&p.enabled)?"LIVE":"PRICING_CONFIGURATION_REQUIRED"});}catch(error){return apiErrorResponse(error);}}
