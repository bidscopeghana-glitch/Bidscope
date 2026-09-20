import { createNotification, stableDedupe } from "./notifications";
import { supabaseRest } from "./supabase-rest";

type Profile={id:string};
type TodayNotification={user_id:string;type:string};

function utcDay(now:Date){return now.toISOString().slice(0,10);}

export async function generateDailyEngagementAlerts(now=new Date()){
  const since=new Date(now.getTime()-24*60*60*1000).toISOString();
  const dayStart=`${utcDay(now)}T00:00:00.000Z`;
  const [{data:profiles},{response:newOpportunityResponse},{data:todayNotifications}]=await Promise.all([
    supabaseRest<Profile[]>("profiles?select=id&order=created_at.asc&limit=5000"),
    supabaseRest<Array<{id:string}>>(`procurement_opportunities?select=id&status=in.(OPEN,CLOSING_SOON)&created_at=gte.${since}&deadline_at=gt.${now.toISOString()}`,{count:"exact"}),
    supabaseRest<TodayNotification[]>(`notifications?select=user_id,type&created_at=gte.${dayStart}&type=in.(opportunity_match,matching_tender)&limit=5000`),
  ]);
  const newOpportunityCount=Number(newOpportunityResponse.headers.get("content-range")?.split("/")[1]||0);
  const matchCounts=new Map<string,number>();
  for(const notification of todayNotifications)matchCounts.set(notification.user_id,(matchCounts.get(notification.user_id)||0)+1);
  let generated=0;
  for(const profile of profiles){
    const matched=matchCounts.get(profile.id)||0;
    const title=matched
      ? `${matched} matched opportunit${matched===1?"y is":"ies are"} waiting for your company`
      : newOpportunityCount
        ? `${newOpportunityCount} new tender${newOpportunityCount===1?" has":"s have"} been uploaded`
        : "Opportunities are waiting for your company";
    const message=matched
      ? "BidScope found new tenders aligned with your company profile and subscription. Review the matches, requirements and deadlines in your workspace."
      : newOpportunityCount
        ? "Return to BidScope to review the latest public-sector opportunities and identify those worth pursuing."
        : "Keep your business profile and Tender Watches current so BidScope can surface the strongest opportunities for your company.";
    const notification=await createNotification({
      userId:profile.id,type:"workspace_reminder",title,message,relatedUrl:"/customer/discover",priority:"normal",frequencyOverride:"daily",
      metadata:{newOpportunityCount,matchedOpportunityCount:matched,digestDate:utcDay(now)},
      dedupeKey:stableDedupe(["daily-engagement",profile.id,utcDay(now)]),
    });
    if(notification)generated++;
  }
  return{users:profiles.length,generated,newOpportunityCount};
}
