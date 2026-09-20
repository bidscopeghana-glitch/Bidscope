import"server-only";
import{supabaseRest}from"./supabase-rest";
import{generateSeoReport}from"./seo-operations";
import{syncSearchConsole}from"./search-console";
const site=(process.env.NEXT_PUBLIC_SITE_URL||"https://www.bidscopeghana.com").replace(/\/$/,"");
async function checkUrl(path:string){try{const response=await fetch(`${site}${path}`,{signal:AbortSignal.timeout(12000),cache:"no-store"});return{ok:response.ok,status:response.status,text:response.ok?await response.text():""}}catch(error){return{ok:false,status:0,text:error instanceof Error?error.message:"Request failed"}}}
export async function runSeoMaintenance(){
 const now=new Date(),checks:Array<{check_key:string;status:string;affected_count:number;message:string;details?:Record<string,unknown>}>=[];
 const[robots,sitemap,home]=await Promise.all([checkUrl("/robots.txt"),checkUrl("/sitemap.xml"),checkUrl("/")]);
 checks.push({check_key:"robots_accessible",status:robots.ok?"pass":"critical",affected_count:robots.ok?0:1,message:robots.ok?"robots.txt is accessible.":`robots.txt returned ${robots.status||"a connection error"}.`});
 const sitemapUrls=sitemap.ok?(sitemap.text.match(/<loc>/g)||[]).length:0;checks.push({check_key:"sitemap_health",status:sitemap.ok&&sitemapUrls>0?"pass":"critical",affected_count:sitemap.ok?0:1,message:sitemap.ok?`Sitemap is accessible with ${sitemapUrls} URLs.`:`Sitemap returned ${sitemap.status||"a connection error"}.`,details:{urlCount:sitemapUrls}});
 const homepageNoindex=/noindex/i.test(home.text);checks.push({check_key:"homepage_indexability",status:home.ok&&!homepageNoindex?"pass":"critical",affected_count:home.ok&&!homepageNoindex?0:1,message:!home.ok?`Homepage returned ${home.status||"a connection error"}.`:homepageNoindex?"Homepage contains a noindex directive.":"Homepage remains indexable."});
 const{response:thinResponse}=await supabaseRest<unknown[]>("procurement_opportunities?select=id&status=in.(OPEN,CLOSING_SOON)&or=(summary.eq.,description.eq.)",{count:"exact"}),thin=Number(thinResponse.headers.get("content-range")?.split("/")[1]||0);
 checks.push({check_key:"thin_tender_pages",status:thin>50?"warning":"pass",affected_count:thin,message:thin?`${thin} open tender records require richer source-grounded descriptions.`:"No thin open tender records were detected."});
 const reviewCutoff=new Date(Date.now()-180*86400000).toISOString();
 const{data:staleContent}=await supabaseRest<Array<{id:string;slug:string}>>(`seo_content_items?status=eq.published&indexable=eq.true&or=(last_reviewed_at.is.null,last_reviewed_at.lt.${reviewCutoff})&select=id,slug&limit=1000`);
 if(staleContent.length)await Promise.all(staleContent.map(item=>supabaseRest(`seo_content_items?id=eq.${item.id}`,{method:"PATCH",body:JSON.stringify({status:"refresh_due",freshness_score:50})})));
 checks.push({check_key:"content_refresh_due",status:staleContent.length?"warning":"pass",affected_count:staleContent.length,message:staleContent.length?`${staleContent.length} published Insights are due for evidence and link review; they remain public until an administrator reviews them.`:"Published Insights are within the six-month review window."});
 const checkRows=checks.map(item=>({...item,details:item.details||{}}));
 await supabaseRest("seo_technical_checks",{method:"POST",body:JSON.stringify(checkRows)});
 for(const check of checks.filter(item=>item.status==="critical"))await supabaseRest("seo_alerts",{method:"POST",body:JSON.stringify({alert_type:check.check_key,severity:"critical",title:`SEO check failed: ${check.check_key.replaceAll("_"," ")}`,message:check.message,metadata:check.details||{}})});
 let searchConsole:Record<string,unknown>={status:"READY — REQUIRES OWNER ACTION"};if(process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL&&process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY){try{searchConsole={status:"succeeded",...await syncSearchConsole(null)}}catch(error){searchConsole={status:"failed",message:error instanceof Error?error.message:"Search Console sync failed"}}}
 const reports:Record<string,unknown>={};if(now.getUTCDay()===1)reports.weekly=await generateSeoReport("weekly",null);if(now.getUTCDate()===1)reports.monthly=await generateSeoReport("monthly",null);
 return{checks,searchConsole,reports};
}
