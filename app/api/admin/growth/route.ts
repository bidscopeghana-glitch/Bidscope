import {z} from "zod";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {requireSuperAdmin} from "@/lib/server/auth";
import {createLinkedBacklink,createOrganisation,createOutreachDraft,createPartnership,getGrowthRelationships,updateGrowthRecord} from "@/lib/server/growth-relationships";

export const dynamic="force-dynamic";
const createSchema=z.object({action:z.enum(["organisation","outreach_draft","partnership","backlink"]),payload:z.record(z.string(),z.unknown())});
const patchSchema=z.object({kind:z.enum(["organisation","activity","partnership","backlink","opportunity","experiment"]),id:z.string().uuid(),payload:z.record(z.string(),z.unknown())});

export async function GET(request:Request){try{await requireSuperAdmin(request);return Response.json({data:await getGrowthRelationships()})}catch(error){return apiErrorResponse(error)}}
export async function POST(request:Request){try{const{user}=await requireSuperAdmin(request),input=createSchema.parse(await request.json());const data=input.action==="organisation"?await createOrganisation(input.payload,user.id):input.action==="outreach_draft"?await createOutreachDraft(String(input.payload.targetId||""),user.id):input.action==="partnership"?await createPartnership(input.payload,user.id):await createLinkedBacklink(input.payload,user.id);return Response.json({data},{status:201})}catch(error){if(error instanceof Error&&/required|already|valid|verify/i.test(error.message))return apiErrorResponse(new ApiError(400,error.message,"invalid_growth_record"));return apiErrorResponse(error)}}
export async function PATCH(request:Request){try{const{user}=await requireSuperAdmin(request),input=patchSchema.parse(await request.json());return Response.json({data:await updateGrowthRecord(input.kind,input.id,input.payload,user.id)})}catch(error){return apiErrorResponse(error)}}
