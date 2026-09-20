import {z} from "zod";
import {apiErrorResponse,ApiError} from "@/lib/server/api-error";
import {requireSuperAdmin} from "@/lib/server/auth";
import {addSeoBacklink,addSeoContent,addSeoKeyword,getSeoGrowthOverview,updateSeoItem,updateSeoSettings} from "@/lib/server/seo-growth";

export const dynamic="force-dynamic";
const createSchema=z.object({action:z.enum(["keyword","content","backlink"]),payload:z.record(z.string(),z.unknown())});
const patchSchema=z.object({action:z.enum(["settings","item"]),table:z.enum(["seo_keywords","seo_content_items","seo_backlinks","seo_experiments","seo_alerts"]).optional(),id:z.string().uuid().optional(),payload:z.record(z.string(),z.unknown())});

export async function GET(request:Request){try{await requireSuperAdmin(request);const days=Number(new URL(request.url).searchParams.get("days")||30);return Response.json({data:await getSeoGrowthOverview(days)});}catch(error){return apiErrorResponse(error)}}
export async function POST(request:Request){try{const{user}=await requireSuperAdmin(request);const input=createSchema.parse(await request.json());const data=input.action==="keyword"?await addSeoKeyword(input.payload,user.id):input.action==="content"?await addSeoContent(input.payload,user.id):await addSeoBacklink(input.payload,user.id);return Response.json({data},{status:201});}catch(error){if(error instanceof Error&&/required|URL/.test(error.message))return apiErrorResponse(new ApiError(400,error.message,"invalid_seo_item"));return apiErrorResponse(error)}}
export async function PATCH(request:Request){try{const{user}=await requireSuperAdmin(request);const input=patchSchema.parse(await request.json());if(input.action==="settings")return Response.json({data:await updateSeoSettings(input.payload,user.id)});if(!input.table||!input.id)throw new ApiError(400,"Table and item are required.","invalid_seo_item");return Response.json({data:await updateSeoItem(input.table,input.id,input.payload)});}catch(error){return apiErrorResponse(error)}}
