import {apiErrorResponse} from "@/lib/server/api-error";
import {requireSuperAdmin} from "@/lib/server/auth";
import {supabaseRest} from "@/lib/server/supabase-rest";
export async function GET(request:Request){try{await requireSuperAdmin(request);const{data}=await supabaseRest("prospect_segments?select=*,prospect_segment_members(count)&order=created_at.desc&limit=200");return Response.json({data});}catch(error){return apiErrorResponse(error);}}
