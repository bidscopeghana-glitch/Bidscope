import { z } from "zod";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { meetingForUser } from "@/lib/server/meetings/access";
import { supabaseRest } from "@/lib/server/supabase-rest";

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const{user}=await requireUser(request),{id}=await params;const{meeting}=await meetingForUser(z.string().uuid().parse(id),user.id);const{content}=z.object({content:z.string().max(50000)}).parse(await request.json());
    await supabaseRest("meeting_notes?on_conflict=meeting_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({meeting_id:meeting.id,content,updated_by:user.id,updated_at:new Date().toISOString()})});
    return Response.json({data:{saved:true,updatedAt:new Date().toISOString()}});
  }catch(error){return apiErrorResponse(error);}
}
