"use client";
import{useEffect}from"react";
import{usePathname,useSearchParams}from"next/navigation";
type Touch={source:string|null;medium:string|null;campaign:string|null};
type SeoEvent="sign_up"|"sign_in"|"supplier_signup"|"buyer_signup"|"tender_view"|"tender_watch"|"alert_created"|"tender_alert_created"|"subscription_click"|"subscription_started"|"subscription_completed"|"subscription_paid"|"bid_started"|"bid_submitted"|"tender_post_started"|"tender_post_completed"|"related_tender_click"|"protected_details_click"|"service_request"|"official_source_opened"|"insight_cta_clicked"|"insight_to_tender"|"insight_to_signup"|"insight_to_buyer_signup"|"insight_to_supplier_signup"|"insight_to_post_tender"|"insight_to_alert";
declare global{interface Window{trackBidScopeSeoConversion?:(eventName:SeoEvent,options?:{valueMinor?:number;currency?:string;metadata?:Record<string,unknown>})=>void;trackBidScopeInternalSearch?:(query:string,resultCount:number)=>void}}
const key="bidscope_seo_first_touch",visitorKey="bidscope_seo_visitor",sessionKey="bidscope_seo_session";
function identifier(storage:Storage,name:string){let value=storage.getItem(name);if(!value){value=crypto.randomUUID();storage.setItem(name,value)}return value}
function currentTouch(params:URLSearchParams):Touch{
  const ref=document.referrer?new URL(document.referrer).hostname.toLowerCase():null,utmMedium=params.get("utm_medium"),utmSource=params.get("utm_source");
  if(utmSource||utmMedium)return{source:utmSource||"campaign",medium:utmMedium||"unknown",campaign:params.get("utm_campaign")};
  if(!ref||ref.endsWith("bidscopeghana.com"))return{source:"direct",medium:"direct",campaign:null};
  if(/(^|\.)(google|bing|yahoo|duckduckgo)\./.test(ref))return{source:ref,medium:"organic",campaign:null};
  if(/(^|\.)(linkedin|facebook|instagram|x|twitter|tiktok)\./.test(ref))return{source:ref,medium:"social",campaign:null};
  return{source:ref,medium:"referral",campaign:null};
}
export function SeoAttribution(){
  const path=usePathname(),search=useSearchParams();
  useEffect(()=>{
    if(document.documentElement.dataset.cookieAnalytics!=="granted")return;
    const params=new URLSearchParams(search.toString()),last=currentTouch(params);let first:Touch=last;
    try{const saved=localStorage.getItem(key);if(saved)first=JSON.parse(saved) as Touch;else localStorage.setItem(key,JSON.stringify(last))}catch{}
    const visitorId=identifier(localStorage,visitorKey),sessionId=identifier(sessionStorage,sessionKey),landingPath=sessionStorage.getItem("bidscope_seo_landing")||path;
    sessionStorage.setItem("bidscope_seo_landing",landingPath);
    const payload={visitorId,sessionId,landingPath,pagePath:path,referrerHost:document.referrer?new URL(document.referrer).hostname:null,deviceType:window.innerWidth<640?"mobile":window.innerWidth<1024?"tablet":"desktop",first,last};
    const send=(extra:Record<string,unknown>={})=>fetch("/api/analytics/seo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,...extra}),keepalive:true}).catch(()=>undefined);
    void send();
    window.trackBidScopeSeoConversion=(eventName,options)=>{void send({eventName,...options})};
    window.trackBidScopeInternalSearch=(query,resultCount)=>{if(query.trim().length>=2)void send({internalSearch:{query:query.trim(),resultCount}})};
    return()=>{delete window.trackBidScopeSeoConversion;delete window.trackBidScopeInternalSearch};
  },[path,search]);
  return null;
}
