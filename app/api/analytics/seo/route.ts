import {createHash} from "node:crypto";
import {z} from "zod";
import {apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest} from "@/lib/server/supabase-rest";

const touch=z.object({source:z.string().max(120).nullable().optional(),medium:z.string().max(120).nullable().optional(),campaign:z.string().max(200).nullable().optional()});
const eventNames=["sign_up","sign_in","supplier_signup","buyer_signup","tender_view","tender_watch","alert_created","tender_alert_created","subscription_click","subscription_started","subscription_completed","subscription_paid","bid_started","bid_submitted","tender_post_started","tender_post_completed","related_tender_click","protected_details_click","service_request","official_source_opened"] as const;
const schema=z.object({
  visitorId:z.string().uuid(),sessionId:z.string().uuid(),landingPath:z.string().startsWith("/").max(500),pagePath:z.string().startsWith("/").max(500),
  referrerHost:z.string().max(255).nullable().optional(),deviceType:z.enum(["mobile","tablet","desktop"]),first:touch,last:touch,
  eventName:z.enum(eventNames).optional(),valueMinor:z.number().int().nonnegative().optional(),currency:z.string().length(3).optional(),metadata:z.record(z.string(),z.unknown()).optional(),
  internalSearch:z.object({query:z.string().min(2).max(160),resultCount:z.number().int().min(0).max(100000)}).optional(),
});

export async function POST(request:Request){
  try{
    const input=schema.parse(await request.json()),now=new Date().toISOString(),today=now.slice(0,10);
    const visitorHash=createHash("sha256").update(`${input.visitorId}:${process.env.BIDSCOPE_INTERNAL_SECRET||"bidscope-seo"}`).digest("hex");
    await supabaseRest("seo_traffic_sessions?on_conflict=session_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({visitor_id_hash:visitorHash,session_id:input.sessionId,landing_path:input.landingPath,referrer_host:input.referrerHost||null,first_source:input.first.source||null,first_medium:input.first.medium||null,first_campaign:input.first.campaign||null,last_source:input.last.source||null,last_medium:input.last.medium||null,last_campaign:input.last.campaign||null,device_type:input.deviceType,consented:true,last_seen_at:now,metadata:{last_path:input.pagePath}})});
    if(input.eventName)await supabaseRest("seo_conversion_events",{method:"POST",body:JSON.stringify({session_id:input.sessionId,event_name:input.eventName,page_path:input.pagePath,value_minor:input.valueMinor||null,currency:input.currency||"GHS",metadata:input.metadata||{}})});
    if(input.internalSearch){
      const query=input.internalSearch.query.trim();
      const{data:existing}=await supabaseRest<Array<{id:number;searches:number}>>(`seo_internal_searches?searched_on=eq.${today}&normalized_query=eq.${encodeURIComponent(query.toLowerCase())}&select=id,searches&limit=1`);
      if(existing[0])await supabaseRest(`seo_internal_searches?id=eq.${existing[0].id}`,{method:"PATCH",body:JSON.stringify({searches:Number(existing[0].searches||0)+1,result_count:input.internalSearch.resultCount,last_seen_at:now})});
      else await supabaseRest("seo_internal_searches",{method:"POST",body:JSON.stringify({searched_on:today,query,result_count:input.internalSearch.resultCount})});
    }
    if(input.referrerHost&&input.last.medium==="referral"&&input.pagePath===input.landingPath){
      const{data:metric}=await supabaseRest<Array<{id:number;sessions:number}>>(`seo_referral_metrics?metric_date=eq.${today}&referring_domain=eq.${encodeURIComponent(input.referrerHost)}&select=id,sessions&limit=1`);
      if(metric[0])await supabaseRest(`seo_referral_metrics?id=eq.${metric[0].id}`,{method:"PATCH",body:JSON.stringify({sessions:Number(metric[0].sessions||0)+1})});
      else await supabaseRest("seo_referral_metrics",{method:"POST",body:JSON.stringify({metric_date:today,referring_domain:input.referrerHost,sessions:1})});
    }
    return new Response(null,{status:204});
  }catch(error){return apiErrorResponse(error)}
}
