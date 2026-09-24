import {createHash} from "node:crypto";
import {classifyCompany,cleanMappedRow,scoreProspect,suggestColumnMappings,type ColumnSuggestion,type OutreachField} from "./intelligence.ts";

export type ParsedSheet={headers:string[];rows:Record<string,unknown>[]};

export function hashFile(buffer:Buffer){return createHash("sha256").update(buffer).digest("hex");}

function parseCsv(source:string):string[][]{
  const rows:string[][]=[];
  let row:string[]=[],field="",quoted=false;
  for(let index=0;index<source.length;index++){
    const character=source[index];
    if(quoted){
      if(character==='"'&&source[index+1]==='"'){field+='"';index++;continue;}
      if(character==='"'){quoted=false;continue;}
      field+=character;continue;
    }
    if(character==='"'&&field.length===0){quoted=true;continue;}
    if(character===","){row.push(field);field="";continue;}
    if(character==="\n"||character==="\r"){
      if(character==="\r"&&source[index+1]==="\n")index++;
      row.push(field);field="";
      if(row.some(value=>value.length>0))rows.push(row);
      row=[];continue;
    }
    field+=character;
  }
  if(quoted)throw new Error("The CSV contains an unterminated quoted field.");
  row.push(field);
  if(row.some(value=>value.length>0))rows.push(row);
  return rows;
}

export function parseProspectFile(buffer:Buffer,fileType:"csv"|"xlsx"|"xls"):ParsedSheet{
  if(fileType!=="csv")throw new Error("Excel imports are temporarily disabled while BidScope replaces an unsafe spreadsheet parser. Export the file as CSV and upload it again.");
  const matrix=parseCsv(buffer.toString("utf8").replace(/^\uFEFF/,""));
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
