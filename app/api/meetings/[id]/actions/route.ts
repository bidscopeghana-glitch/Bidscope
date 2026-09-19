import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { meetingForUser } from "@/lib/server/meetings/access";
import { createNotification, stableDedupe } from "@/lib/server/notifications";
import { supabaseRest } from "@/lib/server/supabase-rest";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const{user}=await requireUser(request),{id}=await params;const{meeting,participants}=await meetingForUser(z.string().uuid().parse(id),user.id);
    const input=z.object({task:z.string().trim().min(2).max(500),ownerUserId:z.string().uuid().nullable().optional(),dueAt:z.string().datetime().nullable().optional(),priority:z.enum(["low","normal","high","urgent"]).default("normal")}).parse(await request.json());
    if(input.ownerUserId&&!participants.some((participant)=>participant.user_id===input.ownerUserId))throw new ApiError(400,"Task owner must be a meeting participant.","invalid_meeting_action_owner");
    const{data}=await supabaseRest<Array<{id:string}>>("meeting_action_items",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({meeting_id:meeting.id,organization_id:meeting.organization_id,related_opportunity_id:(meeting as unknown as {related_opportunity_id?:string}).related_opportunity_id||null,task:input.task,owner_user_id:input.ownerUserId||null,due_at:input.dueAt||null,priority:input.priority,created_by:user.id})});
    if(input.ownerUserId&&data[0])await createNotification({userId:input.ownerUserId,organizationId:meeting.organization_id,type:"system",title:"Meeting action assigned",message:input.task,relatedEntityType:"meeting_action",relatedEntityId:data[0].id,relatedUrl:`/customer/meetings/${meeting.id}`,priority:input.priority==="urgent"?"urgent":"normal",frequencyOverride:"instant",dedupeKey:stableDedupe(["meeting-action",data[0].id,input.ownerUserId])});
    return Response.json({data:data[0]},{status:201});
  }catch(error){return apiErrorResponse(error);}
}
