import {apiErrorResponse} from "@/lib/server/api-error";
import {requireSuperAdmin} from "@/lib/server/auth";
import {supabaseRest} from "@/lib/server/supabase-rest";
export async function GET(request:Request){try{await requireSuperAdmin(request);const{data}=await supabaseRest<Array<{id:string;name:string;country_code:string|null}>>("prospect_segments?select=*,prospect_segment_members(count)&order=created_at.desc&limit=200");const seen=new Set<string>();const unique=data.filter(segment=>{const key=`${segment.country_code||"Global"}|${segment.name}`;if(seen.has(key))return false;seen.add(key);return true;});return Response.json({data:unique});}catch(error){return apiErrorResponse(error);}}
