import {z} from "zod";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {requireUser,requireOrganizationMember} from "@/lib/server/auth";
import {supabaseRest,supabaseRpc} from "@/lib/server/supabase-rest";
import {requireEntitlement} from "@/lib/server/entitlements";
import {ANSWER_CATEGORIES,type LibraryAnswer,type AnswerVersion} from "@/lib/response-library";
export const dynamic="force-dynamic";
const uuid=z.string().uuid();
const schema=z.object({organizationId:uuid,action:z.enum(["create","save","approve","archive"]),id:uuid.optional(),revision:z.number().int().positive().optional(),value:z.object({title:z.string().trim().min(1).max(200),category:z.enum(ANSWER_CATEGORIES),tags:z.array(z.string().trim().min(1).max(60)).max(20),content:z.string().trim().min(1).max(30000),reviewDate:z.string().date().nullable()}).optional()});
export async function GET(request:Request){try{
 const{user,accessToken}=await requireUser(request),organizationId=uuid.parse(new URL(request.url).searchParams.get("organizationId"));
 const membership=await requireOrganizationMember(user.id,organizationId);await requireEntitlement(organizationId,"bid_workspace",user);
 const[{data:answers},{data:versions}]=await Promise.all([
  supabaseRest<LibraryAnswer[]>(`response_library?organization_id=eq.${organizationId}&archived=eq.false&order=updated_at.desc&limit=200`,{accessToken,serviceRole:false}),
  supabaseRest<AnswerVersion[]>(`response_library_versions?organization_id=eq.${organizationId}&order=approved_at.desc&limit=1000`,{accessToken,serviceRole:false})
 ]);
 return Response.json({data:answers,versions,canApprove:["owner","admin"].includes(membership.role)},{headers:{"Cache-Control":"private, no-store"}});
}catch(error){return apiErrorResponse(error);}}
export async function POST(request:Request){try{
 const{user}=await requireUser(request),input=schema.parse(await request.json());
 const membership=await requireOrganizationMember(user.id,input.organizationId);await requireEntitlement(input.organizationId,"bid_workspace",user);
 if(input.action!=="create"&&(!input.id||!input.revision))throw new ApiError(400,"Answer and revision are required.","invalid_answer");
 if(["create","save"].includes(input.action)&&!input.value)throw new ApiError(400,"Answer content is required.","invalid_answer");
 if(["approve","archive"].includes(input.action)&&!["owner","admin"].includes(membership.role))throw new ApiError(403,"An owner or administrator must approve or archive answers.","approval_required");
 const{data}=await supabaseRpc("mutate_response_library",{p_actor:user.id,p_organization:input.organizationId,p_action:input.action,p_id:input.id||null,p_revision:input.revision||null,p_value:input.value||{}});
 return Response.json({data},{headers:{"Cache-Control":"private, no-store"}});
}catch(error){return apiErrorResponse(error);}}
