import {setTimeout as pause} from "node:timers/promises";
import {openCatalogue} from "../lib/server/commerce/catalogue-store.ts";
import {supabaseRest,supabaseConfiguration} from "../lib/server/supabase-rest.ts";
if(process.env.BIDSCOPE_CATALOGUE_SUPABASE_READY!=="1"||new URL(supabaseConfiguration().url).hostname!=="bclyhnbzbgugfmxrtlvu.supabase.co")throw Error("The approved BidScope catalogue migration and environment are required.");
const store=openCatalogue();let batches=0,idle=0;
try{while(batches<1000){
 if(store.count()>50000)throw Error("The approved 50,000-product backfill limit was exceeded.");
 const rows=store.pendingCloud();
 if(!rows.length){const state=store.state(),temporaryPause=state?.status==="paused"&&/Temporary source|quota is temporarily/.test(state.reason);if((state?.status==="running"||temporaryPause)&&idle++<240){await pause(15000);continue;}console.log("All available local drafts have been copied to private Supabase storage.");break;}
 idle=0;
 // Only supplier metadata is upserted. Rights and publication status cannot be promoted.
 const payload=rows.map(row=>({source_id:"cj",...row}));let success=false;
 for(let attempt=0;attempt<3&&!success;attempt++){try{await supabaseRest("bidscope_catalogue_drafts?on_conflict=source_id,supplier_product_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(payload)});success=true;}catch(error){if(attempt===2)throw error;await pause(5000*2**attempt);}}
 store.markCloud(rows);batches++;console.log(JSON.stringify({cloudBatches:batches,rowsThisBatch:rows.length,localProducts:store.count(),publication:"draft"}));await pause(300);
}}finally{store.close();}
