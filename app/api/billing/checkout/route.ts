import {z} from "zod";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {requireOrganizationMember,requireUser} from "@/lib/server/auth";
import {initializePaystackCheckout} from "@/lib/server/paystack";
export const dynamic="force-dynamic";
const selectablePlanCodes=[
  // Legacy codes remain checkout-compatible for existing subscribers.
  "pro_monthly","pro_annual","premium_monthly","premium_annual","platinum_monthly","platinum_annual",
  "pro_launch_monthly","pro_launch_annual",
  "premium_launch_monthly","premium_launch_annual",
  "platinum_launch_monthly","platinum_launch_annual",
  "pro_momo_30","pro_momo_365",
  "premium_momo_30","premium_momo_365",
  "platinum_momo_30","platinum_momo_365",
] as const;

export async function POST(request:Request){try{const{user}=await requireUser(request);const input=z.object({organizationId:z.string().uuid(),billingPlanCode:z.enum(selectablePlanCodes),triggerFeature:z.string().max(100).optional()}).parse(await request.json());const membership=await requireOrganizationMember(user.id,input.organizationId);if(!["owner","admin"].includes(membership.role))throw new ApiError(403,"Only a business owner or administrator can change billing.","billing_admin_required");const data=await initializePaystackCheckout({userId:user.id,email:user.email,...input});return Response.json({data});}catch(error){return apiErrorResponse(error);}}
