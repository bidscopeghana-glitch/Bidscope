import test from "node:test";
import assert from "node:assert/strict";
import {normalizeCjDraft,createCjCatalogueInspector} from "../../lib/server/commerce/cj-catalogue.ts";
const product={pid:"p1",productNameEn:"Fixture lamp",productSku:"CJ-fixture",description:"<script>unsafe</script>",bigImage:"https://example.com/private.jpg",variants:[{vid:"v1",pid:"p1",variantNameEn:"White",variantSellPrice:"9.25"}]};
const token=async()=>({accessToken:"fixture-secret",accessTokenExpiryDate:"2099-01-01",refreshToken:"fixture-refresh",refreshTokenExpiryDate:"2099-01-01"});
test("CJ draft maps IDs deterministically without exposing media or supplier HTML",()=>{
 const first=normalizeCjDraft(product),second=normalizeCjDraft(product);
 assert.equal(first.variants[0].id,second.variants[0].id);assert.equal(first.variants[0].costUsdMinor,925);
 assert.equal(first.mediaAllowed,false);assert.equal(first.publication,"unreviewed");assert.equal(JSON.stringify(first).includes("private.jpg"),false);assert.equal(JSON.stringify(first).includes("script"),false);
 assert.notEqual(first.variants[0].id,normalizeCjDraft({...product,pid:"p2",variants:[{...product.variants[0],pid:"p2"}]}).variants[0].id);
});
test("CJ malformed prices, duplicate IDs and mismatched parent IDs fail closed",()=>{
 for(const patch of [{variants:[{...product.variants[0],variantSellPrice:null}]},{variants:[{...product.variants[0],variantSellPrice:"9-10"}]},{variants:[{...product.variants[0],pid:"another"}]},{variants:[product.variants[0],product.variants[0]]}])assert.throws(()=>normalizeCjDraft({...product,...patch}));
});
function fixture(stock=5,routes:unknown=[{logisticName:"Fixture courier",logisticAging:"10-20",logisticPrice:"5.25"}]){
 const calls:{url:string;init:RequestInit|undefined}[]=[];
 const transport=(async(url,init)=>{const path=String(url);calls.push({url:path,init});return Response.json({code:200,result:true,data:path.includes("stock/")?[{vid:"v1",countryCode:"CN",totalInventoryNum:stock,cjInventoryNum:2,factoryInventoryNum:3}]:path.includes("freightCalculate")?routes:product});}) as typeof fetch;
 return {calls,api:createCjCatalogueInspector(token,transport)};
}
test("Ghana freight validates product mapping and stock, with separate unknown taxes",async()=>{
 const {api,calls}=fixture();const result=await api.shipping("p1","v1","CN",2);
 assert.equal(result.checkoutEnabled,false);assert.equal(result.destination,"GH");assert.equal(result.routes[0].shippingUsdMinor,525);assert.equal(result.routes[0].taxUsdMinor,null);assert.equal(result.stock.factory,3);
 const write=calls.find(c=>c.init?.method==="POST")!;assert.match(write.url,/logistic\/freightCalculate$/);assert.equal(JSON.parse(String(write.init?.body)).endCountryCode,"GH");
 assert.ok(calls.every(c=>c.url.startsWith("https://developers.cjdropshipping.com/api2.0/v1/")));assert.ok(calls.every(c=>c.init?.redirect==="error"));
 assert.equal(JSON.stringify(result).includes("fixture-secret"),false);
});
test("international freight uses the selected destination rather than silently defaulting to Ghana",async()=>{const{api,calls}=fixture();const result=await api.shipping("p1","v1","CN",1,"GB");assert.equal(result.destination,"GB");const request=calls.find(c=>c.init?.method==="POST")!;assert.equal(JSON.parse(String(request.init?.body)).endCountryCode,"GB");await assert.rejects(api.shipping("p1","v1","CN",1,"INVALID"));});
test("foreign variants and insufficient origin stock never request freight",async()=>{
 const {api,calls}=fixture(0);await assert.rejects(api.shipping("p1","foreign","CN",1));assert.equal(calls.length,1);
 await assert.rejects(api.shipping("p1","v1","CN",1));assert.ok(calls.every(c=>!c.url.includes("freightCalculate")));
 await assert.rejects(api.shipping("p1","v1","US",1));assert.ok(calls.every(c=>!c.url.includes("freightCalculate")));
});
test("no routes and free shipping are distinct from unknown or malformed costs",async()=>{
 assert.equal((await fixture(5,[]).api.shipping("p1","v1","CN",1)).routes.length,0);
 assert.equal((await fixture(5,[{logisticName:"Free",logisticAging:"10",logisticPrice:0}]).api.shipping("p1","v1","CN",1)).routes[0].shippingUsdMinor,0);
 await assert.rejects(fixture(5,[{logisticName:"Bad",logisticAging:"10",logisticPrice:null}]).api.shipping("p1","v1","CN",1));
});
test("failed CJ envelopes and expired credentials cannot become catalogue products",async()=>{
 const bad=(async()=>Response.json({code:160000,result:false,data:product})) as typeof fetch;
 await assert.rejects(createCjCatalogueInspector(token,bad).product("p1"));
 let calls=0;const unused=(async()=>{calls++;return Response.json({});}) as typeof fetch;
 await assert.rejects(createCjCatalogueInspector(async()=>({...await token(),accessTokenExpiryDate:"2000-01-01"}),unused).product("p1"));assert.equal(calls,0);
 await assert.rejects(createCjCatalogueInspector(token,unused).product("../shopping/order"));assert.equal(calls,0);
});
test("CJ search uses official V2, bounded results and URL-encoded keywords",async()=>{
 let request="";const transport=(async(url)=>{request=String(url);return Response.json({code:200,result:true,data:{content:[{productList:[{id:"p1",nameEn:"Fixture lamp",sellPrice:"1-3",bigImage:"private"}]}]}});}) as typeof fetch;
 const rows=await createCjCatalogueInspector(token,transport).search("lamp & bag");
 assert.match(request,/product\/listV2\?/);assert.equal(new URL(request).searchParams.get("keyWord"),"lamp & bag");assert.equal(new URL(request).searchParams.get("size"),"12");assert.equal(rows[0].supplierId,"p1");assert.equal(JSON.stringify(rows).includes("private"),false);
});
test("CJ account reads are serialised and paced for the free tier",async()=>{
 const started:number[]=[];let active=0,maxActive=0;
 const transport=(async()=>{started.push(Date.now());active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return Response.json({code:200,result:true,data:product});}) as typeof fetch;
 const api=createCjCatalogueInspector(token,transport,25);
 await Promise.all([api.product("p1"),api.product("p1")]);
 assert.equal(maxActive,1);assert.ok(started[1]-started[0]>=23);
});
test("bulk reads respect the 6,000-result window and surface quota exhaustion",async()=>{
 let url="",calls=0;const transport=(async(input)=>{url=String(input);calls++;return Response.json({code:200,result:true,data:{totalPages:100,content:[{productList:[{id:"p1"}]}]},pointsInfo:{total:50000,usedToday:50,remaining:49950}});}) as typeof fetch;
 const api=createCjCatalogueInspector(token,transport,0),page=await api.cataloguePage("category",1);
 assert.equal(page.totalPages,60);assert.equal(new URL(url).searchParams.get("size"),"100");assert.equal(new URL(url).searchParams.get("categoryId"),"category");assert.equal(api.quota()?.remaining,49950);
 await assert.rejects(api.cataloguePage("category",61));assert.equal(calls,1);
 await api.cataloguePage("category",1,"desc");assert.equal(new URL(url).searchParams.get("sort"),"desc");assert.equal(new URL(url).searchParams.get("orderBy"),"3");
 const failed=createCjCatalogueInspector(token,(async()=>Response.json({code:429,result:false,pointsInfo:{total:50000,usedToday:50000,remaining:0}},{status:429})) as typeof fetch,0);
 await assert.rejects(failed.cataloguePage("category",1),e=>e instanceof Error&&"providerCode" in e&&e.providerCode===429);assert.equal(failed.quota()?.remaining,0);
});
test("failed-response quota placeholders cannot overwrite a usable quota snapshot",async()=>{
 let calls=0;
 const api=createCjCatalogueInspector(token,(async()=>++calls===1
  ?Response.json({code:200,result:true,data:{totalPages:1,content:[]},pointsInfo:{total:50000,usedToday:100,remaining:49900}})
  :Response.json({code:500,result:false,pointsInfo:{total:0,usedToday:0,remaining:0}},{status:500})) as typeof fetch,0);
 await api.cataloguePage("category",1);
 await assert.rejects(api.cataloguePage("category",1));
 assert.deepEqual(api.quota(),{total:50000,usedToday:100,remaining:49900});
 const unavailable=createCjCatalogueInspector(token,(async()=>Response.json({code:500,result:false,pointsInfo:{total:0,usedToday:0,remaining:0}},{status:500})) as typeof fetch,0);
 await assert.rejects(unavailable.cataloguePage("category",1));assert.equal(unavailable.quota(),null);
});
