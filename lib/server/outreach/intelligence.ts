import {createHash} from "node:crypto";

export const OUTREACH_FIELDS=["company_name","first_name","last_name","contact_name","contact_role","email","phone","website","linkedin_url","company_address","city","region","country","postcode","industry","sub_industry","company_type","procurement_category","company_size","tender_activity_count","award_count","estimated_contract_value","last_procurement_activity","source_url"] as const;
export type OutreachField=typeof OUTREACH_FIELDS[number];
export type ColumnSuggestion={source:string;field:OutreachField|null;confidence:number};

const aliases:Record<OutreachField,string[]>={
  company_name:["company","company name","organisation","organization","business","business name","supplier","supplier name","vendor","contractor"],
  first_name:["first name","firstname","given name"],last_name:["last name","lastname","surname","family name"],
  contact_name:["contact","contact name","representative","contact person"],contact_role:["role","job title","position","contact role"],
  email:["email","email address","mail","business email","contact email","supplier email","e-mail"],
  phone:["phone","telephone","mobile","phone number","contact number","tel"],website:["website","web site","url","company website"],
  linkedin_url:["linkedin","linkedin url","linkedin profile"],company_address:["address","company address","business address","street address"],
  city:["city","town"],region:["region","state","province","county"],country:["country","nation","country name","country code"],postcode:["postcode","postal code","zip","zip code"],
  industry:["industry","sector","sector description","business sector","category"],sub_industry:["sub industry","sub-industry","sub sector"],
  company_type:["company type","business type","organisation type","organization type"],procurement_category:["procurement category","tender category","product category","service category","cpv description"],
  company_size:["company size","employees","employee count","staff size"],tender_activity_count:["tender count","tender appearances","procurement count","activity count"],
  award_count:["award count","contracts won","awards"],estimated_contract_value:["contract value","estimated value","award value","total value"],
  last_procurement_activity:["last activity","last procurement activity","latest activity","activity date"],source_url:["source url","record url","profile url"]
};

function words(value:string){return value.toLowerCase().replace(/[_\-.]+/g," ").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();}
function similarity(a:string,b:string){if(a===b)return 1;const aa=new Set(a.split(" ")),bb=new Set(b.split(" "));const common=[...aa].filter(x=>bb.has(x)).length;return common/Math.max(aa.size,bb.size,1);}
export function suggestColumnMappings(headers:string[]):ColumnSuggestion[]{return headers.map(source=>{const normalized=words(source);let best:ColumnSuggestion={source,field:null,confidence:0};for(const field of OUTREACH_FIELDS){for(const alias of aliases[field]){const score=normalized===alias?0.99:similarity(normalized,alias)*0.86;if(score>best.confidence)best={source,field:score>=0.55?field:null,confidence:Number(score.toFixed(2))};}}return best;});}

export function extractEmails(value:unknown){const matches=String(value||"").toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/g)||[];return[...new Set(matches.filter(email=>!email.includes("..")))];}
export function normalizeEmail(value:unknown){return extractEmails(value)[0]||null;}
export function normalizeCompanyName(value:unknown){return String(value||"").normalize("NFKD").toLowerCase().replace(/&/g," and ").replace(/\b(limited|ltd|incorporated|inc|llc|plc|company|co)\b\.?/g," ").replace(/[^a-z0-9]+/g," ").trim();}
export function normalizeUrl(value:unknown){let url=String(value||"").trim();if(!url)return null;if(!/^https?:\/\//i.test(url))url=`https://${url}`;try{const parsed=new URL(url);return parsed.protocol==="http:"||parsed.protocol==="https:"?parsed.toString():null;}catch{return null;}}
const countryAliases:Record<string,{name:string;code:string}>={ghana:{name:"Ghana",code:"GH"},gh:{name:"Ghana",code:"GH"},nigeria:{name:"Nigeria",code:"NG"},ng:{name:"Nigeria",code:"NG"},kenya:{name:"Kenya",code:"KE"},ke:{name:"Kenya",code:"KE"},"united kingdom":{name:"United Kingdom",code:"GB"},uk:{name:"United Kingdom",code:"GB"},gb:{name:"United Kingdom",code:"GB"},"south africa":{name:"South Africa",code:"ZA"},za:{name:"South Africa",code:"ZA"},ireland:{name:"Ireland",code:"IE"},canada:{name:"Canada",code:"CA"},"united states":{name:"United States",code:"US"},usa:{name:"United States",code:"US"},us:{name:"United States",code:"US"}};
export function normalizeCountry(value:unknown){const raw=words(String(value||""));return countryAliases[raw]||{name:String(value||"").trim()||null,code:raw.length===2?raw.toUpperCase():null};}
export function normalizePhone(value:unknown){const raw=String(value||"").trim();if(!raw)return null;const plus=raw.startsWith("+")?"+":"";const digits=raw.replace(/\D/g,"");return digits.length>=7&&digits.length<=15?`${plus}${digits}`:null;}

type Rule={industry:string;secondary?:string;keywords:string[]};
const rules:Rule[]=[
 {industry:"Construction",secondary:"Civil Engineering",keywords:["construction","contractor","civil engineering","road works","building works","infrastructure","quantity surveying","architect"]},
 {industry:"Medical Supplies",secondary:"Healthcare",keywords:["medical","pharma","hospital","laboratory","diagnostic","healthcare","clinic","surgical"]},
 {industry:"IT",secondary:"Software",keywords:["software","information technology","computer","digital","cyber","telecom","network","ict"]},
 {industry:"Logistics",secondary:"Transportation",keywords:["logistics","transport","freight","haulage","shipping","courier"]},
 {industry:"Facilities Management",secondary:"Cleaning",keywords:["facility","facilities","cleaning","janitorial","property maintenance"]},
 {industry:"Security",keywords:["security","guarding","surveillance"]},{industry:"Agriculture",keywords:["agric","farm","seed","fertilizer","agro"]},
 {industry:"Energy",secondary:"Renewable Energy",keywords:["energy","solar","power","electrical","renewable"]},{industry:"Mining",keywords:["mining","mineral","quarry"]},
 {industry:"Oil & Gas",keywords:["oil","gas","petroleum"]},{industry:"Professional Services",secondary:"Consulting",keywords:["consult","legal","accounting","audit","recruitment","training","advisory"]},
 {industry:"General Supplies",keywords:["general supplies","trading","enterprise","procurement","stationery","office supplies","furniture","printing","ppe"]},
 {industry:"Hospitality",secondary:"Catering",keywords:["hotel","hospitality","catering","food supply","restaurant"]},{industry:"Manufacturing",secondary:"Industrial Supplies",keywords:["manufactur","industrial","factory"]},
 {industry:"Waste Management",secondary:"Environmental Services",keywords:["waste","environment","sanitation","recycling"]},{industry:"Automotive",keywords:["automotive","vehicle","motor","spare parts"]},
];
export function classifyCompany(data:Record<string,unknown>){const text=words([data.company_name,data.industry,data.sub_industry,data.procurement_category,data.description,data.website,...Object.values(data)].filter(Boolean).join(" "));let best={industry:"Other",secondary:null as string|null,hits:0,matched:[] as string[]};for(const rule of rules){const matched=rule.keywords.filter(k=>text.includes(k));if(matched.length>best.hits)best={industry:rule.industry,secondary:rule.secondary||null,hits:matched.length,matched};}const confidence=best.hits>=3?0.97:best.hits===2?0.88:best.hits===1?0.72:0.35;return{primary:best.industry,secondary:best.secondary,procurementCategory:String(data.procurement_category||best.industry),confidence,confidenceLabel:confidence>=.85?"High":confidence>=.6?"Medium":"Low",method:best.hits?"deterministic_keywords":"unclassified",matchedKeywords:best.matched,signature:createHash("sha256").update(text).digest("hex")};}

export function scoreProspect(data:Record<string,unknown>,weights:Record<string,number>={email:10,website:5,tenderActivity:25,awards:20,recency:15,industry:15,engagement:10}){const tenders=Number(data.tender_activity_count||0),awards=Number(data.award_count||0);let score=0;if(data.email)score+=weights.email||0;if(data.website)score+=weights.website||0;score+=Math.min(weights.tenderActivity||0,Math.log2(tenders+1)*5);score+=Math.min(weights.awards||0,Math.log2(awards+1)*6);if(data.industry&&data.industry!=="Other")score+=weights.industry||0;if(data.last_procurement_activity){const age=(Date.now()-new Date(String(data.last_procurement_activity)).getTime())/86400000;if(age<=365)score+=weights.recency||0;else if(age<=730)score+=(weights.recency||0)/2;}score=Math.max(0,Math.min(100,Math.round(score)));return{score,priority:score>=85?"Hot":score>=70?"High":score>=40?"Medium":"Low"};}

export function duplicateConfidence(a:Record<string,unknown>,b:Record<string,unknown>){const ae=normalizeEmail(a.email),be=normalizeEmail(b.email);if(ae&&be&&ae===be)return{level:"exact",confidence:1};const ac=normalizeCompanyName(a.company_name),bc=normalizeCompanyName(b.company_name);if(ac&&bc&&ac===bc)return{level:"high",confidence:.96};const score=similarity(ac,bc);return score>=.72?{level:"possible",confidence:Number(score.toFixed(2))}:{level:"none",confidence:Number(score.toFixed(2))};}

export function cleanMappedRow(raw:Record<string,unknown>,mapping:Record<string,string>){const row:Record<string,unknown>={};for(const[source,target]of Object.entries(mapping))if(target&&OUTREACH_FIELDS.includes(target as OutreachField))row[target]=typeof raw[source]==="string"?raw[source].trim():raw[source];row.company_name=String(row.company_name||"").trim();row.normalized_company_name=normalizeCompanyName(row.company_name);row.email=normalizeEmail(row.email);row.normalized_email=row.email;row.website=normalizeUrl(row.website);row.linkedin_url=normalizeUrl(row.linkedin_url);row.phone=normalizePhone(row.phone);const country=normalizeCountry(row.country);row.country=country.name;row.country_code=country.code;for(const key of ["tender_activity_count","award_count","estimated_contract_value"])if(row[key]!=null)row[key]=Number(String(row[key]).replace(/[^0-9.-]/g,""))||0;return row;}
