import {randomUUID} from "node:crypto";
import {setTimeout as pause} from "node:timers/promises";
import {cjConnection} from "../lib/server/commerce/cj-connection.ts";
import {createCjCatalogueInspector,CjReadError} from "../lib/server/commerce/cj-catalogue.ts";
import {openCatalogue} from "../lib/server/commerce/catalogue-store.ts";
import {catalogueItem,interleaveDepartments,type CatalogueState} from "../lib/commerce/catalogue.ts";
if(process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP!=="1")throw Error("Local staging must be explicitly enabled.");
const target=Number(process.env.CJ_CATALOGUE_TARGET||50000),maxPages=Number(process.env.CJ_CATALOGUE_BATCH_PAGES||10);
if(!Number.isInteger(target)||target<1||target>50000||!Number.isInteger(maxPages)||maxPages<1||maxPages>1000)throw Error("Invalid bounded import settings.");
const store=openCatalogue(),owner=randomUUID(),api=createCjCatalogueInspector(()=>cjConnection.token());
let state:CatalogueState=store.state()||{target,categoryIndex:0,page:1,status:"running",reason:"",updatedAt:new Date().toISOString(),categories:[],quota:null};
let retries=0;
let stopRequested=false;process.on("SIGINT",()=>{stopRequested=true;});process.on("SIGTERM",()=>{stopRequested=true;});
try{
 if(!store.claim(owner))throw Error("Another catalogue worker owns the active lease.");
 state.target=target;
 if(!state.categories.length){state.categories=(await api.categories()).filter(c=>!/(weapons|firearm|adult|sexual|vape|tobacco|medical|knife|knives|supplement)/i.test(c.name));store.save([],state);}
 if(state.orderingVersion!==1){const prefix=state.categories.slice(0,state.categoryIndex+1);state.categories=[...prefix,...interleaveDepartments(state.categories.slice(state.categoryIndex+1))];state.orderingVersion=1;store.save([],state);}
 for(let processed=0;processed<maxPages&&store.count()<target&&!stopRequested;){
  if(!store.claim(owner))throw Error("Worker lease was lost.");
  const category=state.categories[state.categoryIndex];if(!category){state.status="exhausted";state.reason="All selected source categories were scanned; target may not be available.";break;}
  if(api.quota()&&api.quota()!.remaining<1000){state.status="paused";state.reason="Reserved the last 1,000 reported CJ points for interactive account checks.";break;}
  try{
   const result=await api.cataloguePage(category.id,state.page);retries=0;
   const items=result.items.map(item=>catalogueItem(item,category)).filter(item=>item!==null);
   if(state.page>=result.totalPages||!result.items.length){state.categoryIndex++;state.page=1;}else state.page++;
   state={...state,status:"running",reason:"",quota:api.quota(),updatedAt:new Date().toISOString()};store.save(items,state);processed++;
   console.log(JSON.stringify({imported:store.count(),target,pages:processed,category:category.name,quota:state.quota}));
  }catch(error){
   state={...state,status:"paused",reason:error instanceof CjReadError?error.message:"Temporary source read or response validation failure.",quota:api.quota(),updatedAt:new Date().toISOString()};store.save([],state);
   if(error instanceof CjReadError&&[429,16900500].includes(error.providerCode)&&retries++<5){console.log("CJ quota pause; cursor preserved. Waiting 60 seconds.");await pause(60000);continue;}
   if((error instanceof DOMException&&error.name==="TimeoutError"||error instanceof TypeError&&error.message==="fetch failed"||error instanceof CjReadError&&error.providerCode>=500)&&retries++<3){console.log("Transient CJ read failure; retrying the saved cursor with backoff.");await pause(Math.min(60000,5000*2**retries));continue;}
   throw error;
  }
 }
 if(store.count()>=target){state.status="complete";state.reason="Unique-product target reached; no products published.";}else if(stopRequested){state.status="paused";state.reason="Operator pause requested; committed cursor preserved.";}else if(state.status==="running"){state.status="paused";state.reason="Bounded batch finished; run again to resume.";}
 store.save([],state);console.log(JSON.stringify({imported:store.count(),target,status:state.status,reason:state.reason}));
}finally{store.release(owner);store.close();}
