import {z} from "zod";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {requireOrganizationMember,requireUser} from "@/lib/server/auth";
import {cancelPaystackSubscription} from "@/lib/server/paystack";
export const dynamic="force-dynamic";
export async function POST(request:Request){try{const{user}=await requireUser(request);const{organizationId}=z.object({organizationId:z.string().uuid()}).parse(await request.json());const membership=await requireOrganizationMember(user.id,organizationId);if(!["owner","admin"].includes(membership.role))throw new ApiError(403,"Only a business owner or administrator can cancel billing.","billing_admin_required");const data=await cancelPaystackSubscription(organizationId);return Response.json({data});}catch(error){return apiErrorResponse(error);}}
