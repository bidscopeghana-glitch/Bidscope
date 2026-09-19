import { timingSafeEqual } from "node:crypto";
import { apiErrorResponse } from "@/lib/server/api-error";
import { supabaseRest } from "@/lib/server/supabase-rest";

function authorised(request:Request){
  const configured=process.env.BIDSCOPE_MEET_WEBHOOK_BASIC_AUTH;if(!configured)return false;
  const actual=request.headers.get("authorization")||"";
  const expectedValues=[
    `Basic ${configured}`,
    `Basic ${Buffer.from(configured).toString("base64")}`,
  ];
  return expectedValues.some((expected)=>
    expected.length===actual.length&&timingSafeEqual(Buffer.from(expected),Buffer.from(actual)),
  );
}

export async function POST(request:Request){
  try{
    if(!authorised(request))return Response.json({error:"Invalid webhook credential."},{status:401});
    const event=await request.json() as {id?:string;type?:string;payload?:Record<string,unknown>};
    if(!event.id||!event.type)return Response.json({ok:true});
    const room=String(event.payload?.room||event.payload?.room_name||"");
    const{data:meetings}=room?await supabaseRest<Array<{id:string;organization_id:string;provider_metadata:Record<string,unknown>}>>(`meetings?select=id,organization_id,provider_metadata&provider_room_name=eq.${encodeURIComponent(room)}&limit=1`):{data:[]};
    const meeting=meetings[0]||null;
    const{data:inserted}=await supabaseRest<Array<{provider_event_id:string}>>("meeting_provider_events?on_conflict=provider,provider_event_id",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=representation"},body:JSON.stringify({provider:"daily",provider_event_id:event.id,meeting_id:meeting?.id||null,event_type:event.type,payload:event})});
    if(!inserted[0]||!meeting)return Response.json({ok:true,duplicate:!inserted[0]});
    if(event.type==="meeting.started")await supabaseRest(`meetings?id=eq.${meeting.id}`,{method:"PATCH",body:JSON.stringify({status:"live"})});
    if(event.type==="meeting.ended")await supabaseRest(`meetings?id=eq.${meeting.id}`,{method:"PATCH",body:JSON.stringify({status:"completed"})});
    const participantId=String(event.payload?.user_id||"");
    if(participantId&&event.type==="participant.joined")await supabaseRest(`meeting_participants?meeting_id=eq.${meeting.id}&or=(user_id.eq.${participantId},id.eq.${participantId})`,{method:"PATCH",body:JSON.stringify({response_status:"joined",joined_at:new Date(Number(event.payload?.joined_at||Date.now()/1000)*1000).toISOString()})});
    if(participantId&&event.type==="participant.left"){
      const duration=Math.max(0,Math.round(Number(event.payload?.duration||0)));
      await supabaseRest(`meeting_participants?meeting_id=eq.${meeting.id}&or=(user_id.eq.${participantId},id.eq.${participantId})`,{method:"PATCH",body:JSON.stringify({left_at:new Date(Number(event.payload?.left_at||Date.now()/1000)*1000).toISOString(),attendance_seconds:duration})});
      await supabaseRest("meeting_usage_events",{method:"POST",body:JSON.stringify({meeting_id:meeting.id,organization_id:meeting.organization_id,provider:"daily",participant_count:1,duration_seconds:duration,participant_minutes:Math.ceil(duration/60)})});
    }
    if(event.type.includes("recording.")||event.type.includes("transcript."))await supabaseRest(`meetings?id=eq.${meeting.id}`,{method:"PATCH",body:JSON.stringify({provider_metadata:{...meeting.provider_metadata,lastAssetEvent:{type:event.type,payload:event.payload}}})});
    return Response.json({ok:true});
  }catch(error){return apiErrorResponse(error);}
}
