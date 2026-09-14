import {supabaseRest,supabaseRpc} from "./supabase-rest";
import {createNotification,stableDedupe} from "./notifications";
export async function processCustomerSearchAlerts(){
  const {data:searches}=await supabaseRest<Array<{id:string;user_id:string;name:string;filters:Record<string,unknown>;last_notified_at:string|null;created_at:string}>>("customer_saved_searches?select=*&alerts_enabled=eq.true&order=last_notified_at.asc.nullsfirst&limit=50");
  let generated=0;
  for(const search of searches){
    const now=new Date().toISOString();
    const {data:result}=await supabaseRpc<{data:Array<{id:string;title:string;slug:string}>;pagination:{total:number}}>("customer_discover",{p_user:search.user_id,filters:{...search.filters,publishedAfter:search.last_notified_at||search.created_at,sort:"newest"},page_number:1,page_size:5});
    if(result.pagination.total){
      const notice=await createNotification({userId:search.user_id,type:"opportunity_match",title:`${result.pagination.total} new results: ${search.name}`,message:result.data.map(o=>o.title).join(" · ").slice(0,1000),relatedUrl:`/customer/discover?${new URLSearchParams(Object.entries(search.filters).map(([k,v])=>[k,String(v)]))}`,priority:"normal",dedupeKey:stableDedupe(["saved-search",search.id,search.last_notified_at||search.created_at])});
      if(notice)generated++;
    }
    await supabaseRest(`customer_saved_searches?id=eq.${search.id}`,{method:"PATCH",body:JSON.stringify({last_notified_at:now})});
  }
  return generated;
}
