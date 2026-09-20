import "server-only";
import {encodeFilter,supabaseRest} from "./supabase-rest";

type Row=Record<string,unknown>;
const isoDate=(date:Date)=>date.toISOString().slice(0,10);
const sinceDate=(days:number)=>isoDate(new Date(Date.now()-days*86400000));
const safeUrl=(value:unknown)=>{const url=new URL(String(value||""));if(!/^https?:$/.test(url.protocol))throw new Error("A valid HTTP destination is required.");return url};

export function contentQualityWarnings(input:Row){
  const warnings:string[]=[];
  const title=String(input.title||"").trim(),seoTitle=String(input.seoTitle||input.seo_title||"").trim();
  const description=String(input.metaDescription||input.meta_description||"").trim(),body=String(input.body||"").trim();
  const canonical=String(input.canonicalUrl||input.canonical_url||"").trim();
  if(!title)warnings.push("Title is missing");
  if(!seoTitle)warnings.push("SEO title is missing");
  if(!description)warnings.push("Meta description is missing");
  if(body.length<500)warnings.push("Content is extremely thin");
  if(body&&!/^#\s+/m.test(body))warnings.push("No H1 was detected in the body");
  if(body&&!/\]\(\//.test(body))warnings.push("No internal link was detected");
  if(!String(input.ctaType||input.cta_type||"").trim())warnings.push("No relevant CTA is assigned");
  if(canonical){try{safeUrl(canonical)}catch{warnings.push("Canonical URL is invalid")}}
  return warnings;
}

export async function getSeoOperations(days=28){
  const range=[7,28,90,180,365].includes(days)?days:28,from=sinceDate(range);
  const [{data:searches},{data:synonyms},{data:referrals},{data:outreach},{data:utms},{data:reports},{data:technical},{data:keywords},{data:opportunities},{data:conversions}]=await Promise.all([
    supabaseRest<Row[]>(`seo_internal_searches?searched_on=gte.${from}&select=*&order=searches.desc&limit=250`),
    supabaseRest<Row[]>("seo_search_synonyms?select=*&order=canonical_term.asc&limit=250"),
    supabaseRest<Row[]>(`seo_referral_metrics?metric_date=gte.${from}&select=*&order=sessions.desc&limit=250`),
    supabaseRest<Row[]>("seo_outreach_targets?select=*&order=updated_at.desc&limit=250"),
    supabaseRest<Row[]>("seo_utm_links?select=*&order=created_at.desc&limit=100"),
    supabaseRest<Row[]>("seo_reports?select=*&order=period_end.desc&limit=24"),
    supabaseRest<Row[]>("seo_technical_checks?select=*&order=checked_at.desc&limit=100"),
    supabaseRest<Row[]>("seo_keywords?select=*&order=opportunity_score.desc,impressions.desc&limit=250"),
    supabaseRest<Row[]>("procurement_opportunities?select=category,status,deadline_at,published_at&source_removed_at=is.null&limit=10000"),
    supabaseRest<Row[]>(`seo_conversion_events?created_at=gte.${from}T00:00:00Z&select=event_name,page_path,value_minor,currency,created_at&limit=10000`),
  ]);
  const categoryMap=new Map<string,{category:string;liveTenders:number;expiredTenders:number;searches:number;zeroResults:number}>();
  for(const row of opportunities){const category=String(row.category||"Uncategorised");const entry=categoryMap.get(category)||{category,liveTenders:0,expiredTenders:0,searches:0,zeroResults:0};const deadline=row.deadline_at?new Date(String(row.deadline_at)).getTime():0;if(["OPEN","CLOSING_SOON"].includes(String(row.status))&&(!deadline||deadline>Date.now()))entry.liveTenders++;else entry.expiredTenders++;categoryMap.set(category,entry)}
  for(const row of searches){const q=String(row.normalized_query||row.query||"").toLowerCase();for(const entry of categoryMap.values()){if(q.includes(entry.category.toLowerCase())){entry.searches+=Number(row.searches||0);if(Number(row.result_count||0)===0)entry.zeroResults+=Number(row.searches||0)}}}
  const eventCounts=conversions.reduce<Record<string,number>>((acc,row)=>{const key=String(row.event_name);acc[key]=(acc[key]||0)+1;return acc},{});
  return{rangeDays:range,searches,synonyms,referrals,outreach,utms,reports,technical,keywords,categoryDemand:[...categoryMap.values()].sort((a,b)=>(b.searches+b.liveTenders)-(a.searches+a.liveTenders)).slice(0,100),eventCounts};
}

export async function addUtmLink(input:Row,userId:string){
  const url=safeUrl(input.destinationUrl),source=String(input.source||"").trim(),medium=String(input.medium||"").trim(),campaign=String(input.campaign||"").trim();
  if(!source||!medium||!campaign)throw new Error("Source, medium and campaign are required.");
  url.searchParams.set("utm_source",source);url.searchParams.set("utm_medium",medium);url.searchParams.set("utm_campaign",campaign);
  if(input.content)url.searchParams.set("utm_content",String(input.content));if(input.term)url.searchParams.set("utm_term",String(input.term));
  const row={destination_url:String(input.destinationUrl),source,medium,campaign,content:input.content||null,term:input.term||null,generated_url:url.toString(),created_by:userId};
  const{data}=await supabaseRest<Row[]>("seo_utm_links",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});return data[0];
}

export async function addSearchSynonym(input:Row,userId:string){
  const canonical=String(input.canonicalTerm||"").trim(),synonyms=Array.isArray(input.synonyms)?input.synonyms.map(String):String(input.synonyms||"").split(",").map(x=>x.trim()).filter(Boolean);
  if(!canonical||!synonyms.length)throw new Error("A canonical term and at least one synonym are required.");
  const{data}=await supabaseRest<Row[]>("seo_search_synonyms",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({canonical_term:canonical,synonyms,created_by:userId})});return data[0];
}

export async function addOutreachTarget(input:Row,userId:string){
  const organisation=String(input.organisation||"").trim();if(!organisation)throw new Error("Organisation is required.");
  const row={organisation,website:String(input.website||"").trim()||null,target_type:String(input.targetType||"business_directory"),contact_name:String(input.contactName||"").trim()||null,contact_email:String(input.contactEmail||"").trim()||null,reason_to_approach:String(input.reason||"").trim()||null,target_url:String(input.targetUrl||"").trim()||null,status:"discovered",created_by:userId};
  const{data}=await supabaseRest<Row[]>("seo_outreach_targets",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});return data[0];
}

export async function addSeoExperiment(input:Row,userId:string){
  const name=String(input.name||"").trim(),pageUrl=String(input.pageUrl||"").trim(),hypothesis=String(input.hypothesis||"").trim();
  if(!name||!pageUrl||!hypothesis)throw new Error("Experiment, URL and hypothesis are required.");
  const{data}=await supabaseRest<Row[]>("seo_experiments",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({name,page_url:pageUrl,hypothesis,primary_metric:String(input.primaryMetric||"organic_conversion_rate"),created_by:userId})});return data[0];
}

export async function generateSeoReport(type:"weekly"|"monthly",userId:string|null){
  const days=type==="weekly"?7:30,end=new Date(),start=new Date(Date.now()-(days-1)*86400000),operations=await getSeoOperations(days===7?7:28);
  const summary={generatedFrom:"verified BidScope operational data",eventCounts:operations.eventCounts,topSearches:operations.searches.slice(0,10),topReferrals:operations.referrals.slice(0,10),categoryDemand:operations.categoryDemand.slice(0,10),openTechnicalIssues:operations.technical.filter(row=>row.status!=="pass").slice(0,20),newBacklinkTargets:operations.outreach.filter(row=>String(row.created_at||"")>=start.toISOString()).length};
  const row={report_type:type,period_start:isoDate(start),period_end:isoDate(end),status:"ready",summary,generated_by:userId};
  const{data}=await supabaseRest<Row[]>("seo_reports?on_conflict=report_type,period_start,period_end",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(row)});return data[0];
}

export async function updateOutreachTarget(id:string,input:Row){
  const allowed=["status","last_contact_at","next_follow_up_at","notes","contact_name","contact_email"];
  const changes=Object.fromEntries(Object.entries(input).filter(([key])=>allowed.includes(key)));
  await supabaseRest(`seo_outreach_targets?id=eq.${encodeFilter(id)}`,{method:"PATCH",body:JSON.stringify(changes)});return changes;
}
