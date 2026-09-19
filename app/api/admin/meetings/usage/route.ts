import { apiErrorResponse } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";

export async function GET(request:Request){
  try{
    await requireSuperAdmin(request);const start=new Date();start.setUTCDate(1);start.setUTCHours(0,0,0,0);
    const[{data:usage},{data:meetings}]=await Promise.all([supabaseRest<Array<{participant_minutes:number;recording_minutes:number;transcription_minutes:number;duration_seconds:number}>>(`meeting_usage_events?select=participant_minutes,recording_minutes,transcription_minutes,duration_seconds&occurred_at=gte.${start.toISOString()}`),supabaseRest<Array<{id:string;status:string;starts_at:string;ends_at:string}>>(`meetings?select=id,status,starts_at,ends_at&created_at=gte.${start.toISOString()}`)]);
    const participantMinutes=usage.reduce((sum,item)=>sum+item.participant_minutes,0),recordingMinutes=usage.reduce((sum,item)=>sum+item.recording_minutes,0),transcriptionMinutes=usage.reduce((sum,item)=>sum+item.transcription_minutes,0),allowance=Number(process.env.BIDSCOPE_MEET_FREE_ALLOWANCE_MINUTES||10000),billable=Math.max(0,participantMinutes-allowance),estimatedCost=billable*Number(process.env.BIDSCOPE_MEET_COST_PER_PARTICIPANT_MINUTE||0.004);
    const averageDuration=meetings.length?Math.round(meetings.reduce((sum,item)=>sum+Math.max(0,(Date.parse(item.ends_at)-Date.parse(item.starts_at))/60000),0)/meetings.length):0;
    return Response.json({data:{month:start.toISOString().slice(0,7),participantMinutes,allowance,billableMinutes:billable,estimatedProviderCostUsd:Number(estimatedCost.toFixed(2)),meetingCount:meetings.length,averageDurationMinutes:averageDuration,recordingMinutes,transcriptionMinutes}});
  }catch(error){return apiErrorResponse(error);}
}
