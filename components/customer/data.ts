"use client";
import { useEffect, useState } from "react";
import { clearSession, getValidAccessToken } from "@/lib/client/session";
export type Opportunity={id:string;slug:string;title:string;summary:string;description?:string;buyer_name:string;buyer_normalized_id?:string;country:string;country_code:string;region:string|null;sector:string|null;category:string;source_name:string;funding_source?:string;funding_agency?:string|null;estimated_value:number|null;currency:string;deadline_at:string|null;published_at:string;opening_at?:string|null;clarification_deadline_at?:string|null;external_reference:string|null;status:string;official_source_url:string;official_tender_url?:string;official_submission_url?:string|null;eligibility_text:string|null;eligibility_status:string;eligibility_summary?:string;verification_status:string;documents_url?:string;contract_type?:string;procurement_method?:string;submission_method?:string|null;submission_instructions?:string|null;requires_registration?:boolean;registration_url?:string|null;local_registration_required?:boolean|null;local_partner_required?:boolean|null;contact_name?:string|null;contact_email?:string|null;contact_phone?:string|null;contact_address?:string|null;bid_validity_days?:number|null;participation_fee_amount?:number|null;participation_fee_currency?:string|null;bid_security_requirement?:string|null;bid_security_text?:string|null;procurement_codes?:string[];lots?:Record<string,unknown>[];qualification_requirements?:string|null;required_certifications?:string[];required_documents?:Array<Record<string,unknown>>;source_details?:Record<string,unknown>;quality_score?:number;documents?:{id:string;title:string;url:string}[];match?:{percentage:number|null;reasons:string[];evidenceAvailable:boolean};saved?:boolean};
export type OpportunityAccess={access?:"subscriber"|"member_preview"|"preview";locked?:string[];bidscope_reference?:string;buyer_type?:string|null;documents_available?:boolean;intelligence_available?:boolean};
export type Organization={id:string;name:string;region:string|null;sectors:string[];services:string[];products:string[];certifications:string[];preferred_regions:string[];preferred_countries?:string[];preferred_buyers?:string[];excluded_buyers?:string[];preferred_opportunity_types?:string[];cpv_codes?:string[];unspsc_codes?:string[];preferred_minimum_value:number|null;preferred_maximum_value:number|null;business_description?:string|null;registration_number?:string|null;website?:string|null;phone?:string|null;company_size?:string|null;annual_turnover_min?:number|null;annual_turnover_max?:number|null;turnover_currency?:string|null;international_willingness?:boolean|null;local_partnership_willingness?:boolean|null;company_email?:string|null;procurement_contact?:string|null;organization_type?:string|null;expected_procurement_categories?:string[];can_bid?:boolean;can_procure?:boolean};
export type Decision="STRONG_GO"|"GO"|"REVIEW"|"HIGH_RISK"|"NO_GO"|"UNKNOWN";
export type RetentionAssessment={overallScore:number|null;decision:Decision;components:{businessMatch:number|null;eligibility:number|null;capability:number|null;financialFit:number|null;experienceFit:number|null;documentReadiness:number|null;deadlineFeasibility:number|null};reasons:string[];concerns:string[];evidence:Record<string,unknown>};
export type RetentionOverview={organization:Organization|null;bestMatch:({opportunity:Opportunity}&RetentionAssessment)|null;readiness:{overallScore:number;confidence:"low"|"medium"|"high";categoryScores:Record<string,{score:number;weight:number}>;recommendations:{category:string;label:string;score:number;pointsAvailable:number}[];evidence:Record<string,unknown>}|null;matches:{opportunity:Opportunity;assessment:RetentionAssessment}[];radar:{opportunity_id:string;slug:string;title:string;summary:string;buyer_name:string;signal_type:string;confidence:string;source_url:string;expected_at:string|null}[]};
export type Bid={id:string;status:string;notes:string;submission_reference:string|null;updated_at:string;opportunity:Opportunity};
export type Notice={id:string;title:string;message:string;type:string;priority:string;related_url:string|null;created_at:string;read_at:string|null};
export type Pulse={open:number;matched:number;strong:number;closing:number;saved:number;bids:number;international:number;pipeline:Record<string,number>;sectors:{sector:string;total:number}[];buyers:{buyer_name:string;total:number}[];since:string|null;newGhana:number;newInternational:number;newMatches:number};
export type Preferences={compact?:boolean;collapsed?:boolean;hideMarket?:boolean;hideInternational?:boolean;deadlinesFirst?:boolean};
type CacheEntry={at:number;data:unknown};
const cache=new Map<string,CacheEntry>();
export function invalidate(){cache.clear();window.dispatchEvent(new Event("bidscope-data-change"));}
export async function api<T>(url:string,body?:unknown,method?:string):Promise<T>{
  let token=await getValidAccessToken();
  if(!token)throw new Error("Sign in to continue.");
  const request=()=>fetch(url,{method:method||(body?"POST":"GET"),headers:{Authorization:`Bearer ${token}`,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let response=await request();
  if(response.status===401){token=await getValidAccessToken(true);if(token)response=await request();}
  const result=response.status===204?{}:await response.json();
  if(!response.ok){if(response.status===401)clearSession(true);throw new Error((result as {error?:string}).error||"This request could not be completed. Please try again.");}
  return result as T;
}
export async function uploadAuthenticatedFile<T>(url:string,body:FormData):Promise<T>{
  let token=await getValidAccessToken();
  if(!token)throw new Error("Sign in to continue.");
  const request=()=>fetch(url,{method:"POST",headers:{Authorization:`Bearer ${token}`},body});
  let response=await request();
  if(response.status===401){token=await getValidAccessToken(true);if(token)response=await request();}
  const result=await response.json().catch(()=>({}));
  if(!response.ok){if(response.status===401)clearSession(true);throw new Error((result as {error?:string}).error||"The document could not be uploaded.");}
  return result as T;
}
export async function uploadAuthenticatedFileWithProgress<T>(url:string,body:FormData,onProgress:(percent:number)=>void):Promise<T>{
  const token=await getValidAccessToken();
  if(!token)throw new Error("Sign in to continue.");
  return new Promise<T>((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    xhr.open("POST",url);
    xhr.setRequestHeader("Authorization",`Bearer ${token}`);
    xhr.upload.onprogress=(event)=>{if(event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
    xhr.onerror=()=>reject(new Error("The upload was interrupted. Please try again."));
    xhr.onload=()=>{let result:{error?:string;data?:unknown}={};try{result=JSON.parse(xhr.responseText);}catch{}if(xhr.status>=200&&xhr.status<300)resolve(result as T);else reject(new Error(result.error||"The document could not be uploaded."));};
    xhr.send(body);
  });
}
export async function downloadAuthenticatedFile(url:string,filename:string){const token=await getValidAccessToken();if(!token)throw new Error("Sign in to continue.");const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok){const result=await response.json().catch(()=>({})) as {error?:string};throw new Error(result.error||"The export could not be created.");}const blob=await response.blob();const href=URL.createObjectURL(blob);const link=document.createElement("a");link.href=href;link.download=filename;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(href);}
export async function viewAuthenticatedFile(url:string){const tab=window.open("","_blank");if(!tab)throw new Error("Allow pop-ups to view this document, or use Download.");try{const token=await getValidAccessToken();if(!token)throw new Error("Sign in to continue.");const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok){const result=await response.json().catch(()=>({})) as {error?:string};throw new Error(result.error||"The document could not be opened.");}const href=URL.createObjectURL(await response.blob());tab.location.href=href;window.setTimeout(()=>URL.revokeObjectURL(href),60000);}catch(error){tab.close();throw error;}}
export function useData<T>(url:string|null){
  const [state,setState]=useState<{data?:T;error?:string;loading:boolean}>({loading:true});
  useEffect(()=>{let active=true;async function load(){if(!url){setState({loading:false});return;}const key=(localStorage.getItem("bidscope_access_token")||"")+url;const hit=cache.get(key);if(hit&&Date.now()-hit.at<30000){setState({data:hit.data as T,loading:false});return;}setState({loading:true});try{const data=await api<T>(url);if(!active)return;cache.set(key,{data,at:Date.now()});if(cache.size>80)cache.delete(cache.keys().next().value!);setState({data,loading:false});}catch(e){if(active)setState({error:e instanceof Error?e.message:"Could not load data",loading:false});}}void load();window.addEventListener("bidscope-data-change",load);return()=>{active=false;window.removeEventListener("bidscope-data-change",load);};},[url]);
  return state;
}
export const stages=[['SAVED','Considering'],['REVIEWING','Reviewing'],['PREPARING','Preparing'],['READY_TO_SUBMIT','Ready'],['OFFICIAL_SUBMISSION_OPENED','Submission started'],['SUBMITTED','Awaiting result'],['AWARDED','Won'],['UNSUCCESSFUL','Lost'],['WITHDRAWN','Withdrawn']] as const;
export function date(value:string|null|undefined){return value?new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"Not published";}
export function days(value:string|null){return value?Math.ceil((Date.parse(value)-Date.now())/86400000):null;}
export function money(o:Opportunity){return o.estimated_value!==null&&o.estimated_value!==undefined?new Intl.NumberFormat("en-GB",{style:"currency",currency:o.currency||"GHS",maximumFractionDigits:0}).format(o.estimated_value):"Value not disclosed";}
export function officialUrl(value?:string|null){try{const u=new URL(value||"");return ["https:","http:"].includes(u.protocol)?u.href:undefined;}catch{return undefined;}}
export function eligibility(o:Opportunity){if(!o.eligibility_text)return "Eligibility unconfirmed";if(o.eligibility_status==="RESTRICTED")return "Restrictions apply";if(o.eligibility_status==="INTERNATIONAL_ELIGIBLE")return "International bidding indicated";return "Check tender requirements";}
