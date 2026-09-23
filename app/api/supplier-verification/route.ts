import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireUser } from "@/lib/server/auth";
import { initializeVerificationCheckout, verifyVerificationPayment } from "@/lib/server/paystack";
import { ENHANCED_CHECKS, VERIFIED_CHECKS, effectiveLevel, notifyVerification, verificationAudit, type VerificationRequest } from "@/lib/server/supplier-verification";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("apply"), organizationId: z.string().uuid(), level: z.enum(["verified", "enhanced_verified"]) }),
  z.object({ action: z.literal("checkout"), requestId: z.string().uuid() }),
  z.object({ action: z.literal("confirm_payment"), reference: z.string().regex(/^bidscope_verify_[a-f0-9]{32}$/) }),
  z.object({ action: z.literal("submit"), requestId: z.string().uuid() }),
]);

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const organizationId = z.string().uuid().parse(new URL(request.url).searchParams.get("organizationId"));
    await requireOrganizationMember(user.id, organizationId);
    const [{data:status},{data:requests},{data:settings},{data:organizations},{data:profiles},{data:existingDocuments}] = await Promise.all([
      supabaseRest<Array<{level:"basic"|"verified"|"enhanced_verified";verified_at:string|null;expires_at:string|null}>>(`supplier_verification_status?select=level,verified_at,expires_at&organization_id=eq.${organizationId}&limit=1`),
      supabaseRest<VerificationRequest[]>(`supplier_verification_requests?select=*&organization_id=eq.${organizationId}&order=created_at.desc&limit=20`),
      supabaseRest<Array<{enhanced_price_minor:number;currency:string;validity_months:number;ppa_recheck_months:number;ppa_supplier_url:string;ppa_portal_url:string;ppa_barred_url:string}>>("supplier_verification_settings?select=enhanced_price_minor,currency,validity_months,ppa_recheck_months,ppa_supplier_url,ppa_portal_url,ppa_barred_url&id=eq.true&limit=1"),
      supabaseRest<Array<{name:string;registration_number:string|null;region:string|null;sectors:string[];procurement_contact:string|null}>>(`organizations?select=name,registration_number,region,sectors,procurement_contact&id=eq.${organizationId}&limit=1`),
      supabaseRest<Array<{full_name:string;phone_verified_at:string|null}>>(`profiles?select=full_name,phone_verified_at&id=eq.${user.id}&limit=1`),
      supabaseRest<Array<{id:string}>>(`supplier_documents?select=id&organization_id=eq.${organizationId}&limit=1`),
    ]);
    const ids=requests.map(item=>item.id);
    const [{data:checks},{data:documents}]=await Promise.all([
      ids.length?supabaseRest<Array<{id:string;request_id:string;check_type:string;status:string;source:string|null;reviewed_at:string|null;result_code:string|null;checked_at:string|null;next_check_at:string|null}>>(`supplier_verification_checks?select=id,request_id,check_type,status,source,reviewed_at,result_code,checked_at,next_check_at&request_id=in.(${ids.join(",")})`):Promise.resolve({data:[]}),
      ids.length?supabaseRest<Array<{id:string;request_id:string;document_type:string;original_filename:string;size_bytes:number;risk_level:string;integrity_flags:string[];created_at:string}>>(`supplier_verification_documents?select=id,request_id,document_type,original_filename,size_bytes,risk_level,integrity_flags,created_at&request_id=in.(${ids.join(",")})`):Promise.resolve({data:[]}),
    ]);
    const current=status[0];
    const company=organizations[0];
    const basicChecks={account:true,email:Boolean(user.emailConfirmedAt),phone:Boolean(profiles[0]?.phone_verified_at),company:Boolean(company?.name?.trim()),registration:Boolean(company?.registration_number?.trim()),category:Boolean(company?.sectors?.length),location:Boolean(company?.region?.trim()),contact:Boolean(company?.procurement_contact?.trim()||profiles[0]?.full_name?.trim()),documents:Boolean(existingDocuments.length||documents.length)};
    const level=effectiveLevel(current?.level||"basic",current?.expires_at||null);
    const latestRequest=requests[0];
    const latestChecks=new Map(checks.filter(item=>item.request_id===latestRequest?.id).map(item=>[item.check_type,item]));
    const readiness=[
      {key:"orc_registration",label:"ORC registration",status:latestChecks.get("company_registration")?.status||"not_recorded"},
      {key:"tax_clearance",label:"Tax / TCC",status:latestChecks.get("tax_clearance")?.status||"not_recorded"},
      {key:"ppa_registration",label:"PPA supplier registration",status:latestChecks.get("ppa_supplier_registration")?.result_code||latestChecks.get("ppa_supplier_registration")?.status||"not_recorded"},
      {key:"ghaneps_account",label:"GHANEPS account",status:"not_recorded"},
      {key:"sector_licence",label:"Sector licence",status:latestChecks.get("licence_check")?.status||"not_recorded"},
      {key:"bidscope_verification",label:"BidScope verification",status:level},
    ];
    return Response.json({data:{level,verifiedAt:current?.verified_at||null,expiresAt:current?.expires_at||null,basicChecks,requests,checks,documents,settings:settings[0]||null,governmentReadiness:readiness}},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return apiErrorResponse(error);}
}

export async function POST(request: Request) {
  try {
    const {user}=await requireUser(request);
    const input=inputSchema.parse(await request.json());
    if(input.action==="apply"){
      await requireOrganizationMember(user.id,input.organizationId);
      const {data:orgs}=await supabaseRest<Array<{id:string;can_bid:boolean}>>(`organizations?select=id,can_bid&id=eq.${input.organizationId}&limit=1`);
      if(!orgs[0]?.can_bid)throw new ApiError(403,"Only supplier organisations can apply.","supplier_required");
      const {data:existing}=await supabaseRest<Array<{id:string}>>(`supplier_verification_requests?select=id&organization_id=eq.${input.organizationId}&requested_level=eq.${input.level}&status=in.(draft,awaiting_payment,paid,submitted,under_review,information_required)&limit=1`);
      if(existing[0])throw new ApiError(409,"An application for this level is already open.","verification_already_open");
      const {data:settings}=await supabaseRest<Array<{enhanced_price_minor:number;currency:string}>>("supplier_verification_settings?select=enhanced_price_minor,currency&id=eq.true&limit=1");
      if(!settings[0])throw new ApiError(503,"Verification pricing is unavailable.","verification_configuration_missing");
      const enhanced=input.level==="enhanced_verified";
      const {data:created}=await supabaseRest<VerificationRequest[]>("supplier_verification_requests",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({organization_id:input.organizationId,requested_level:input.level,status:enhanced?"awaiting_payment":"draft",submitted_by:user.id,payment_status:enhanced?"pending":"not_required",amount_minor:enhanced?settings[0].enhanced_price_minor:0,currency:settings[0].currency})});
      const application=created[0];
      await supabaseRest("supplier_verification_checks",{method:"POST",body:JSON.stringify((enhanced?ENHANCED_CHECKS:VERIFIED_CHECKS).map(check_type=>({request_id:application.id,check_type,status:"pending"})))});
      await verificationAudit(application,user.id,"application_created",{level:input.level});
      return Response.json({data:application},{status:201});
    }
    const {data:items}=await supabaseRest<VerificationRequest[]>(`supplier_verification_requests?select=*&${input.action==="confirm_payment"?`payment_reference=eq.${encodeURIComponent(input.reference)}`:`id=eq.${input.requestId}`}&limit=1`);
    const application=items[0];
    if(!application)throw new ApiError(404,"Application not found.","verification_not_found");
    await requireOrganizationMember(user.id,application.organization_id);
    if(input.action==="checkout"){
      const checkout=await initializeVerificationCheckout({requestId:application.id,email:user.email});
      return Response.json({data:checkout});
    }
    if(input.action==="confirm_payment")return Response.json({data:await verifyVerificationPayment(input.reference)});
    if(!["draft","paid","information_required"].includes(application.status))throw new ApiError(409,"This application cannot be submitted.","verification_submission_unavailable");
    if(application.requested_level==="enhanced_verified"&&application.payment_status!=="paid")throw new ApiError(409,"Enhanced verification payment has not been confirmed.","verification_payment_required");
    const {data:docs}=await supabaseRest<Array<{id:string}>>(`supplier_verification_documents?select=id&request_id=eq.${application.id}&limit=1`);
    if(!docs.length)throw new ApiError(409,"Upload at least one supporting document first.","verification_documents_required");
    await supabaseRest(`supplier_verification_requests?id=eq.${application.id}`,{method:"PATCH",body:JSON.stringify({status:"submitted",submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
    await verificationAudit(application,user.id,"application_submitted");
    await notifyVerification(application,"Supplier verification submitted","Your verification application is awaiting BidScope review.","submitted");
    return Response.json({data:{status:"submitted"}});
  }catch(error){return apiErrorResponse(error);}
}
