import * as XLSX from "xlsx";
import {createHash} from "node:crypto";
import {classifyCompany,cleanMappedRow,scoreProspect,suggestColumnMappings,type ColumnSuggestion,type OutreachField} from "./intelligence.ts";

export type ParsedSheet={headers:string[];rows:Record<string,unknown>[]};

export function hashFile(buffer:Buffer){return createHash("sha256").update(buffer).digest("hex");}
export function parseProspectFile(buffer:Buffer,fileType:"csv"|"xlsx"|"xls"):ParsedSheet{
  void fileType;
  const workbook=XLSX.read(buffer,{type:"buffer",raw:false,cellDates:true,codepage:65001});
  const first=workbook.SheetNames[0];
  if(!first)return{headers:[],rows:[]};
  const matrix=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[first],{header:1,defval:"",blankrows:false,raw:false});
  const headers=(matrix.shift()||[]).map((value,index)=>String(value||`Column ${index+1}`).trim());
  const rows=matrix.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??""])));
  return{headers,rows};
}

export function analyseRows(parsed:ParsedSheet,mapping?:Record<string,string>){
  const suggestions=suggestColumnMappings(parsed.headers);
  const resolved:Record<string,string>=mapping||Object.fromEntries(suggestions.filter((item):item is ColumnSuggestion&{field:OutreachField}=>item.field!==null).map(item=>[item.source,item.field]));
  const staged=parsed.rows.map((raw,index)=>{
    const cleaned=cleanMappedRow(raw,resolved);
    const reasons:string[]=[];
    if(!cleaned.company_name)reasons.push("No company name");
    const originalEmail=Object.entries(resolved).find(([,target])=>target==="email")?.[0];
    if(originalEmail&&raw[originalEmail]&&!cleaned.email)reasons.push("Invalid email");
    const classification=classifyCompany({...raw,...cleaned});
    cleaned.industry=cleaned.industry||classification.primary;
    cleaned.secondary_industry=classification.secondary;
    cleaned.procurement_category=cleaned.procurement_category||classification.procurementCategory;
    cleaned.classification_confidence=classification.confidence;
    cleaned.classification_method=classification.method;
    cleaned.classification_signature=classification.signature;
    const fit=scoreProspect(cleaned);
    cleaned.bidscope_fit_score=fit.score;cleaned.priority=fit.priority;
    return{rowNumber:index+2,raw,cleaned,classification,fit,status:reasons.length?"rejected":"staged",reasons};
  });
  const countries=new Set(staged.map(x=>x.cleaned.country).filter(Boolean));
  const industries=new Map<string,number>();for(const row of staged){const key=String(row.cleaned.industry||"Other");industries.set(key,(industries.get(key)||0)+1);}
  const emails=staged.filter(x=>x.cleaned.email).length,phones=staged.filter(x=>x.cleaned.phone).length,websites=staged.filter(x=>x.cleaned.website).length;
  return{suggestions,mapping:resolved,staged,summary:{rowCount:staged.length,estimatedCompanies:staged.filter(x=>x.cleaned.company_name).length,emails,phones,websites,countries:[...countries],industries:Object.fromEntries([...industries].sort((a,b)=>b[1]-a[1]))}};
}
