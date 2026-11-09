import test from "node:test";
import assert from "node:assert/strict";
import {retailUsdMinor} from "../../lib/commerce/retail-pricing.ts";
import {plainProductText,productPresentation} from "../../lib/commerce/product-presentation.ts";
import {catalogueItem} from "../../lib/commerce/catalogue.ts";
import {normalizeCjDraft} from "../../lib/server/commerce/cj-catalogue.ts";
import {readBag,addBagLine} from "../../lib/commerce/shopping-bag.ts";
import {dailyFxSnapshot,ghsMinor} from "../../lib/server/commerce/daily-fx.ts";
import {createProductReader} from "../../lib/server/commerce/product-reader.ts";
const item=catalogueItem({id:"p1",nameEn:"Fixture",sku:"S1",bigImage:"https://cf.cjdropshipping.com/photo.jpg",sellPrice:"2"},{id:"c1",name:"Home"})!;
const product=normalizeCjDraft({pid:"p1",productNameEn:"Fixture",variants:[{vid:"v1",pid:"p1",variantSellPrice:2}]});
test("retail markup is 30 percent with safe cent rounding and invalid-money rejection",()=>{assert.equal(retailUsdMinor(1000),1300);assert.equal(retailUsdMinor(1),2);assert.throws(()=>retailUsdMinor(-1));assert.throws(()=>retailUsdMinor(Number.MAX_SAFE_INTEGER));});
test("product presentation rejects cross-product data, removes executable markup and filters galleries",()=>{
 const p=productPresentation(item,product,{description:'<p>Hello &amp; welcome</p><script>alert(1)</script><img src=x onerror=alert(2)>',productImageSet:['https://cf.cjdropshipping.com/two.jpg','https://evil.invalid/x.jpg'],accessToken:'fixture-private',materialNameEn:'["Cotton"]',productWeight:'100'});
 assert.equal(p.description,'Hello & welcome');assert.equal(p.images.length,2);assert.equal(p.material,'Cotton');assert.equal(JSON.stringify(p).includes('fixture-private'),false);assert.equal(p.product.publication,'unreviewed');assert.equal(p.product.mediaAllowed,false);
 assert.throws(()=>productPresentation({...item,supplierId:'other'},product,{}));assert.equal(plainProductText('<style>hidden</style>Readable'),'Readable');
});
test("real-item bag merges only identical product and variant mappings and bounds quantities",()=>{
 const line={productId:'p1',variantId:'v1',name:'Fixture',variant:'Blue',image:item.image,unitUsdMinor:260,quantity:2};const next=addBagLine([line],{...line,quantity:3});assert.equal(next.length,1);assert.equal(next[0].quantity,5);assert.equal(addBagLine([line],{...line,variantId:'v2'}).length,2);assert.throws(()=>addBagLine([line],{...line,quantity:999}));assert.deepEqual(readBag('[{"image":"javascript:evil"}]'),[]);
});
test("daily FX conversions use integer arithmetic and reject stale, future or wrong-base feeds",()=>{
 const now=Date.UTC(2026,10,9,12),raw={result:'success',base_code:'USD',time_last_update_unix:(now-3600000)/1000,time_next_update_unix:(now+23*3600000)/1000,rates:{USD:1,GHS:10.123456}};const fx=dailyFxSnapshot(raw,now);
 assert.equal(ghsMinor(1300,fx,now),13161);assert.throws(()=>dailyFxSnapshot({...raw,base_code:'EUR'},now));assert.throws(()=>dailyFxSnapshot(raw,now+48*3600000));assert.throws(()=>dailyFxSnapshot({...raw,time_last_update_unix:(now+3600000)/1000},now));assert.throws(()=>ghsMinor(100,fx,now+48*3600000));
});
test("simultaneous product reads share one supplier call and a short-lived preview cache",async()=>{
 let calls=0,now=1000;const load=createProductReader(async()=>{calls++;await new Promise(r=>setTimeout(r,5));return productPresentation(item,product,{});},()=>now);
 const[a,b]=await Promise.all([load('p1'),load('p1')]);assert.equal(calls,1);assert.equal(a,b);await load('p1');assert.equal(calls,1);now+=60001;await load('p1');assert.equal(calls,2);
});
