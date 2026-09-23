import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { getVerificationRequest, notifyVerification, verificationAudit } from "@/lib/server/supplier-verification";
import { documentRisk, sha256 } from "@/lib/server/supplier-verification-policy";
import { PPA_BARRED_URL, PPA_SUPPLIER_URL, ppaResultStatus, type PpaResult } from "@/lib/server/ppa-supplier-verification";
import { supabaseConfiguration, supabaseRest, supabaseRpc } from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";
const actions=z.discriminatedUnion("action",[
  z.object({action:z.literal("check"),requestId:z.string().uuid(),checkType:z.string().min(2).max(80),status:z.enum(["passed","failed","needs_review","not_applicable"]),source:z.string().max(500).optional(),evidenceReference:z.string().max(500).optional(),notes:z.string().max(5000).optional(),resultCode:z.enum(["registered","not_found","needs_review","expired","inactive","unavailable","clear","possible_match","barred","source_unavailable"]).optional(),matchConfidence:z.number().min(0).max(1).optional(),checkedCompanyName:z.string().trim().max(300).optional(),checkedRegistrationNumber:z.string().trim().max(120).optional()}),
  z.object({action:z.literal("decision"),requestId:z.string().uuid(),decision:z.enum(["approve","reject","request_information","start_review"]),reason:z.string().trim().max(5000).default("")}),
  z.object({action:z.literal("settings"),enhancedPriceMinor:z.number().int().min(0).max(100000000),validityMonths:z.number().int().min(1).max(60),ppaRecheckMonths:z.number().int().min(1).max(24)}),
  z.object({action:z.literal("refund_review"),requestId:z.string().uuid(),eligible:z.boolean(),status:z.enum(["not_requested","under_review","approved","denied"]),reason:z.string().trim().min(1).max(5000)}),
  z.object({action:z.literal("assign_to_me"),requestId:z.string().uuid()}),
  z.object({action:z.literal("rerun_screening"),requestId:z.string().uuid()}),
]);

export async function GET(request:Request){
  try{
    await requireSuperAdmin(request);
    const params=new URL(request.url).searchParams;
    const status=params.get("status")||"all";
    const filter=status==="all"?"":`&status=eq.${encodeURIComponent(status)}`;
    const [{data:requests},{data:settings},{data:statuses},{data:allRequests}]=await Promise.all([
      supabaseRest<Array<Record<string,unknown>>>(`supplier_verification_requests?select=*&order=created_at.desc&limit=200${filter}`),
      supabaseRest<Array<{enhanced_price_minor:number;currency:string;validity_months:number;ppa_recheck_months:number;ppa_supplier_url:string;ppa_portal_url:string;ppa_barred_url:string}>>("supplier_verification_settings?select=enhanced_price_minor,currency,validity_months,ppa_recheck_months,ppa_supplier_url,ppa_portal_url,ppa_barred_url&id=eq.true&limit=1"),
      supabaseRest<Array<{organization_id:string;level:string;expires_at:string|null}>>("supplier_verification_status?select=organization_id,level,expires_at&limit=10000"),
      supabaseRest<Array<{requested_level:string;status:string;payment_status:string;amount_minor:number;refund_status:string;created_at:string;reviewed_at:string|null}>>("supplier_verification_requests?select=requested_level,status,payment_status,amount_minor,refund_status,created_at,reviewed_at&limit=10000"),
    ]);
    const orgIds=[...new Set(requests.map(item=>String(item.organization_id)))];
    const requestIds=requests.map(item=>String(item.id));
    const [{data:organizations},{data:checks},{data:documents},{data:audit}]=await Promise.all([
      orgIds.length?supabaseRest<Array<{id:string;name:string;registration_number:string|null;region:string|null;sectors:string[]}>>(`organizations?select=id,name,registration_number,region,sectors&id=in.(${orgIds.join(",")})`):Promise.resolve({data:[]}),
      requestIds.length?supabaseRest(`supplier_verification_checks?select=*&request_id=in.(${requestIds.join(",")})`):Promise.resolve({data:[]}),
      requestIds.length?supabaseRest(`supplier_verification_documents?select=id,request_id,document_type,original_filename,risk_level,integrity_flags,sha256,created_at&request_id=in.(${requestIds.join(",")})`):Promise.resolve({data:[]}),
      requestIds.length?supabaseRest(`supplier_verification_audit_log?select=id,request_id,action,details,created_at&request_id=in.(${requestIds.join(",")})&order=created_at.desc&limit=500`):Promise.resolve({data:[]}),
    ]);
    const paid=allRequests.filter(item=>item.requested_level==="enhanced_verified"&&item.payment_status==="paid");
    const ppaChecks=(checks as Array<{check_type:string;result_code?:string|null}>).filter(item=>item.check_type.startsWith("ppa_"));
    const analytics={applications:allRequests.length,paidApplications:paid.length,approvals:allRequests.filter(item=>item.status==="approved").length,rejections:allRequests.filter(item=>item.status==="rejected").length,pendingReviews:allRequests.filter(item=>["submitted","under_review"].includes(item.status)).length,informationRequired:allRequests.filter(item=>item.status==="information_required").length,expiringSoon:statuses.filter(item=>item.level!=="basic"&&item.expires_at&&Date.parse(item.expires_at)>Date.now()&&Date.parse(item.expires_at)<Date.now()+60*86400000).length,confirmedRevenueMinor:paid.reduce((sum,item)=>sum+item.amount_minor,0),refundReviewCount:allRequests.filter(item=>item.refund_status!=="not_requested").length,ppaRegistered:ppaChecks.filter(item=>item.check_type==="ppa_supplier_registration"&&item.result_code==="registered").length,ppaNeedsReview:ppaChecks.filter(item=>["needs_review","possible_match","not_found","unavailable","source_unavailable"].includes(item.result_code||"")).length,ppaExpiredOrInactive:ppaChecks.filter(item=>["expired","inactive"].includes(item.result_code||"")).length,ppaBarred:ppaChecks.filter(item=>item.check_type==="ppa_barred_supplier"&&item.result_code==="barred").length};
    return Response.json({data:{requests,organizations,checks,documents,audit,statuses:statuses.map(item=>({...item,effective_level:item.expires_at&&Date.parse(item.expires_at)<=Date.now()?"basic":item.level})),settings:settings[0],analytics}},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return apiErrorResponse(error);}
}

export async function POST(request:Request){
  try{
    const {user}=await requireSuperAdmin(request);
    const input=actions.parse(await request.json());
    if(input.action==="settings"){
      await supabaseRest("supplier_verification_settings?id=eq.true",{method:"PATCH",body:JSON.stringify({enhanced_price_minor:input.enhancedPriceMinor,validity_months:input.validityMonths,ppa_recheck_months:input.ppaRecheckMonths,updated_by:user.id,updated_at:new Date().toISOString()})});
      return Response.json({data:{saved:true}});
    }
    const application=await getVerificationRequest(input.requestId);
    if(input.action==="check"){
      if(!["submitted","under_review","information_required"].includes(application.status))throw new ApiError(409,"Checks can only be reviewed on an active application.","verification_not_reviewable");
      const {data:existing}=await supabaseRest<Array<{id:string;status:string;result_code:string|null}>>(`supplier_verification_checks?select=id,status,result_code&request_id=eq.${application.id}&check_type=eq.${encodeURIComponent(input.checkType)}&limit=1`);
      if(!existing[0])throw new ApiError(404,"Checklist item not found.","verification_check_missing");
      if(input.status==="not_applicable"&&["company_registration","company_name_match","registration_number_match","document_integrity","manual_review"].includes(input.checkType))throw new ApiError(400,"This core check must be completed.","core_check_required");
      if(input.status==="not_applicable"&&!input.notes?.trim())throw new ApiError(400,"Explain why this contextual check does not apply.","check_explanation_required");
      const isPpa=input.checkType==="ppa_supplier_registration"||input.checkType==="ppa_barred_supplier";
      if(isPpa&&!input.resultCode)throw new ApiError(400,"Choose the structured PPA result.","ppa_result_required");
      if(isPpa&&input.source&&!input.source.startsWith("https://ppa.gov.gh/")&&!input.source.startsWith("https://suppliers.ppa.gov.gh/"))throw new ApiError(400,"Use the official PPA Ghana source for this check.","ppa_official_source_required");
      if(isPpa&&["registered","clear","barred"].includes(input.resultCode||"")&&(!input.evidenceReference?.trim()||!input.notes?.trim()))throw new ApiError(400,"Record the official lookup reference and review notes for this PPA result.","ppa_evidence_required");
      const resolvedStatus=isPpa?ppaResultStatus(input.checkType,input.resultCode as PpaResult):input.status;
      if(resolvedStatus==="passed"&&!input.source?.trim())throw new ApiError(400,"Record the verification source before passing a check.","verification_source_required");
      const unavailable=isPpa&&["unavailable","source_unavailable"].includes(input.resultCode||"");
      const preserve=unavailable&&existing[0].status==="passed"&&["registered","clear"].includes(existing[0].result_code||"");
      const checkedAt=new Date();
      const {data:settings}=await supabaseRest<Array<{ppa_recheck_months:number}>>("supplier_verification_settings?select=ppa_recheck_months&id=eq.true&limit=1");
      const nextCheck=new Date(checkedAt);nextCheck.setUTCMonth(nextCheck.getUTCMonth()+(preserve?0:(settings[0]?.ppa_recheck_months||12)));if(preserve)nextCheck.setUTCDate(nextCheck.getUTCDate()+1);
      const update:Record<string,unknown>={status:preserve?existing[0].status:resolvedStatus,source:input.source||(input.checkType==="ppa_barred_supplier"?PPA_BARRED_URL:isPpa?PPA_SUPPLIER_URL:null),evidence_reference:input.evidenceReference||null,notes:input.notes||null,reviewed_by:user.id,reviewed_at:checkedAt.toISOString(),automated:false};
      if(isPpa)Object.assign(update,{result_code:preserve?existing[0].result_code:input.resultCode,match_confidence:input.matchConfidence??null,checked_company_name:input.checkedCompanyName||null,checked_registration_number:input.checkedRegistrationNumber||null,checked_at:checkedAt.toISOString(),next_check_at:nextCheck.toISOString()});
      await supabaseRest(`supplier_verification_checks?id=eq.${existing[0].id}`,{method:"PATCH",body:JSON.stringify(update)});
      await verificationAudit(application,user.id,preserve?"ppa_source_unavailable":"check_reviewed",{check_type:input.checkType,previous_status:existing[0].status,status:update.status,result_code:input.resultCode||null,preserved_last_known_good:preserve,source:update.source,evidence_reference:input.evidenceReference||null,next_check_at:isPpa?nextCheck.toISOString():null});
      return Response.json({data:{saved:true}});
    }
    if(input.action==="refund_review"){
      await supabaseRest(`supplier_verification_requests?id=eq.${application.id}`,{method:"PATCH",body:JSON.stringify({eligible_for_refund:input.eligible,refund_status:input.status,refund_reason:input.reason})});
      await verificationAudit(application,user.id,"refund_reviewed",{eligible:input.eligible,status:input.status,reason:input.reason});
      return Response.json({data:{saved:true}});
    }
    if(input.action==="assign_to_me"){
      await supabaseRest(`supplier_verification_requests?id=eq.${application.id}`,{method:"PATCH",body:JSON.stringify({assigned_to:user.id,updated_at:new Date().toISOString()})});
      await verificationAudit(application,user.id,"reviewer_assigned",{assigned_to:user.id});
      return Response.json({data:{assignedTo:user.id}});
    }
    if(input.action==="rerun_screening"){
      const {data:documents}=await supabaseRest<Array<{id:string;storage_path:string;mime_type:string;sha256:string}>>(`supplier_verification_documents?select=id,storage_path,mime_type,sha256&request_id=eq.${application.id}&limit=25`);
      if(!documents.length)throw new ApiError(409,"No private documents are available to screen.","verification_documents_required");
      const {url,serviceKey}=supabaseConfiguration();
      if(!serviceKey)throw new ApiError(503,"Private storage is unavailable.","storage_unavailable");
      let maximumRisk:"low"|"medium"|"high"="low";
      for(const document of documents){
        const response=await fetch(`${url}/storage/v1/object/supplier-verification-private/${document.storage_path}`,{headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},cache:"no-store"});
        if(!response.ok)throw new ApiError(503,"A private document could not be read for screening.","storage_read_failed");
        const bytes=new Uint8Array(await response.arrayBuffer());
        const digest=sha256(bytes);
        const {data:duplicates}=await supabaseRest<Array<{id:string}>>(`supplier_verification_documents?select=id&sha256=eq.${digest}&organization_id=neq.${application.organization_id}&limit=1`);
        const screened=documentRisk(bytes,document.mime_type,duplicates.length>0);
        const flags=[...screened.flags];
        if(digest!==document.sha256)flags.push("stored_hash_mismatch");
        const risk=flags.includes("stored_hash_mismatch")?"high":screened.risk;
        if(risk==="high")maximumRisk="high";else if(risk==="medium"&&maximumRisk==="low")maximumRisk="medium";
        await supabaseRest(`supplier_verification_documents?id=eq.${document.id}`,{method:"PATCH",body:JSON.stringify({risk_level:risk,integrity_flags:flags})});
        await verificationAudit(application,user.id,"document_screened",{document_id:document.id,risk_level:risk,flags});
      }
      await supabaseRest(`supplier_verification_requests?id=eq.${application.id}`,{method:"PATCH",body:JSON.stringify({risk_level:maximumRisk,updated_at:new Date().toISOString()})});
      return Response.json({data:{screened:documents.length,riskLevel:maximumRisk}});
    }
    if(input.decision!=="start_review"&&!input.reason)throw new ApiError(400,"Record a decision reason.","decision_reason_required");
    const {data}=await supabaseRpc<{decision:string;expires_at:string|null}>("decide_supplier_verification",{p_request_id:application.id,p_actor_id:user.id,p_decision:input.decision,p_reason:input.reason});
    const title=input.decision==="approve"?"Supplier verification approved":input.decision==="reject"?"Supplier verification decision":input.decision==="request_information"?"More verification information needed":"Supplier verification review started";
    await notifyVerification(application,title,input.decision==="approve"?`Your ${application.requested_level.replaceAll("_"," ")} status has been approved. It remains valid for the stated period.`:input.reason||"Your application is under review.",`${input.decision}-${new Date().toISOString()}`);
    return Response.json({data});
  }catch(error){return apiErrorResponse(error);}
}
