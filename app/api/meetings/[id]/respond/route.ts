import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { meetingForUser } from "@/lib/server/meetings/access";
import { supabaseRest } from "@/lib/server/supabase-rest";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const{user}=await requireUser(request),{id}=await params,{participant}=await meetingForUser(z.string().uuid().parse(id),user.id);
    if(!participant)throw new ApiError(400,"The organiser does not need to respond to their own invitation.","meeting_response_not_required");
    const{response}=z.object({response:z.enum(["accepted","tentative","declined"])}).parse(await request.json());
    await supabaseRest(`meeting_participants?id=eq.${participant.id}`,{method:"PATCH",body:JSON.stringify({response_status:response})});
    return Response.json({data:{response}});
  }catch(error){return apiErrorResponse(error);}
}
