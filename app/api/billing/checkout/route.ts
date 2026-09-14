import {z} from "zod";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {requireOrganizationMember,requireUser} from "@/lib/server/auth";
import {initializePaystackCheckout} from "@/lib/server/paystack";
export const dynamic="force-dynamic";
export async function POST(request:Request){try{const{user}=await requireUser(request);const input=z.object({organizationId:z.string().uuid(),billingPlanCode:z.enum(["premium_monthly","premium_annual","premium_momo_30","premium_momo_365"]),triggerFeature:z.string().max(100).optional()}).parse(await request.json());const membership=await requireOrganizationMember(user.id,input.organizationId);if(!["owner","admin"].includes(membership.role))throw new ApiError(403,"Only a business owner or administrator can change billing.","billing_admin_required");const data=await initializePaystackCheckout({userId:user.id,email:user.email,...input});return Response.json({data});}catch(error){return apiErrorResponse(error);}}
