import {encodeFilter,supabaseRest} from "./supabase-rest";

const now=()=>new Date().toISOString();
const since=(days:number)=>new Date(Date.now()-days*86400000).toISOString();

async function count(path:string){const{response}=await supabaseRest<unknown[]>(path,{count:"exact"});return Number(response.headers.get("content-range")?.split("/")[1]||0)}

export async function getSeoGrowthOverview(days=30){
  const safeDays=[7,30,90].includes(days)?days:30;
  const from=since(safeDays);
  const staleCutoff=since(7);
  const [
    {data:settings},{data:keywords},{data:content},{data:pageMetrics},{data:alerts},{data:backlinks},{data:experiments},{data:syncRuns},
    sessions,organicSessions,signups,subscriptions,openTenders,staleTenders,thinTenders
  ]=await Promise.all([
    supabaseRest<Array<Record<string,unknown>>>("seo_settings?singleton_key=eq.default&select=*&limit=1"),
    supabaseRest<Array<Record<string,unknown>>>("seo_keywords?select=*&order=opportunity_score.desc,priority.desc&limit=100"),
    supabaseRest<Array<Record<string,unknown>>>("seo_content_items?select=*&order=planned_for.asc.nullslast,updated_at.desc&limit=100"),
    supabaseRest<Array<Record<string,unknown>>>(`seo_page_metrics?select=*&metric_date=gte.${from.slice(0,10)}&order=metric_date.asc&limit=5000`),
    supabaseRest<Array<Record<string,unknown>>>("seo_alerts?select=*&resolved_at=is.null&order=detected_at.desc&limit=50"),
    supabaseRest<Array<Record<string,unknown>>>("seo_backlinks?select=*&order=updated_at.desc&limit=100"),
    supabaseRest<Array<Record<string,unknown>>>("seo_experiments?select=*&order=created_at.desc&limit=50"),
    supabaseRest<Array<Record<string,unknown>>>("seo_sync_runs?select=*&order=started_at.desc&limit=10"),
    count(`seo_traffic_sessions?select=id&first_seen_at=gte.${from}`),
    count(`seo_traffic_sessions?select=id&first_seen_at=gte.${from}&or=(first_medium.eq.organic,first_source.eq.google)`),
    count(`seo_conversion_events?select=id&event_name=eq.sign_up&created_at=gte.${from}`),
    count(`seo_conversion_events?select=id&event_name=in.(subscription_started,subscription_paid)&created_at=gte.${from}`),
    count(`procurement_opportunities?select=id&status=in.(OPEN,CLOSING_SOON)&deadline_at=gt.${now()}`),
    count(`procurement_opportunities?select=id&status=in.(OPEN,CLOSING_SOON)&last_verified_at=lt.${staleCutoff}`),
    count("procurement_opportunities?select=id&status=in.(OPEN,CLOSING_SOON)&or=(summary.eq.,description.eq.)"),
  ]);
  const totalImpressions=pageMetrics.reduce((sum,row)=>sum+Number(row.impressions||0),0);
  const totalClicks=pageMetrics.reduce((sum,row)=>sum+Number(row.clicks||0),0);
  const revenueMinor=pageMetrics.reduce((sum,row)=>sum+Number(row.revenue_minor||0),0);
  const avgPosition=pageMetrics.length?pageMetrics.reduce((sum,row)=>sum+Number(row.average_position||0),0)/pageMetrics.filter(row=>row.average_position!=null).length:0;
  return {
    rangeDays:safeDays,
    settings:settings[0]||null,
    connection:{
      searchConsole:Boolean(settings[0]?.search_console_connected),
      searchConsoleCredentials:Boolean(process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL&&process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY),
      analytics:Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
      verification:Boolean(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION),
      sitemap:"https://www.bidscopeghana.com/sitemap.xml",
    },
    metrics:{sessions,organicSessions,signups,subscriptions,totalImpressions,totalClicks,ctr:totalImpressions?totalClicks/totalImpressions:0,averagePosition:Number.isFinite(avgPosition)?avgPosition:0,revenueMinor,openTenders,staleTenders,thinTenders},
    keywords,content,pageMetrics,alerts,backlinks,experiments,syncRuns,
  };
}

export async function updateSeoSettings(input:Record<string,unknown>,userId:string){
  const allowed=["search_console_property","reporting_email","weekly_report_enabled","monthly_report_enabled","stale_content_days","minimum_indexable_tenders"];
  const changes=Object.fromEntries(Object.entries(input).filter(([key])=>allowed.includes(key)));
  await supabaseRest("seo_settings?singleton_key=eq.default",{method:"PATCH",body:JSON.stringify({...changes,updated_by:userId,updated_at:now()})});
  return changes;
}

export async function addSeoKeyword(input:Record<string,unknown>,userId:string){
  const keyword=String(input.keyword||"").trim();if(!keyword)throw new Error("Keyword is required.");
  const row={keyword,cluster:String(input.cluster||"Unassigned").trim(),target_url:String(input.targetUrl||"").trim()||null,intent:String(input.intent||"commercial"),priority:String(input.priority||"medium"),created_by:userId};
  const{data}=await supabaseRest<Array<Record<string,unknown>>>("seo_keywords",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});return data[0];
}

export async function addSeoContent(input:Record<string,unknown>,userId:string){
  const title=String(input.title||"").trim();if(!title)throw new Error("Content title is required.");
  const slug=String(input.slug||title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")).slice(0,140);
  const primary=String(input.primaryKeyword||"").trim()||null;
  const outline=["Search intent and reader outcome","Ghana procurement context","Practical steps and evidence","Common mistakes","BidScope next action"];
  const row={title,slug,content_type:String(input.contentType||"article"),cluster:String(input.cluster||"Procurement intelligence"),primary_keyword:primary,status:"brief",outline,recommended_internal_links:["/tenders","/for-suppliers","/resources"],planned_for:input.plannedFor||null,created_by:userId,updated_by:userId};
  const{data}=await supabaseRest<Array<Record<string,unknown>>>("seo_content_items",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});return data[0];
}

export async function addSeoBacklink(input:Record<string,unknown>,userId:string){
  const sourceUrl=String(input.sourceUrl||"").trim(),targetUrl=String(input.targetUrl||"").trim();if(!sourceUrl||!targetUrl)throw new Error("Source and target URLs are required.");
  const host=new URL(sourceUrl).hostname.replace(/^www\./,"");
  const row={source_url:sourceUrl,target_url:targetUrl,source_domain:host,status:String(input.status||"prospect"),relationship_owner:String(input.owner||"").trim()||null,contact_email:String(input.contactEmail||"").trim()||null,created_by:userId};
  const{data}=await supabaseRest<Array<Record<string,unknown>>>("seo_backlinks",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});return data[0];
}

export async function updateSeoItem(table:"seo_keywords"|"seo_content_items"|"seo_backlinks"|"seo_experiments"|"seo_alerts",id:string,input:Record<string,unknown>){
  const allow:Record<string,string[]>={seo_keywords:["status","priority","target_url","cluster"],seo_content_items:["status","owner_name","planned_for","notes","quality_score","freshness_score"],seo_backlinks:["status","relationship_owner","next_action_at","notes"],seo_experiments:["status","starts_at","ends_at","result"],seo_alerts:["resolved_at"]};
  const changes=Object.fromEntries(Object.entries(input).filter(([key])=>allow[table].includes(key)));
  await supabaseRest(`${table}?id=eq.${encodeFilter(id)}`,{method:"PATCH",body:JSON.stringify(changes)});return changes;
}
