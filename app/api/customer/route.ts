import { z } from "zod";
import { requireUser, requireOrganizationMember } from "@/lib/server/auth";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { supabaseRest, supabaseRpc } from "@/lib/server/supabase-rest";
import { pagination } from "@/lib/server/query";
import {getEntitlement,getPlanLimit,primaryOrganization,requireEntitlement,requireUserResourceCapacity} from "@/lib/server/entitlements";
import {guestOpportunityPreview,type GuestOpportunityInput} from "@/lib/server/procurement/guest-preview";
import {tenderAccessForUser} from "@/lib/server/tender-access";

export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const filtersSchema = z.object({
  q:z.string().max(160).optional(), scope:z.enum(["all","ghana","africa","international"]).optional(),
  stage:z.enum(["upcoming"]).optional(), collection:z.enum(["saved","recent","recommended"]).optional(),
  sort:z.enum(["newest","match","deadline"]).optional(),
  country:z.string().max(100).optional(), sector:z.string().max(160).optional(), buyer:z.string().max(160).optional(),
  source:z.string().max(100).optional(), region:z.string().max(100).optional(), category:z.string().max(100).optional(),
  contractType:z.string().max(100).optional(), procurementMethod:z.string().max(100).optional(), funding:z.string().max(160).optional(),
  currency:z.string().max(3).optional(), eligibility:z.enum(["","GHANA_ELIGIBLE","INTERNATIONAL_ELIGIBLE","RESTRICTED","UNCLEAR"]).optional(),
  minimumValue:z.coerce.number().min(0).max(1e15).optional(), maximumValue:z.coerce.number().min(0).max(1e15).optional(),
  match:z.coerce.number().int().min(0).max(100).optional(), days:z.coerce.number().int().min(0).max(365).optional(),
  deadlineBefore:z.string().date().optional(), publishedAfter:z.string().refine(v=>!Number.isNaN(Date.parse(v))).optional(),
});
const preparationSchema = z.object({
  checklist:z.array(z.object({label:z.string().max(200),done:z.boolean()})).max(50),
  questions:z.string().max(10000), requirements:z.string().max(10000), team:z.string().max(3000),
  documents:z.array(z.object({title:z.string().max(200),url:z.string().url().refine(v=>v.startsWith("https://"))})).max(50),
  deadlines:z.array(z.object({label:z.string().max(200),date:z.string().refine(v=>!Number.isNaN(Date.parse(v)))})).max(50),
});
const recipientsSchema=z.array(z.string().trim().toLowerCase().email().max(320)).max(5).transform(values=>[...new Set(values)]);
async function validateAlertRecipients(user:{id:string;email:string},recipients:string[]){const membership=await primaryOrganization(user.id);if(!membership)throw new ApiError(400,"Create a business profile before adding alert recipients.","profile_required");const entitlement=await getEntitlement(membership.organization_id,user);const limit=Math.max(1,getPlanLimit(entitlement,"alert_recipients"));if(recipients.length>limit)throw new ApiError(402,`Your plan supports ${limit} alert recipient${limit===1?"":"s"}. Upgrade to add more.`,"plan_limit_reached");if(recipients.length>1&&!entitlement.features.multi_recipient_alerts)throw new ApiError(402,"Multi-recipient alerts require BidScope Premium or Platinum.","premium_required");return recipients;}
export async function GET(request:Request) {
  try {
    const {user}=await requireUser(request); const params=new URL(request.url).searchParams;
    const resource=params.get("resource")||"pulse";
    if(resource==="discover") {
      const {page,pageSize}=pagination(params); const filters=filtersSchema.parse(Object.fromEntries([...params].filter(([,v])=>v!=="")));
      const access=await tenderAccessForUser(user);
      if(!access.allowed)for(const key of ["buyer","source","funding","contractType","procurementMethod"] as const)delete filters[key];
      const {data}=await supabaseRpc<{data:Array<GuestOpportunityInput&Record<string,unknown>>;pagination:Record<string,unknown>}>("customer_discover",{p_user:user.id,filters,page_number:page,page_size:pageSize});
      if(access.allowed)return Response.json(data,{headers:{"Cache-Control":"private, no-store",Vary:"Authorization"}});
      const previews=data.data.map(item=>({...guestOpportunityPreview(item),access:"member_preview" as const,match:item.match}));
      return Response.json({...data,data:previews},{headers:{"Cache-Control":"private, no-store",Vary:"Authorization"}});
    }
    if(resource==="pulse") {const {data}=await supabaseRpc<Record<string,unknown>>("customer_pulse",{p_user:user.id});const access=await tenderAccessForUser(user);return Response.json({data:access.allowed?data:{...data,buyers:[]}},{headers:{"Cache-Control":"private, no-store",Vary:"Authorization"}});}
    if(resource==="countries") {
      const query=new URLSearchParams({select:"country,country_code",status:"in.(OPEN,CLOSING_SOON)",deadline_at:`gte.${new Date().toISOString()}`,limit:"5000"});
      const{data}=await supabaseRest<Array<{country:string|null;country_code:string|null}>>(`procurement_opportunities?${query}`);
      const totals=new Map<string,{country:string;code:string;count:number}>();
      for(const row of data){const country=row.country?.trim();if(!country)continue;const key=country.toLocaleLowerCase("en");const current=totals.get(key);if(current)current.count++;else totals.set(key,{country,code:row.country_code||"",count:1});}
      const countries=[...totals.values()].sort((a,b)=>a.country.localeCompare(b.country,"en"));
      return Response.json({data:countries},{headers:{"Cache-Control":"private, max-age=300",Vary:"Authorization"}});
    }
    if(resource==="preferences" || resource==="searches" || resource==="preparation") {
      const table={preferences:"customer_preferences",searches:"customer_saved_searches",preparation:"customer_bid_preparation"}[resource];
      const q=new URLSearchParams({select:"*",user_id:`eq.${user.id}`,limit:resource==="searches"?"100":"1"});
      if(resource==="preparation")q.set("bid_id",`eq.${uuid.parse(params.get("bidId"))}`);
      const {data}=await supabaseRest(`${table}?${q}`);return Response.json({data});
    }
    if(resource==="amendments") {
      const id=uuid.parse(params.get("id")); const q=new URLSearchParams({select:"id,changed_fields,change_types,severity,verified_at",opportunity_id:`eq.${id}`,order:"verified_at.desc",limit:"50"});
      const {data}=await supabaseRest(`opportunity_revisions?${q}`);return Response.json({data});
    }
    throw new ApiError(400,"Unknown customer resource.","invalid_resource");
  }catch(error){return apiErrorResponse(error);}
}
export async function POST(request:Request) {
  try {
    const {user}=await requireUser(request);const body=z.record(z.string(),z.unknown()).parse(await request.json());
    const resource=z.enum(["visit","preferences","recent","searches","preparation","business"]).parse(body.resource);
    if(resource==="visit") {
      const {data}=await supabaseRest<Array<{last_visit_at:string|null;previous_visit_at:string|null}>>(`customer_preferences?select=last_visit_at,previous_visit_at&user_id=eq.${user.id}`);
      const previous=data[0];const now=new Date();
      // Keep a visit boundary stable across navigation and short reloads.
      if(!previous?.last_visit_at || now.getTime()-Date.parse(previous.last_visit_at)>30*60*1000) await supabaseRest("customer_preferences?on_conflict=user_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({user_id:user.id,last_visit_at:now.toISOString(),last_login_at:now.toISOString(),previous_visit_at:previous?.last_visit_at||null})});
      return Response.json({data:{recorded:true}});
    }
    if(resource==="preferences") {
      const preferences=z.object({compact:z.boolean().optional(),collapsed:z.boolean().optional(),hideMarket:z.boolean().optional(),hideInternational:z.boolean().optional(),deadlinesFirst:z.boolean().optional()}).parse(body.preferences);
      await supabaseRest("customer_preferences?on_conflict=user_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({user_id:user.id,preferences,updated_at:new Date().toISOString()})});
    }
    if(resource==="recent") {const opportunityId=uuid.parse(body.opportunityId);const viewedAt=new Date().toISOString();await Promise.all([supabaseRest("customer_recent_opportunities?on_conflict=user_id,opportunity_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({user_id:user.id,opportunity_id:opportunityId,viewed_at:viewedAt})}),supabaseRest("customer_preferences?on_conflict=user_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({user_id:user.id,last_opportunity_seen_at:viewedAt,updated_at:viewedAt})}),supabaseRest("analytics_events",{method:"POST",body:JSON.stringify({user_id:user.id,opportunity_id:opportunityId,event_name:"MATCH_OPENED",metadata:{surface:"customer_opportunity"}})})]);}
    if(resource==="searches") {
      const name=z.string().trim().min(1).max(160).parse(body.name);const filters=filtersSchema.parse(body.filters);const frequency=z.enum(["instant","daily","weekly"]).default("daily").parse(body.frequency);const recipients=await validateAlertRecipients(user,recipientsSchema.default([]).parse(body.deliveryRecipients));
      const membership=await primaryOrganization(user.id);if(!membership)throw new ApiError(400,"Create a business profile before saving a Tender Watch.","profile_required");
      await requireUserResourceCapacity({userId:user.id,organizationId:membership.organization_id,limitKey:"tender_watches",table:"customer_saved_searches",actor:user});
      if(frequency==="instant")await requireEntitlement(membership.organization_id,"smart_alerts",user);
      await supabaseRest("customer_saved_searches",{method:"POST",body:JSON.stringify({user_id:user.id,name,filters,frequency,alerts_enabled:false,delivery_recipients:recipients})});
    }
    if(resource==="preparation") {
      const bidId=uuid.parse(body.bidId);const {data}=await supabaseRest<unknown[]>(`user_bid_tracking?select=id&id=eq.${bidId}&user_id=eq.${user.id}&limit=1`);
      if(!data.length)throw new ApiError(404,"Bid not found.","not_found");
      const preparation=preparationSchema.parse(body.preparation);
      await supabaseRest("customer_bid_preparation?on_conflict=bid_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({bid_id:bidId,user_id:user.id,...preparation,updated_at:new Date().toISOString()})});
    }
    if(resource==="business") {
      const id=uuid.parse(body.organizationId); const membership=await requireOrganizationMember(user.id,id);
      if(!["owner","admin"].includes(membership.role))throw new ApiError(403,"Only business owners and administrators can edit this profile.","forbidden");
      const list=z.array(z.string().trim().min(1).max(160)).max(30);
      const business=z.object({name:z.string().trim().min(2).max(160),region:z.string().max(100).nullable(),business_description:z.string().max(3000).nullable().optional(),registration_number:z.string().max(160).nullable().optional(),website:z.string().url().nullable().optional(),phone:z.string().max(80).nullable().optional(),company_size:z.string().max(80).nullable().optional(),annual_turnover_min:z.number().min(0).nullable().optional(),annual_turnover_max:z.number().min(0).nullable().optional(),turnover_currency:z.string().length(3).nullable().optional(),international_willingness:z.boolean().nullable().optional(),local_partnership_willingness:z.boolean().nullable().optional(),sectors:list,services:list,products:list,certifications:list,preferred_regions:list,preferred_countries:list,preferred_buyers:list,excluded_buyers:list,preferred_opportunity_types:list,cpv_codes:list,unspsc_codes:list,preferred_minimum_value:z.number().min(0).nullable(),preferred_maximum_value:z.number().min(0).nullable()}).refine(v=>v.preferred_minimum_value===null||v.preferred_maximum_value===null||v.preferred_minimum_value<=v.preferred_maximum_value,"Minimum value must not exceed maximum value").refine(v=>v.annual_turnover_min==null||v.annual_turnover_max==null||v.annual_turnover_min<=v.annual_turnover_max,"Minimum turnover must not exceed maximum turnover").parse(body.business);
      await supabaseRest(`organizations?id=eq.${id}`,{method:"PATCH",body:JSON.stringify(business)});
    }
    return Response.json({data:{saved:true}});
  }catch(error){return apiErrorResponse(error);}
}
export async function PATCH(request:Request){
  try{const {user}=await requireUser(request);const input=z.object({id:uuid,alertsEnabled:z.boolean(),frequency:z.enum(["instant","daily","weekly"]).optional(),deliveryRecipients:recipientsSchema.optional()}).parse(await request.json());
    if(input.frequency==="instant"){const membership=await primaryOrganization(user.id);if(!membership)throw new ApiError(400,"Create a business profile before enabling immediate alerts.","profile_required");await requireEntitlement(membership.organization_id,"smart_alerts",user);}
    const recipients=input.deliveryRecipients?await validateAlertRecipients(user,input.deliveryRecipients):undefined;
    const {data}=await supabaseRest<unknown[]>(`customer_saved_searches?id=eq.${input.id}&user_id=eq.${user.id}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({alerts_enabled:input.alertsEnabled,...(input.frequency?{frequency:input.frequency}:{}),...(recipients?{delivery_recipients:recipients}:{})})});
    if(!data.length)throw new ApiError(404,"Saved search not found.","not_found");return Response.json({data:data[0]});
  }catch(error){return apiErrorResponse(error);}
}
export async function DELETE(request:Request){
  try{
    const {user}=await requireUser(request);
    const id=uuid.parse(new URL(request.url).searchParams.get("id"));
    const {data}=await supabaseRest<unknown[]>(`customer_saved_searches?id=eq.${id}&user_id=eq.${user.id}`,{method:"DELETE",headers:{Prefer:"return=representation"}});
    if(!data.length)throw new ApiError(404,"Saved search not found.","not_found");
    return Response.json({data:{deleted:true}});
  }catch(error){return apiErrorResponse(error);}
}
