import {createHash} from "node:crypto";
import {calculateOpportunityMatch, type MatchOpportunity, type MatchProfile} from "./matching.ts";
import {supabaseRest} from "../supabase-rest.ts";
import {documentValidity} from "../../document-passport.ts";

export type Organization=MatchProfile&{
 id:string;name:string;country_code:string;registration_number?:string|null;website?:string|null;phone?:string|null;company_size?:string|null;
 business_description?:string|null;annual_turnover_min?:number|null;annual_turnover_max?:number|null;turnover_currency?:string|null;
 preferred_countries?:string[];preferred_buyers?:string[];excluded_buyers?:string[];preferred_opportunity_types?:string[];
 international_willingness?:boolean|null;local_partnership_willingness?:boolean|null;previous_contracts?:unknown;
};
export type RetentionOpportunity=MatchOpportunity&{
 id:string;slug:string;buyer_name:string;buyer_normalized_id?:string|null;country:string;country_code:string;currency?:string|null;
 deadline_at:string|null;published_at:string|null;status:string;eligibility_status?:string|null;official_source_url:string;
 source_name:string;verification_status?:string|null;procurement_method?:string|null;contract_type?:string|null;
 required_certifications?:string[]|null;
};
type SupplierDocument={id:string;document_type:string;title:string;issued_at?:string|null;expires_at:string|null;verification_status:string};
export type RetentionAssessment={
 overallScore:number|null;decision:"STRONG_GO"|"GO"|"REVIEW"|"HIGH_RISK"|"NO_GO"|"UNKNOWN";
 components:{businessMatch:number|null;eligibility:number|null;capability:number|null;financialFit:number|null;experienceFit:number|null;documentReadiness:number|null;deadlineFeasibility:number|null};
 reasons:string[];concerns:string[];evidence:Record<string,unknown>;
};

const safeList=(value:unknown)=>Array.isArray(value)?value.filter((v):v is string=>typeof v==="string"&&v.trim().length>0):[];
const numberValue=(value:unknown)=>typeof value==="number"?value:value==null?null:Number(value);
const fingerprint=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normal=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const terms=(values:string[])=>values.flatMap(v=>normal(v).split(" ")).filter(v=>v.length>2);
const overlap=(needles:string[],haystack:string)=>{const words=terms(needles);return words.length?words.filter((v,i)=>words.indexOf(v)===i&&haystack.includes(v)).length/Math.min(8,new Set(words).size):null;};

export function calculateRetentionAssessment(profile:Organization, opportunity:RetentionOpportunity, documents:SupplierDocument[]=[]):RetentionAssessment{
 const base=calculateOpportunityMatch({sectors:safeList(profile.sectors),services:safeList(profile.services),products:safeList(profile.products),region:profile.region||null,preferred_regions:safeList(profile.preferred_regions),preferred_minimum_value:numberValue(profile.preferred_minimum_value),preferred_maximum_value:numberValue(profile.preferred_maximum_value),certifications:safeList(profile.certifications),business_description:profile.business_description,preferred_countries:safeList(profile.preferred_countries),preferred_buyers:safeList(profile.preferred_buyers),excluded_buyers:safeList(profile.excluded_buyers),preferred_opportunity_types:safeList(profile.preferred_opportunity_types),cpv_codes:safeList((profile as unknown as {cpv_codes?:string[]}).cpv_codes),unspsc_codes:safeList((profile as unknown as {unspsc_codes?:string[]}).unspsc_codes)},opportunity);
 const reasons=[...base.reasons];const concerns:string[]=[];const now=Date.now();const parsedDeadline=opportunity.deadline_at?Date.parse(opportunity.deadline_at):NaN;const deadline=Number.isFinite(parsedDeadline)?parsedDeadline:null;
 const combined=normal(`${opportunity.title} ${opportunity.summary} ${opportunity.sector||""} ${opportunity.category} ${opportunity.eligibility_text||""}`);
 const capabilityOverlap=overlap([...safeList(profile.sectors),...safeList(profile.services),...safeList(profile.products)],combined);
 const capability=capabilityOverlap===null?null:Math.round(Math.min(1,capabilityOverlap)*100);
 if(capability!==null&&capability>=50)reasons.push("Published scope overlaps with your recorded services or products");
 else if(capability!==null)concerns.push("Limited capability overlap was found in the indexed scope");
 let eligibility:number|null=null;
 if(opportunity.eligibility_status==="RESTRICTED")eligibility=0;
 else if(["GHANA_ELIGIBLE","INTERNATIONAL_ELIGIBLE"].includes(opportunity.eligibility_status||""))eligibility=100;
 else if(opportunity.eligibility_text)eligibility=50;
 if(eligibility===0)concerns.push("The indexed eligibility evidence indicates a restriction");
 if(eligibility===null||eligibility===50)concerns.push("Eligibility must be confirmed in the official tender documents");
 const missingCertifications=safeList(opportunity.required_certifications).filter(required=>!safeList(profile.certifications).some(held=>normal(held)===normal(required)));
 if(missingCertifications.length){eligibility=eligibility===0?0:50;concerns.unshift(`Published certifications not recorded in your profile: ${missingCertifications.join(", ")}. Add evidence or confirm equivalence with the buyer.`);}
 let financialFit:number|null=null;
 const value=numberValue(opportunity.estimated_value),min=numberValue(profile.preferred_minimum_value),max=numberValue(profile.preferred_maximum_value);
 if(value!==null&&(min!==null||max!==null)&&opportunity.currency?.toUpperCase()==="GHS"){financialFit=(min===null||value>=min)&&(max===null||value<=max)?100:25;if(financialFit===100)reasons.push("Estimated contract value falls within your GHS preferred range");else concerns.push("Estimated contract value is outside your GHS preferred range");}
 else if(value===null)concerns.push("Contract value was not published, so value preference fit is unknown");
 else if((min!==null||max!==null)&&opportunity.currency?.toUpperCase()!=="GHS")concerns.push("Tender currency is not confirmed as GHS; the contract value cannot be compared with your GHS preferred range");
 const pastText=normal(JSON.stringify(profile.previous_contracts||[]));
 const experienceOverlap=pastText&&pastText!=="[]"?overlap([opportunity.sector||"",opportunity.category,opportunity.buyer_name],pastText):null;
 const experienceFit=experienceOverlap===null?null:Math.round(Math.min(1,experienceOverlap)*100);
 if(experienceFit===null)concerns.push("No structured past-performance evidence is available for this assessment");
 const documentChecks=documents.map(document=>({document,validity:documentValidity(document,new Date(now),opportunity.deadline_at)}));
 const activeDocs=documentChecks.filter(item=>item.validity.usableThroughDeadline);
 const documentReadiness=documents.length?Math.round(activeDocs.length/documents.length*100):null;
 const deadlineDocuments=documentChecks.filter(item=>item.validity.expiresBeforeDeadline);
 if(deadlineDocuments.length)concerns.unshift(`${deadlineDocuments.length} document(s) may not remain valid through the tender deadline: ${deadlineDocuments.map(item=>item.document.title).join(", ")}`);
 if(documents.some(document=>document.verification_status!=="verified"))concerns.push("Some stored documents still require verification; date validity does not confirm authenticity or tender compliance");
 if(documentReadiness===null)concerns.push("Tender-readiness documents have not been added to your business profile");
 const daysRemaining=deadline===null?null:Math.ceil((deadline-now)/86400000);
 const deadlineFeasibility=daysRemaining===null?null:daysRemaining<0?0:daysRemaining>=21?100:daysRemaining>=14?85:daysRemaining>=7?65:daysRemaining>=3?40:20;
 if(deadlineFeasibility!==null&&deadlineFeasibility<50)concerns.push("The submission deadline leaves limited preparation time");
 const weighted:[number|null,number][]=[[base.percentage,25],[eligibility,20],[capability,20],[financialFit,10],[experienceFit,10],[documentReadiness,5],[deadlineFeasibility,10]];
 const known=weighted.filter((v):v is [number,number]=>v[0]!==null);const weight=known.reduce((n,[,w])=>n+w,0);
 let overallScore=weight>=35?Math.round(known.reduce((n,[score,w])=>n+score*w,0)/weight):null;
 const hardStop=["CLOSED","CANCELLED","AWARDED","ARCHIVED"].includes(opportunity.status)||(deadline!==null&&deadline<=now);
 if(hardStop)overallScore=0;
 const buyerExcluded=safeList(profile.excluded_buyers).some(buyer=>normal(opportunity.buyer_name).includes(normal(buyer)));if(buyerExcluded){overallScore=0;concerns.unshift("This buyer is excluded in your procurement preferences");}
 if(opportunity.country_code!=="GH"&&profile.international_willingness===false){overallScore=0;concerns.unshift("Your business profile is set to Ghana-only opportunities");}
 let decision:RetentionAssessment["decision"]=overallScore===null?"UNKNOWN":overallScore>=85?"STRONG_GO":overallScore>=70?"GO":overallScore>=50?"REVIEW":"HIGH_RISK";
 if((missingCertifications.length||deadlineDocuments.length)&&["GO","STRONG_GO"].includes(decision))decision="REVIEW";
 if(hardStop||eligibility===0||buyerExcluded||(opportunity.country_code!=="GH"&&profile.international_willingness===false))decision="NO_GO";
 if(hardStop)concerns.unshift("This opportunity is not currently open for bidding");
 return{overallScore,decision,components:{businessMatch:base.percentage,eligibility,capability,financialFit,experienceFit,documentReadiness,deadlineFeasibility},reasons:[...new Set(reasons)].slice(0,8),concerns:[...new Set(concerns)].slice(0,8),evidence:{calculatedFrom:"BidScope verified opportunity record and your saved business profile",opportunityVerifiedAt:(opportunity as unknown as {last_verified_at?:string}).last_verified_at||null,knownWeight:weight,daysRemaining,officialSourceUrl:opportunity.official_source_url}};
}

export function calculateBusinessReadiness(profile:Organization,documents:SupplierDocument[]=[]){
 const validDocs=documents.filter(d=>documentValidity(d).usableThroughDeadline);
 const categories={
  companyInformation:{score:[profile.name,profile.business_description,profile.website,profile.phone,profile.company_size].filter(Boolean).length*20,weight:12},
  legalRegistration:{score:profile.registration_number?100:0,weight:14},
  financialInformation:{score:profile.annual_turnover_min!=null||profile.annual_turnover_max!=null?100:0,weight:12},
  experience:{score:safeList(profile.previous_contracts).length?100:profile.previous_contracts&&JSON.stringify(profile.previous_contracts)!=="[]"?100:0,weight:14},
  technicalCapability:{score:Math.min(100,(safeList(profile.sectors).length+safeList(profile.services).length+safeList(profile.products).length)*20),weight:16},
  certifications:{score:safeList(profile.certifications).length?100:0,weight:10},
  tenderDocuments:{score:Math.min(100,validDocs.length*20),weight:10},
  internationalReadiness:{score:profile.international_willingness===null||profile.international_willingness===undefined?0:profile.international_willingness?(profile.local_partnership_willingness===null||profile.local_partnership_willingness===undefined?60:100):100,weight:6},
  bidManagement:{score:profile.preferred_regions?.length||profile.preferred_minimum_value!=null||profile.preferred_maximum_value!=null?100:0,weight:6},
 };
 const overallScore=Math.round(Object.values(categories).reduce((n,c)=>n+c.score*c.weight,0)/100);
 const labels:Record<keyof typeof categories,string>={companyInformation:"Complete company identity and contact information",legalRegistration:"Add your business registration number",financialInformation:"Add an indicative turnover or preferred contract-value range",experience:"Record relevant previous contracts",technicalCapability:"Add sectors, services and products",certifications:"Add current certifications",tenderDocuments:"Upload and verify reusable tender documents",internationalReadiness:"Confirm international and local-partner preferences",bidManagement:"Set regions and contract-value preferences"};
 const recommendations=(Object.keys(categories) as (keyof typeof categories)[]).filter(k=>categories[k].score<100).sort((a,b)=>(100-categories[b].score)*categories[b].weight-(100-categories[a].score)*categories[a].weight).map(k=>({category:k,label:labels[k],score:categories[k].score,pointsAvailable:Math.round((100-categories[k].score)*categories[k].weight/100)}));
 const evidenceCount=Object.values(categories).filter(c=>c.score>0).length;
 return{overallScore,confidence:evidenceCount>=7?"high":evidenceCount>=4?"medium":"low",categoryScores:categories,recommendations,evidence:{validDocuments:validDocs.length,totalDocuments:documents.length,calculatedFrom:"Saved business profile and supplier-document register"}};
}

async function primaryOrganization(userId:string){
 const{data:members}=await supabaseRest<Array<{organization_id:string}>>(`organization_members?select=organization_id&user_id=eq.${userId}&order=created_at.asc&limit=1`);
 if(!members[0])return null;const{data}=await supabaseRest<Organization[]>(`organizations?select=*&id=eq.${members[0].organization_id}&limit=1`);return data[0]||null;
}

export async function refreshOrganizationRetention(userId:string){
 const organization=await primaryOrganization(userId);if(!organization)return{organization:null,bestMatch:null,readiness:null,matches:[],radar:[]};
 const now=new Date().toISOString();
 const[{data:opportunities},{data:documents},{data:feedback},{data:upcomingOpportunities}]=await Promise.all([
  supabaseRest<RetentionOpportunity[]>(`procurement_opportunities?select=*&status=in.(OPEN,CLOSING_SOON)&source_removed_at=is.null&or=(deadline_at.is.null,deadline_at.gt.${now})&order=published_at.desc.nullslast&limit=500`),
  supabaseRest<SupplierDocument[]>(`supplier_documents?select=id,document_type,title,issued_at,expires_at,verification_status&organization_id=eq.${organization.id}`),
  supabaseRest<Array<{opportunity_id:string}>>(`opportunity_feedback?select=opportunity_id&organization_id=eq.${organization.id}&action=in.(hidden,not_relevant)`),
  supabaseRest<RetentionOpportunity[]>("procurement_opportunities?select=*&status=eq.UPCOMING&source_removed_at=is.null&order=published_at.desc.nullslast&limit=100")
 ]);
 const excluded=new Set(feedback.map(f=>f.opportunity_id));
 const matches=opportunities.filter(o=>!excluded.has(o.id)).map(opportunity=>({opportunity,assessment:calculateRetentionAssessment(organization,opportunity,documents)}));
 if(matches.length){const rows=matches.map(({opportunity,assessment})=>({organization_id:organization.id,opportunity_id:opportunity.id,business_match_score:assessment.components.businessMatch,eligibility_score:assessment.components.eligibility,capability_score:assessment.components.capability,financial_fit_score:assessment.components.financialFit,experience_fit_score:assessment.components.experienceFit,document_readiness_score:assessment.components.documentReadiness,deadline_feasibility_score:assessment.components.deadlineFeasibility,overall_score:assessment.overallScore,decision:assessment.decision,reasons:assessment.reasons,concerns:assessment.concerns,evidence:assessment.evidence,evidence_hash:fingerprint({opportunity:opportunity.id,hash:(opportunity as unknown as {raw_source_hash?:string}).raw_source_hash,profile:organization,documents}),calculated_at:now}));await supabaseRest("organization_opportunity_matches?on_conflict=organization_id,opportunity_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify(rows)});}
 const eligible=matches.filter(x=>!["NO_GO","UNKNOWN"].includes(x.assessment.decision)&&x.assessment.overallScore!==null).sort((a,b)=>(b.assessment.overallScore||0)-(a.assessment.overallScore||0));const best=eligible[0]||null;
 await supabaseRest(`organizations?id=eq.${organization.id}`,{method:"PATCH",body:JSON.stringify({best_match_opportunity_id:best?.opportunity.id||null,best_match_score:best?.assessment.overallScore||null,best_match_reason:best?.assessment.reasons[0]||null,best_match_at:now})});
 const readiness=calculateBusinessReadiness(organization,documents);const readinessHash=fingerprint({profile:organization,documents});
 const{data:current}=await supabaseRest<Array<{id:string}>>(`business_readiness_scores?select=id&organization_id=eq.${organization.id}&is_current=eq.true&limit=1`);
 const readinessRow={organization_id:organization.id,overall_score:readiness.overallScore,confidence:readiness.confidence,category_scores:readiness.categoryScores,recommendations:readiness.recommendations,evidence:readiness.evidence,evidence_hash:readinessHash,calculated_at:now,is_current:true};
 if(current[0])await supabaseRest(`business_readiness_scores?id=eq.${current[0].id}`,{method:"PATCH",body:JSON.stringify(readinessRow)});else await supabaseRest("business_readiness_scores",{method:"POST",body:JSON.stringify(readinessRow)});
 const upcoming=upcomingOpportunities.filter(o=>{const a=calculateRetentionAssessment(organization,o,documents);return !excluded.has(o.id)&&(a.components.businessMatch===null||(a.components.businessMatch||0)>0);});
 const radar=upcoming.map(o=>({organization_id:organization.id,opportunity_id:o.id,buyer_id:o.buyer_normalized_id||null,buyer_name:o.buyer_name,signal_type:"OFFICIAL_UPCOMING",title:o.title,summary:o.summary||"Officially published upcoming procurement notice.",confidence:"official",evidence:{source:o.source_name,publishedAt:o.published_at,official:true},source_url:o.official_source_url,expected_at:o.deadline_at,status:"active",dedupe_key:`official-upcoming:${o.id}`}));
 if(radar.length)await supabaseRest("procurement_radar_items?on_conflict=organization_id,dedupe_key",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify(radar)});
 return{organization,bestMatch:best?{opportunity:best.opportunity,...best.assessment}:null,readiness,matches:matches.sort((a,b)=>(b.assessment.overallScore||-1)-(a.assessment.overallScore||-1)).slice(0,10),radar:upcoming.map(o=>({opportunity_id:o.id,slug:o.slug,title:o.title,summary:o.summary,buyer_name:o.buyer_name,signal_type:"OFFICIAL_UPCOMING",confidence:"official",source_url:o.official_source_url,expected_at:o.deadline_at}))};
}

export async function assessOpportunityForUser(userId:string,opportunityId:string,persistDecision=false){
 const organization=await primaryOrganization(userId);if(!organization)return null;
 const[{data:opportunities},{data:documents}]=await Promise.all([supabaseRest<RetentionOpportunity[]>(`procurement_opportunities?select=*&id=eq.${opportunityId}&limit=1`),supabaseRest<SupplierDocument[]>(`supplier_documents?select=id,document_type,title,issued_at,expires_at,verification_status&organization_id=eq.${organization.id}`)]);
 if(!opportunities[0])return null;const assessment=calculateRetentionAssessment(organization,opportunities[0],documents);
 if(persistDecision)await supabaseRest("bid_decisions?on_conflict=user_id,opportunity_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({user_id:userId,organization_id:organization.id,opportunity_id:opportunityId,overall_score:assessment.overallScore,decision:assessment.decision,component_scores:assessment.components,reasons:assessment.reasons,concerns:assessment.concerns,evidence:assessment.evidence,calculated_at:new Date().toISOString()})});
 return{organizationId:organization.id,opportunity:opportunities[0],...assessment};
}

export async function refreshAllOrganizationRetention(limit=25){const{data:members}=await supabaseRest<Array<{organization_id:string;user_id:string}>>(`organization_members?select=organization_id,user_id&order=created_at.asc&limit=${Math.min(100,limit*4)}`);const owners=[...new Map(members.map(item=>[item.organization_id,item])).values()].slice(0,limit);let refreshed=0;const errors:string[]=[];for(const owner of owners){try{await refreshOrganizationRetention(owner.user_id);refreshed++;}catch(error){errors.push(error instanceof Error?error.message:"Retention refresh failed");}}return{organizations:owners.length,refreshed,failed:errors.length,errors:errors.slice(0,10)};}
