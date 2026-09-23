export const PPA_SUPPLIER_URL = "https://ppa.gov.gh/suppliers/";
export const PPA_PORTAL_URL = "https://suppliers.ppa.gov.gh/";
export const PPA_BARRED_URL = "https://ppa.gov.gh/suppliers/barred-suppliers/";

export type PpaResult = "registered"|"not_found"|"needs_review"|"expired"|"inactive"|"unavailable"|"clear"|"possible_match"|"barred"|"source_unavailable";

const legalSuffixes = new Set(["limited","ltd","company","co","incorporated","inc","plc","llc"]);
export function normalizePpaCompanyName(value:string){
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(token=>token&&!legalSuffixes.has(token)).join(" ");
}
export function normalizePpaRegistrationNumber(value:string){return value.toUpperCase().replace(/[^A-Z0-9]/g,"");}
function tokens(value:string){return new Set(normalizePpaCompanyName(value).split(" ").filter(Boolean));}
export function ppaNameSimilarity(a:string,b:string){const left=tokens(a),right=tokens(b);if(!left.size||!right.size)return 0;let common=0;for(const token of left)if(right.has(token))common++;return common/(left.size+right.size-common);}
export function classifyPpaCandidate(input:{companyName:string;registrationNumber?:string|null},candidate:{companyName:string;registrationNumber?:string|null}){
  const registration=input.registrationNumber&&candidate.registrationNumber&&normalizePpaRegistrationNumber(input.registrationNumber)===normalizePpaRegistrationNumber(candidate.registrationNumber);
  const exactName=normalizePpaCompanyName(input.companyName)===normalizePpaCompanyName(candidate.companyName);
  if(registration||exactName)return {match:"exact" as const,confidence:1,mayAutoVerify:true};
  const confidence=ppaNameSimilarity(input.companyName,candidate.companyName);
  if(confidence>=0.72)return {match:"possible" as const,confidence,mayAutoVerify:false};
  return {match:"none" as const,confidence,mayAutoVerify:false};
}
export function ppaResultStatus(checkType:string,result:PpaResult){
  if(checkType==="ppa_supplier_registration"){
    if(result==="registered")return "passed" as const;
    if(result==="expired"||result==="inactive")return "failed" as const;
    return "needs_review" as const;
  }
  if(checkType==="ppa_barred_supplier"){
    if(result==="clear")return "passed" as const;
    if(result==="barred")return "failed" as const;
    return "needs_review" as const;
  }
  return "needs_review" as const;
}
