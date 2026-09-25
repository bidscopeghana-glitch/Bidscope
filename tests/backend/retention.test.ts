import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {calculateBusinessReadiness,calculateRetentionAssessment,type Organization,type RetentionOpportunity} from "../../lib/server/procurement/retention.ts";
import {changeSeverity} from "../../lib/server/procurement/ingestion.ts";

const profile:Organization={id:"org",name:"Acme Engineering",country_code:"GH",registration_number:"CS123",website:"https://example.com",phone:"0200000000",company_size:"20",business_description:"Electrical works and solar installation",sectors:["energy"],services:["electrical works","solar installation"],products:[],region:"Greater Accra",preferred_regions:["Greater Accra"],preferred_minimum_value:10000,preferred_maximum_value:500000,certifications:["Electrical Wiring Certificate"],annual_turnover_max:800000,international_willingness:true,local_partnership_willingness:true,previous_contracts:[{title:"Solar installation"}]};
const opportunity:RetentionOpportunity={id:"opp",slug:"solar",title:"Solar electrical installation",summary:"Electrical works for public buildings",buyer_name:"Public Authority",country:"Ghana",country_code:"GH",currency:"GHS",deadline_at:new Date(Date.now()+30*86400000).toISOString(),published_at:new Date().toISOString(),status:"OPEN",eligibility_status:"GHANA_ELIGIBLE",eligibility_text:"Electrical Wiring Certificate required",official_source_url:"https://example.gov.gh/tender",source_name:"Official source",verification_status:"OFFICIAL",sector:"energy",category:"works",region:"Greater Accra",estimated_value:200000};

test("retention assessment produces an explainable positive decision from known evidence",()=>{const result=calculateRetentionAssessment(profile,opportunity,[{id:"doc",document_type:"certificate",title:"Electrical Wiring Certificate",expires_at:null,verification_status:"verified"}]);assert.ok((result.overallScore||0)>=70);assert.ok(["GO","STRONG_GO"].includes(result.decision));assert.ok(result.reasons.length>0);assert.equal(result.components.eligibility,100);});
test("a published eligibility restriction is a hard no-go",()=>{const result=calculateRetentionAssessment(profile,{...opportunity,eligibility_status:"RESTRICTED"});assert.equal(result.decision,"NO_GO");assert.equal(result.components.eligibility,0);});
test("readiness score is evidence-based and gives actionable gaps",()=>{const result=calculateBusinessReadiness({...profile,certifications:[]},[]);assert.ok(result.overallScore>0&&result.overallScore<100);assert.ok(result.recommendations.some(item=>item.category==="certifications"));assert.ok(result.recommendations.some(item=>item.category==="tenderDocuments"));});
test("stronger business evidence improves readiness",()=>{const sparse=calculateBusinessReadiness({...profile,registration_number:null,website:null,phone:null,sectors:[],services:[],certifications:[],previous_contracts:[]},[]);const complete=calculateBusinessReadiness(profile,[{id:"doc",document_type:"registration",title:"Registration",expires_at:null,verification_status:"verified"}]);assert.ok(complete.overallScore>sparse.overallScore);});
test("closed opportunities can never receive a go decision",()=>{const result=calculateRetentionAssessment(profile,{...opportunity,status:"CLOSED"});assert.equal(result.decision,"NO_GO");assert.equal(result.overallScore,0);});
test("a current certificate expiring before tender close reduces document readiness",()=>{
 const expires=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
 const result=calculateRetentionAssessment(profile,opportunity,[{id:"doc",document_type:"certificate",title:"Wiring certificate",expires_at:expires,verification_status:"verified"}]);
 assert.equal(result.components.documentReadiness,0);
 assert.ok(result.concerns.some(concern=>concern.includes("tender deadline")));
 assert.ok(!["GO","STRONG_GO"].includes(result.decision));
});
test("a published certification gap requires review even with a strong category match",()=>{
 const result=calculateRetentionAssessment(profile,{...opportunity,required_certifications:["ISO 9001"]});
 assert.ok(!["GO","STRONG_GO"].includes(result.decision));
 assert.ok(result.concerns.some(concern=>concern.includes("ISO 9001")));
});
test("invalid deadlines do not produce NaN scores",()=>{
 const result=calculateRetentionAssessment(profile,{...opportunity,deadline_at:"unknown"});
 assert.equal(result.components.deadlineFeasibility,null);
 assert.ok(result.overallScore===null||Number.isFinite(result.overallScore));
});
test("tender changes use meaningful severity rather than urgent metadata noise",()=>{assert.equal(changeSeverity(["deadline_at"]),"CRITICAL");assert.equal(changeSeverity(["estimated_value"]),"IMPORTANT");assert.equal(changeSeverity(["description"]),"INFORMATIONAL");});
test("retention schema is persistent, protected and reuses customer discovery",()=>{const migration=readFileSync(new URL("../../supabase/migrations/20260914133000_procurement_retention_engine.sql",import.meta.url),"utf8");for(const table of ["organization_opportunity_matches","opportunity_feedback","bid_decisions","business_readiness_scores","procurement_radar_items"])assert.match(migration,new RegExp(`create table if not exists public\\.${table}`));assert.match(migration,/enable row level security/g);assert.match(migration,/not exists\(select 1 from opportunity_feedback/);});
