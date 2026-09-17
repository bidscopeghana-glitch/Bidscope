export const SERVICE_CATALOG = [
  {code:"tender-review",name:"Tender & eligibility review",description:"Request a scoped review of the notice, qualification conditions and documents you supply.",deliverables:["Requirements checklist","Eligibility gaps","Clarification questions"]},
  {code:"company-profile",name:"Company profile preparation",description:"Organise your supplied business facts, capabilities and project experience into a proposal-ready profile.",deliverables:["Company profile structure","Capability narrative","Experience schedule"]},
  {code:"proposal-support",name:"Proposal preparation support",description:"Choose specific proposal sections or request a wider preparation scope. Availability is confirmed before a quote.",deliverables:["Technical approach outline","Methodology draft","Submission checklist"]},
  {code:"cv-preparation",name:"Tender-specific staff CVs",description:"Structure CVs around genuine staff qualifications and relevant experience supplied by your business.",deliverables:["CV structure","Experience alignment","Consistency review"]},
  {code:"market-research",name:"Custom procurement research",description:"Commission a defined buyer, sector or historic-awards research brief using available public evidence.",deliverables:["Research brief","Source register","Evidence gaps"]},
  {code:"training",name:"Remote onboarding & training",description:"Request a remote session on using BidScope, researching notices or organising your bid workflow.",deliverables:["Agreed session agenda","Remote training session","Action checklist"]},
] as const;
export const SERVICE_CODES = ["tender-review","company-profile","proposal-support","cv-preparation","market-research","training"] as const;
export type ServiceRequest = {id:string;service_code:string;brief:string;deliverables:string[];quantity:number;requested_date:string|null;status:string;version:number;created_at:string;quote_scope:string|null;quote_amount_minor:number|null;quote_expires_at:string|null;turnaround_days:number|null;quote_terms:string|null;accepted_at:string|null};
export const serviceName=(code:string)=>SERVICE_CATALOG.find(service=>service.code===code)?.name||code;
