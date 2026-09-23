import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {classifyPpaCandidate,normalizePpaCompanyName,normalizePpaRegistrationNumber,ppaResultStatus} from "../../lib/server/ppa-supplier-verification.ts";

const migration=readFileSync("supabase/migrations/20260924010000_ppa_supplier_verification.sql","utf8");
const adminRoute=readFileSync("app/api/admin/supplier-verifications/route.ts","utf8");
const adminUi=readFileSync("app/admin/command-centre/supplier-verifications/page.tsx","utf8");
const supplierUi=readFileSync("components/customer/supplier-verification.tsx","utf8");

test("PPA company and registration normalization is deterministic",()=>{
 assert.equal(normalizePpaCompanyName("  ACME & Sons Limited "),"acme and sons");
 assert.equal(normalizePpaRegistrationNumber(" cs-123 / 2024 "),"CS1232024");
});
test("exact registration or normalized name may match but fuzzy candidates never auto verify",()=>{
 assert.deepEqual(classifyPpaCandidate({companyName:"Acme Limited",registrationNumber:"CS-123"},{companyName:"Different Trading",registrationNumber:"CS123"}),{match:"exact",confidence:1,mayAutoVerify:true});
 const ambiguous=classifyPpaCandidate({companyName:"Acme Engineering Ghana Limited"},{companyName:"Acme Engineering Services Ghana Ltd"});
 assert.equal(ambiguous.match,"possible");assert.equal(ambiguous.mayAutoVerify,false);
 assert.equal(classifyPpaCandidate({companyName:"Acme Engineering"},{companyName:"Completely Different"}).mayAutoVerify,false);
});
test("structured PPA results map conservatively",()=>{
 assert.equal(ppaResultStatus("ppa_supplier_registration","registered"),"passed");
 assert.equal(ppaResultStatus("ppa_supplier_registration","not_found"),"needs_review");
 assert.equal(ppaResultStatus("ppa_supplier_registration","expired"),"failed");
 assert.equal(ppaResultStatus("ppa_barred_supplier","clear"),"passed");
 assert.equal(ppaResultStatus("ppa_barred_supplier","possible_match"),"needs_review");
 assert.equal(ppaResultStatus("ppa_barred_supplier","barred"),"failed");
});
test("migration stores PPA evidence and keeps writes service-only",()=>{
 for(const column of ["result_code","match_confidence","checked_company_name","checked_registration_number","checked_at","next_check_at"])assert.match(migration,new RegExp(`add column if not exists ${column}`));
 assert.match(migration,/ppa_supplier_registration/);assert.match(migration,/ppa_barred_supplier/);
 assert.match(migration,/grant execute on function public\.decide_supplier_verification[\s\S]*to service_role/);
 assert.doesNotMatch(migration,/grant (?:insert|update|delete)[^;]*supplier_verification_checks[^;]*to authenticated/i);
});
test("PPA review stays manual and preserves a last known good result when the source is unavailable",()=>{
 assert.match(adminRoute,/preserved_last_known_good/);
 assert.match(adminRoute,/ppa_source_unavailable/);
 assert.doesNotMatch(adminRoute,/fetch\([^)]*ppa\.gov\.gh/);
 assert.match(adminUi,/Manual evidence only/);
 assert.match(adminUi,/A possible\/fuzzy match cannot pass verification/);
});
test("supplier readiness explains PPA and GHANEPS separately",()=>{
 assert.match(supplierUi,/PPA supplier registration and GHANEPS participation are related but separate/);
 assert.match(supplierUi,/Government Procurement Readiness/);
 assert.match(supplierUi,/Register \/ learn more at PPA/);
});
