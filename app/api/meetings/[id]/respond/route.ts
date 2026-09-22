import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { meetingForUser } from "@/lib/server/meetings/access";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { createNotification, stableDedupe } from "@/lib/server/notifications";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const{user}=await requireUser(request),{id}=await params,{participant,meeting}=await meetingForUser(z.string().uuid().parse(id),user.id);
    if(!participant)throw new ApiError(400,"The organiser does not need to respond to their own invitation.","meeting_response_not_required");
    const{response}=z.object({response:z.enum(["accepted","tentative","declined"])}).parse(await request.json());
    await supabaseRest(`meeting_participants?id=eq.${participant.id}`,{method:"PATCH",body:JSON.stringify({response_status:response})});
    if(participant.response_status!==response)await createNotification({userId:meeting.organizer_user_id,organizationId:meeting.organization_id,type:"system",title:"Meeting invitation response",message:`A participant ${response} a BidScope meeting invitation.`,pushEventKey:"meeting_changed",relatedEntityType:"meeting",relatedEntityId:meeting.id,relatedUrl:meeting.procurement_tender_id?`/procurement/meetings/${meeting.id}`:`/customer/meetings/${meeting.id}`,frequencyOverride:"instant",dedupeKey:stableDedupe(["meeting-response",meeting.id,participant.id,response])});
    return Response.json({data:{response}});
  }catch(error){return apiErrorResponse(error);}
}
