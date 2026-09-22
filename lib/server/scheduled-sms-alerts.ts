import { createNotification, stableDedupe } from "./notifications";
import { supabaseRest } from "./supabase-rest";

type Participant={user_id:string|null;response_status:string;meeting:{id:string;organization_id:string;title:string;starts_at:string;status:string;reminder_minutes:number;procurement_tender_id:string|null}|null};
type Saved={saved_by:string;organization_id:string;opportunity:{id:string;slug:string;title:string;deadline_at:string|null;status:string}|null};

export async function generateMeetingReminders(now=new Date()){
  const maximum=new Date(now.getTime()+7*24*60*60_000).toISOString();
  const{data}=await supabaseRest<Participant[]>(`meeting_participants?select=user_id,response_status,meeting:meetings(id,organization_id,title,starts_at,status,reminder_minutes,procurement_tender_id)&user_id=not.is.null&response_status=not.eq.declined&meeting.status=eq.scheduled&meeting.starts_at=gt.${now.toISOString()}&meeting.starts_at=lte.${maximum}&limit=2000`);
  let generated=0;
  for(const participant of data){const meeting=participant.meeting;if(!participant.user_id||!meeting)continue;
    for(const minutes of new Set([30,10,meeting.reminder_minutes])){
      const dueAt=new Date(new Date(meeting.starts_at).getTime()-minutes*60_000);
      if(dueAt>now || now.getTime()-dueAt.getTime()>6*60_000)continue;
      const notice=await createNotification({userId:participant.user_id,organizationId:meeting.organization_id,type:"meeting_reminder",title:"Meeting reminder",message:`Your meeting regarding ${meeting.title} starts in ${minutes} minute${minutes===1?"":"s"}.`,pushEventKey:"meeting_reminder",relatedEntityType:"meeting",relatedEntityId:meeting.id,relatedUrl:meeting.procurement_tender_id?`/procurement/meetings/${meeting.id}`:`/customer/meetings/${meeting.id}`,priority:"urgent",frequencyOverride:"instant",dedupeKey:stableDedupe(["meeting-reminder",meeting.id,participant.user_id,minutes])});
      if(notice)generated++;
    }
  }
  return generated;
}

export async function generateWatchedTenderClosingAlerts(now=new Date()){
  const maximum=new Date(now.getTime()+24*60*60_000).toISOString();
  const{data}=await supabaseRest<Saved[]>(`saved_opportunities?select=saved_by,organization_id,opportunity:procurement_opportunities(id,slug,title,deadline_at,status)&saved_by=not.is.null&opportunity.deadline_at=gt.${now.toISOString()}&opportunity.deadline_at=lte.${maximum}&opportunity.status=in.(OPEN,CLOSING_SOON)&limit=2000`);
  let generated=0;
  for(const saved of data){const opportunity=saved.opportunity;if(!saved.saved_by||!opportunity?.deadline_at)continue;
    const notice=await createNotification({userId:saved.saved_by,organizationId:saved.organization_id,type:"watched_tender_closing",title:"Watched tender closing soon",message:`The tender you're watching, ${opportunity.title}, closes within 24 hours.`,relatedEntityType:"opportunity",relatedEntityId:opportunity.id,relatedUrl:`/customer/opportunity/${opportunity.slug}`,priority:"urgent",frequencyOverride:"instant",dedupeKey:stableDedupe(["watched-closing",opportunity.id,saved.saved_by,new Date(opportunity.deadline_at).toISOString()])});
    if(notice)generated++;
  }
  return generated;
}
