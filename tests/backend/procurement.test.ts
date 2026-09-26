import assert from "node:assert/strict";
import test from "node:test";
import { deduplicationKeys } from "../../lib/server/procurement/deduplication.ts";
import { calculateOpportunityMatch } from "../../lib/server/procurement/matching.ts";
import { getSubmissionDestination } from "../../lib/server/procurement/submission.ts";
import type { NormalizedOpportunity } from "../../lib/server/procurement/types.ts";
import { WorldBankAdapter } from "../../lib/server/procurement/world-bank-adapter.ts";
import { contractsFinderAdapter, findATenderAdapter } from "../../lib/server/procurement/international-adapters.ts";

test("submission routing uses the exact official destination and source-specific label",()=>{assert.deepEqual(getSubmissionDestination({source_name:"GHANEPS",official_submission_url:"https://www.ghaneps.gov.gh/tender/123",official_tender_url:null,official_source_url:"https://www.ghaneps.gov.gh/"}),{destination:"https://www.ghaneps.gov.gh/tender/123",label:"Apply on GHANEPS"});});

test("deduplication includes reference, document, and composite evidence",()=>{const record={external_reference:"GR/001",document_fingerprint:"abc",buyer_name:"Ministry",title:"Supply laptops",deadline_at:"2026-10-01T00:00:00Z",estimated_value:100} as NormalizedOpportunity;const keys=deduplicationKeys(record);assert.equal(keys.length,3);assert.equal(keys[0],"reference:gr 001");});

test("matching reports only profile-backed and currency-comparable reasons",()=>{const profile={sectors:["ICT"],services:[],products:["laptops"],region:"Greater Accra",preferred_regions:["Greater Accra"],preferred_minimum_value:100000,preferred_maximum_value:500000,certifications:[]};const tender={title:"Supply of laptops",summary:"ICT equipment",sector:"ICT",category:"goods",region:"Greater Accra",estimated_value:250000,eligibility_text:null};const result=calculateOpportunityMatch(profile,{...tender,currency:"GHS"});assert.equal(result.percentage,100);assert.equal(result.reasons.length,3);const unknownCurrency=calculateOpportunityMatch(profile,tender);assert.equal(unknownCurrency.reasons.length,2);});

test("World Bank records are normalised, sanitised and deep-linked",async()=>{const normalized=await new WorldBankAdapter().normaliseOpportunity({id:"OP00999999",project_ctry_name:"Ghana",project_name:"Digital Ghana",bid_description:"<strong>Supply laptops</strong>",notice_text:"<p>Official notice</p><script>alert(1)</script>",procurement_group:"GO",bid_reference_no:"GH-WB-99",submission_deadline_date:"2026-12-01T00:00:00Z"});assert.equal(normalized.category,"goods");assert.equal(normalized.description,"Official notice");assert.equal(normalized.official_tender_url,"https://projects.worldbank.org/en/projects-operations/procurement-detail/OP00999999");assert.equal(normalized.funding_source,"World Bank");});

test("UK OCDS records deep-link to readable notices instead of bulk JSON", async () => {
  const contractsFinder = await contractsFinderAdapter.normaliseOpportunity({ id:"8c01f6e1-db71-465f-9e3d-90ecde605e9a-913382", ocid:"ocds-b5fd17-157a6d79-b43f-4088-8a4f-67fee28ab643", tender:{ title:"Supply equipment", documents:[{url:"https://www.contractsfinder.service.gov.uk/Notice/8c01f6e1-db71-465f-9e3d-90ecde605e9a"}] } });
  assert.equal(contractsFinder.official_tender_url, "https://www.contractsfinder.service.gov.uk/Notice/8c01f6e1-db71-465f-9e3d-90ecde605e9a");
  const findATender = await findATenderAdapter.normaliseOpportunity({ id:"084827-2026", ocid:"ocds-h6vhtk-06f465", tender:{ title:"Forestry services" } });
  assert.equal(findATender.official_tender_url, "https://www.find-tender.service.gov.uk/Notice/084827-2026");
});
