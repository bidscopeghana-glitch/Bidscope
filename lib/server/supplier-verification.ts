import { ApiError } from "./api-error.ts";
import { createNotification, stableDedupe } from "./notifications.ts";
import { supabaseRest } from "./supabase-rest.ts";
export { VERIFIED_CHECKS, ENHANCED_CHECKS, requiredChecks, mayApprove, effectiveLevel, sha256, documentRisk } from "./supplier-verification-policy.ts";
import type { VerificationLevel } from "./supplier-verification-policy.ts";

export type { VerificationLevel, VerificationCheck } from "./supplier-verification-policy.ts";
export type VerificationRequest = { id: string; organization_id: string; requested_level: Exclude<VerificationLevel,"basic">; status: string; submitted_by: string; payment_status: string; payment_reference: string | null; amount_minor: number; currency: string; created_at: string };
export async function verificationAudit(request: VerificationRequest, actorId: string | null, action: string, details: Record<string, unknown> = {}) {
  await supabaseRest("supplier_verification_audit_log", { method: "POST", body: JSON.stringify({ request_id: request.id, organization_id: request.organization_id, actor_id: actorId, action, details }) });
}
export async function notifyVerification(request: VerificationRequest, title: string, message: string, action: string) {
  await createNotification({ userId: request.submitted_by, organizationId: request.organization_id, type: "system", pushEventKey: "verification", title, message, relatedEntityType: "supplier_verification", relatedEntityId: request.id, relatedUrl: "/customer/verification", priority: "high", frequencyOverride: "instant", dedupeKey: stableDedupe(["supplier-verification", request.id, action]) });
}
export async function getVerificationRequest(id: string) {
  const { data } = await supabaseRest<VerificationRequest[]>(`supplier_verification_requests?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!data[0]) throw new ApiError(404, "Verification request not found.", "verification_not_found");
  return data[0];
}

export async function processSupplierVerificationExpiry(now = new Date()) {
  const today=now.toISOString().slice(0,10);
  const soon=new Date(now.getTime()+61*86400000).toISOString();
  const {data:statuses}=await supabaseRest<Array<{organization_id:string;level:VerificationLevel;expires_at:string;source_request_id:string|null}>>(`supplier_verification_status?select=organization_id,level,expires_at,source_request_id&level=neq.basic&expires_at=lte.${soon}&limit=500`);
  let reminders=0,expired=0;
  for(const status of statuses){
    const days=Math.ceil((Date.parse(status.expires_at)-now.getTime())/86400000);
    if(days>0){
      if(![60,30,7].includes(days)||!status.source_request_id)continue;
      const application=await getVerificationRequest(status.source_request_id);
      await notifyVerification(application,"Supplier verification expiring",`Your ${status.level.replaceAll("_"," ")} verification expires in ${days} days. Renew by submitting a new application; no automatic charge will be made.`,`expiry-${days}-${today}`);
      reminders++;
      continue;
    }
    if(!status.source_request_id)continue;
    const current=await getVerificationRequest(status.source_request_id);
    const {data:lower}=status.level==="enhanced_verified"?await supabaseRest<Array<{id:string;expiry_date:string;reviewed_at:string}>>(`supplier_verification_requests?select=id,expiry_date,reviewed_at&organization_id=eq.${status.organization_id}&requested_level=eq.verified&status=eq.approved&expiry_date=gt.${now.toISOString()}&order=reviewed_at.desc&limit=1`):{data:[]};
    const fallback=lower[0];
    await supabaseRest(`supplier_verification_status?organization_id=eq.${status.organization_id}&source_request_id=eq.${current.id}`,{method:"PATCH",body:JSON.stringify(fallback?{level:"verified",verified_at:fallback.reviewed_at,expires_at:fallback.expiry_date,source_request_id:fallback.id,updated_at:now.toISOString()}:{level:"basic",verified_at:null,expires_at:null,source_request_id:null,updated_at:now.toISOString()})});
    await supabaseRest(`supplier_verification_requests?id=eq.${current.id}&status=eq.approved`,{method:"PATCH",body:JSON.stringify({status:"expired",updated_at:now.toISOString()})});
    await verificationAudit(current,null,"verification_expired",{fallback_level:fallback?"verified":"basic"});
    await notifyVerification(current,"Supplier verification expired","Your verification badge has expired. Your supplier account remains active; apply for renewal when ready.","expired");
    expired++;
  }
  return {reminders,expired};
}
