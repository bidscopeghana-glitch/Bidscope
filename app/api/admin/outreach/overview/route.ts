import {apiErrorResponse} from "@/lib/server/api-error";
import {requireSuperAdmin} from "@/lib/server/auth";
import {supabaseRest} from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";
async function count(path:string){const{response}=await supabaseRest<unknown[]>(path,{headers:{Range:"0-0",Prefer:"count=exact"}});const range=response.headers.get("content-range");return Number(range?.split("/")[1]||0);}
async function allValues(field:"country_code"|"industry"){const values:Array<Record<string,string|null>>=[];for(let offset=0;;offset+=1000){const{data}=await supabaseRest<Array<Record<string,string|null>>>(`prospects?select=${field}&order=id.asc&limit=1000&offset=${offset}`);values.push(...data);if(data.length<1000)break;}return values;}
export async function GET(request:Request){try{await requireSuperAdmin(request);const now=new Date(),month=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString();const[total,emails,phones,newThisMonth,hot,high,medium,low,campaigns,sent,delivered,clicks,unsubscribes,bounces]=await Promise.all([
  count("prospects?select=id"),count("prospects?select=id&normalized_email=not.is.null"),count("prospects?select=id&phone=not.is.null"),count(`prospects?select=id&created_at=gte.${encodeURIComponent(month)}`),
  count("prospects?select=id&priority=eq.Hot"),count("prospects?select=id&priority=eq.High"),count("prospects?select=id&priority=eq.Medium"),count("prospects?select=id&priority=eq.Low"),
  count("campaigns?select=id&state=in.(scheduled,sending)"),count("campaign_messages?select=id&status=in.(sent,delivered,opened,clicked,replied)"),count("campaign_messages?select=id&status=in.(delivered,opened,clicked,replied)"),count("campaign_messages?select=id&status=in.(clicked,replied)"),count("suppression_list?select=id&reason=eq.Unsubscribed&removed_at=is.null"),count("suppression_list?select=id&reason=eq.Hard%20Bounce&removed_at=is.null")]);
  const[countries,industries]=await Promise.all([allValues("country_code"),allValues("industry")]);const tally=(values:Array<string|null>)=>Object.entries(values.reduce<Record<string,number>>((acc,value)=>{const key=value||"Unknown";acc[key]=(acc[key]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,value])=>({name,value}));
  return Response.json({data:{metrics:{total,emails,phones,newThisMonth,hot,high,medium,low,campaigns,sent,delivered,clicks,unsubscribes,bounces,countries:new Set(countries.map(x=>x.country_code).filter(Boolean)).size,industries:new Set(industries.map(x=>x.industry).filter(Boolean)).size},countries:tally(countries.map(x=>x.country_code)),industries:tally(industries.map(x=>x.industry))}});
 }catch(error){return apiErrorResponse(error);}}
