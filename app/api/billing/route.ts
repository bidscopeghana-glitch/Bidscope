import {z} from "zod";
import {apiErrorResponse} from "@/lib/server/api-error";
import {requireOrganizationMember,requireUser} from "@/lib/server/auth";
import {getEntitlement,recordConversionEvent} from "@/lib/server/entitlements";
import {supabaseRest} from "@/lib/server/supabase-rest";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const{user}=await requireUser(request);const organizationId=z.string().uuid().parse(new URL(request.url).searchParams.get("organizationId"));await requireOrganizationMember(user.id,organizationId);const[entitlement,{data:transactions}]=await Promise.all([getEntitlement(organizationId),supabaseRest(`payment_transactions?select=id,reference,billing_plan_code,amount_minor,currency,payment_kind,status,channel,paid_at,created_at,failure_reason&organization_id=eq.${organizationId}&order=created_at.desc&limit=100`)]);return Response.json({data:{entitlement,transactions}});}catch(error){return apiErrorResponse(error);}}
export async function POST(request:Request){try{const{user}=await requireUser(request);const input=z.object({organizationId:z.string().uuid().optional(),event:z.enum(["PRICING_VIEWED","PREMIUM_FEATURE_VIEWED"]),feature:z.string().max(100).optional()}).parse(await request.json());if(input.organizationId)await requireOrganizationMember(user.id,input.organizationId);await recordConversionEvent({userId:user.id,organizationId:input.organizationId,eventName:input.event,feature:input.feature});return Response.json({data:{recorded:true}});}catch(error){return apiErrorResponse(error);}}
