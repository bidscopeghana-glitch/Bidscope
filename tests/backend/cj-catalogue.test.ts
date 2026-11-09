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
