import {mkdir,writeFile,rename} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {cjConnection} from "../lib/server/commerce/cj-connection.ts";
import {createCjCatalogueInspector} from "../lib/server/commerce/cj-catalogue.ts";
import {cjStorefrontPreview,cjPreviewFeedSchema} from "../lib/commerce/cj-preview.ts";
import type {Product} from "../lib/commerce/core.ts";
if(process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP!=="1")throw Error("Explicit local CJ setup is required.");
const inspector=createCjCatalogueInspector(()=>cjConnection.token());
const items:Product[]=[];
// Bounded, read-only selection for local design review, not a public catalogue import.
for(const group of [{keyword:"desk lamp",category:"Home & living",art:"lamp" as const},{keyword:"travel bag",category:"Bags & accessories",art:"bag" as const},{keyword:"storage box",category:"Home organisation",art:"chair" as const}]){
 const results=await inspector.search(group.keyword);
 for(const candidate of results.slice(0,2)){
  if(items.some(item=>item.supplierId===candidate.supplierId))continue;
  try{const {draft,image}=await inspector.preview(candidate.supplierId);items.push(cjStorefrontPreview(draft,image,group.category,group.art));console.log("Prepared CJ preview:",draft.sku);}
  catch{console.log("Skipped product with unavailable or unsupported preview data.");}
 }
}
if(!items.length)throw Error("No CJ preview items were available. Existing feed was not changed.");
const feed=cjPreviewFeedSchema.parse({version:1,mode:"private_cj_preview",generatedAt:new Date().toISOString(),items});
const directory=path.join(process.cwd(),".codex-tmp","commerce");await mkdir(directory,{recursive:true});
const temporary=path.join(directory,"preview-"+randomUUID()+".tmp");
await writeFile(temporary,JSON.stringify(feed),{mode:0o600,flag:"wx"});await rename(temporary,path.join(directory,"cj-preview.json"));
console.log(`Saved ${items.length} real CJ products for local review. No products were published and no orders were placed.`);
