import {supabaseRest,supabaseRpc} from "./supabase-rest";
import {createNotification,stableDedupe} from "./notifications";
import {alertableSearchResults,isGhanepsSource} from "./ghaneps-alert-policy";
export async function processCustomerSearchAlerts(){
  const {data:searches}=await supabaseRest<Array<{id:string;user_id:string;name:string;filters:Record<string,unknown>;frequency:"instant"|"daily"|"weekly";delivery_recipients:string[];last_notified_at:string|null;created_at:string}>>("customer_saved_searches?select=*&alerts_enabled=eq.true&order=last_notified_at.asc.nullsfirst&limit=50");
  let generated=0;
  for(const search of searches){
    const now=new Date().toISOString();
    if(!isGhanepsSource(typeof search.filters.source==="string"?search.filters.source:null)){
      const {data:result}=await supabaseRpc<{data:Array<{id:string;title:string;slug:string;source_name:string}>;pagination:{total:number}}>("customer_discover",{p_user:search.user_id,filters:{...search.filters,publishedAfter:search.last_notified_at||search.created_at,sort:"newest"},page_number:1,page_size:50});
      const alertable=alertableSearchResults(result.data);
      if(alertable.length){
        const notice=await createNotification({userId:search.user_id,type:"matching_tender",title:`New results: ${search.name}`,message:alertable.slice(0,5).map(o=>o.title).join(" · ").slice(0,1000),relatedUrl:`/customer/discover?${new URLSearchParams(Object.entries(search.filters).map(([k,v])=>[k,String(v)]))}`,priority:"normal",frequencyOverride:search.frequency,metadata:{deliveryRecipients:search.delivery_recipients||[]},dedupeKey:stableDedupe(["saved-search",search.id,search.last_notified_at||search.created_at])});
        if(notice)generated++;
      }
    }
    await supabaseRest(`customer_saved_searches?id=eq.${search.id}`,{method:"PATCH",body:JSON.stringify({last_notified_at:now})});
  }
  return generated;
}
