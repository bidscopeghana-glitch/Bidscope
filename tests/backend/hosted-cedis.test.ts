import test from "node:test";
import assert from "node:assert/strict";
import {hostedPriceQuery,cediPrices} from "../../lib/server/commerce/hosted-prices.ts";
const fx={rateMicros:12345678,asOf:new Date().toISOString(),validUntil:new Date(Date.now()+60000).toISOString()};
test("hosted prices apply approved markup then convert to cedis with conservative rounding",()=>{
 assert.deepEqual(cediPrices([{supplier_product_id:"p1",min_usd_minor:100},{supplier_product_id:"unknown",min_usd_minor:null},{supplier_product_id:"free",min_usd_minor:0}],fx),{p1:1605,free:0});
 assert.throws(()=>cediPrices([{supplier_product_id:"bad",min_usd_minor:-1}],fx));
 assert.throws(()=>cediPrices([{supplier_product_id:"p1",min_usd_minor:100}],{...fx,validUntil:"2000-01-01T00:00:00Z"}));
});
test("hosted price lookup deduplicates and bounds trusted product identifiers",()=>{
 const result=hostedPriceQuery({productIds:["p1","p1","p2"]});assert.deepEqual(result.ids,["p1","p2"]);
 const query=new URL("https://fixture.invalid/"+result.path).searchParams;
 assert.equal(query.get("supplier_product_id"),"in.(p1,p2)");assert.equal(query.get("source_id"),"eq.cj");assert.equal(query.get("publication_status"),"in.(draft,held)");
 assert.throws(()=>hostedPriceQuery({productIds:["p1),bad"]}));assert.throws(()=>hostedPriceQuery({productIds:Array(101).fill("p1")}));
});
