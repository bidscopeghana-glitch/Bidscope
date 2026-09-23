import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { documentRisk, effectiveLevel, ENHANCED_CHECKS, mayApprove, sha256, VERIFIED_CHECKS, type VerificationCheck } from "../../lib/server/supplier-verification-policy.ts";

const migration=readFileSync("supabase/migrations/20260923235500_supplier_verification.sql","utf8");
const payment=readFileSync("lib/server/paystack.ts","utf8");
const documentRoute=readFileSync("app/api/supplier-verification/documents/route.ts","utf8");
const reviewRoute=readFileSync("app/api/admin/supplier-verifications/route.ts","utf8");
const tenderRoute=readFileSync("app/api/procurement/route.ts","utf8");
const supplierRoute=readFileSync("app/api/supplier-verification/route.ts","utf8");
const verificationServer=readFileSync("lib/server/supplier-verification.ts","utf8");
const passed=(types:readonly string[]):VerificationCheck[]=>types.map(check_type=>({check_type,status:"passed"}));

test("basic status is the safe default; expired badges are inactive",()=>{
 assert.match(migration,/level text not null default 'basic'/);
 assert.equal(effectiveLevel("basic",null),"basic");
 assert.equal(effectiveLevel("verified","2026-01-01T00:00:00Z",new Date("2026-09-23T00:00:00Z")),"basic");
 assert.equal(effectiveLevel("enhanced_verified","2027-01-01T00:00:00Z",new Date("2026-09-23T00:00:00Z")),"enhanced_verified");
});
test("verified application requires all core and PPA checks",()=>{
 assert.equal(VERIFIED_CHECKS.length,7);
 assert.equal(mayApprove({requested_level:"verified",payment_status:"not_required"},passed(VERIFIED_CHECKS)),true);
 assert.equal(mayApprove({requested_level:"verified",payment_status:"not_required"},passed(VERIFIED_CHECKS.slice(0,4))),false);
});
test("enhanced payment alone never grants approval",()=>{
 assert.equal(mayApprove({requested_level:"enhanced_verified",payment_status:"paid"},[]),false);
 assert.equal(mayApprove({requested_level:"enhanced_verified",payment_status:"pending"},passed(ENHANCED_CHECKS)),false);
 assert.equal(mayApprove({requested_level:"enhanced_verified",payment_status:"paid"},passed(ENHANCED_CHECKS)),true);
});
test("contextual checks may be not applicable but official core checks cannot",()=>{
 const checks=passed(VERIFIED_CHECKS.slice(0,5));
 checks.push(...ENHANCED_CHECKS.slice(5).map(check_type=>({check_type,status:"not_applicable" as const})));
 assert.equal(mayApprove({requested_level:"enhanced_verified",payment_status:"paid"},checks),true);
 checks[0].status="not_applicable";
 assert.equal(mayApprove({requested_level:"enhanced_verified",payment_status:"paid"},checks),false);
});
test("SHA-256 and conservative file screening",()=>{
 assert.equal(sha256(new TextEncoder().encode("example")),"50d858e0985ecc7f60418aaf0cc5ab587f42c2570a884095a9e8ccacd0f6545c");
 assert.deepEqual(documentRisk(new TextEncoder().encode("%PDF-1.7"),"application/pdf",false),{risk:"low",flags:[]});
 assert.equal(documentRisk(new TextEncoder().encode("%PDF-1.7"),"application/pdf",true).risk,"medium");
 assert.equal(documentRisk(new TextEncoder().encode("not pdf"),"application/pdf",false).risk,"high");
});
test("supplier cannot write status, checks or approval directly",()=>{
 assert.match(migration,/alter table public\.supplier_verification_status enable row level security/);
 assert.match(migration,/grant select on public\.supplier_verification_settings/);
 assert.doesNotMatch(migration,/grant (?:insert|update|delete) on public\.supplier_verification_status[^;]*to authenticated/i);
 assert.match(migration,/revoke update on public\.supplier_documents from authenticated/);
 assert.match(migration,/revoke insert,update,delete on public\.supplier_verification_settings/);
 assert.match(migration,/revoke all on public\.supplier_verification_settings[^;]*from anon/);
 assert.match(migration,/grant insert\(organization_id,uploaded_by,document_type,title,storage_path,source_url,issued_at,expires_at,metadata\) on public\.supplier_documents/);
 assert.match(reviewRoute,/requireSuperAdmin\(request\)/);
 assert.match(migration,/payment_status<>'paid'/);
});
test("an enhanced application snapshots the configurable fee without editing historical payments",()=>{
 assert.match(migration,/enhanced_price_minor bigint not null default 50000/);
 assert.match(supplierRoute,/amount_minor:enhanced\?settings\[0\]\.enhanced_price_minor:0/);
 assert.match(reviewRoute,/supplier_verification_settings\?id=eq\.true/);
 assert.match(reviewRoute,/action==="settings"\)[\s\S]*?supabaseRest\("supplier_verification_settings\?id=eq\.true"/);
});
test("application and review actions are audited",()=>{
 assert.match(supplierRoute,/verificationAudit\(application,user\.id,"application_created"/);
 assert.match(supplierRoute,/verificationAudit\(application,user\.id,"application_submitted"/);
 assert.match(reviewRoute,/verificationAudit\(application,user\.id,preserve\?"ppa_source_unavailable":"check_reviewed"/);
 assert.match(migration,/insert into public\.supplier_verification_audit_log\(request_id,organization_id,actor_id,action,details\)/);
});
test("expiry reminders, renewal history and lower-tier fallback remain separate",()=>{
 assert.match(verificationServer,/\[60,30,7\]\.includes\(days\)/);
 assert.match(verificationServer,/requested_level=eq\.verified&status=eq\.approved/);
 assert.match(verificationServer,/verification_expired/);
 assert.match(migration,/source_request_id uuid/);
});
test("supplier applications and documents require organisation membership",()=>{
 assert.match(supplierRoute,/requireOrganizationMember\(user\.id,input\.organizationId\)/);
 assert.match(supplierRoute,/requireOrganizationMember\(user\.id,application\.organization_id\)/);
 assert.match(documentRoute,/requireOrganizationMember\(user\.id,application\.organization_id\)/);
});
test("the separate service payment never edits subscription entitlements",()=>{
 assert.match(payment,/bidscope_payment_kind:"SUPPLIER_VERIFICATION"/);
 assert.match(payment,/complete_supplier_verification_payment/);
 assert.doesNotMatch(migration,/update public\.subscriptions/);
});
test("verification payment uses existing signed webhook and server-side Paystack verification",()=>{
 assert.match(payment,/verifyVerificationPayment\(reference\)/);
 assert.match(payment,/transaction\/verify/);
 assert.match(payment,/p_amount_minor:payment\.amount/);
 assert.match(migration,/if item\.payment_status='paid' then return jsonb_build_object\('processed',false,'idempotent',true\)/);
 assert.doesNotMatch(payment,/payment_status:"paid"/);
});
test("documents stay in a private bucket and require membership or admin access",()=>{
 assert.match(migration,/supplier-verification-private','supplier-verification-private',false/);
 assert.match(documentRoute,/requireOrganizationMember\(user\.id,doc\.organization_id\)/);
 assert.match(documentRoute,/requireSuperAdmin\(request\)/);
 assert.match(documentRoute,/"Cache-Control":"private, no-store"/);
 assert.doesNotMatch(documentRoute,/getPublicUrl|publicUrl/);
});
test("buyer filter and tender requirement preserve basic suppliers by default",()=>{
 assert.match(tenderRoute,/verificationFilter === "all"|verificationFilter = params\.get\("verification"\) \|\| "all"/);
 assert.match(migration,/supplier_verification_requirement text not null default 'any'/);
 assert.match(tenderRoute,/supplier_verification_required/);
});
