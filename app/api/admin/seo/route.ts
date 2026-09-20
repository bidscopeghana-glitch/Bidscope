import {z} from "zod";
import {apiErrorResponse,ApiError} from "@/lib/server/api-error";
import {requireSuperAdmin} from "@/lib/server/auth";
import {addSeoBacklink,addSeoContent,addSeoKeyword,getSeoGrowthOverview,updateSeoItem,updateSeoSettings} from "@/lib/server/seo-growth";
import {addOutreachTarget,addSearchSynonym,addSeoExperiment,addUtmLink,generateSeoReport,updateOutreachTarget} from "@/lib/server/seo-operations";

export const dynamic="force-dynamic";
const createSchema=z.object({action:z.enum(["keyword","content","backlink","outreach","utm","synonym","experiment","report"]),payload:z.record(z.string(),z.unknown())});
const patchSchema=z.object({action:z.enum(["settings","item","outreach"]),table:z.enum(["seo_keywords","seo_content_items","seo_backlinks","seo_experiments","seo_alerts"]).optional(),id:z.string().uuid().optional(),payload:z.record(z.string(),z.unknown())});

export async function GET(request:Request){try{await requireSuperAdmin(request);const days=Number(new URL(request.url).searchParams.get("days")||30);return Response.json({data:await getSeoGrowthOverview(days)});}catch(error){return apiErrorResponse(error)}}
export async function POST(request:Request){try{const{user}=await requireSuperAdmin(request);const input=createSchema.parse(await request.json());const actions={keyword:addSeoKeyword,content:addSeoContent,backlink:addSeoBacklink,outreach:addOutreachTarget,utm:addUtmLink,synonym:addSearchSynonym,experiment:addSeoExperiment} as const;const data=input.action==="report"?await generateSeoReport(String(input.payload.type)==="monthly"?"monthly":"weekly",user.id):await actions[input.action](input.payload,user.id);return Response.json({data},{status:201});}catch(error){if(error instanceof Error&&/required|URL|valid HTTP|canonical/i.test(error.message))return apiErrorResponse(new ApiError(400,error.message,"invalid_seo_item"));return apiErrorResponse(error)}}
export async function PATCH(request:Request){try{const{user}=await requireSuperAdmin(request);const input=patchSchema.parse(await request.json());if(input.action==="settings")return Response.json({data:await updateSeoSettings(input.payload,user.id)});if(!input.id)throw new ApiError(400,"Item is required.","invalid_seo_item");if(input.action==="outreach")return Response.json({data:await updateOutreachTarget(input.id,input.payload)});if(!input.table)throw new ApiError(400,"Table is required.","invalid_seo_item");return Response.json({data:await updateSeoItem(input.table,input.id,input.payload)});}catch(error){return apiErrorResponse(error)}}
