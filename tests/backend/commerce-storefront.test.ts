import test from "node:test";
import assert from "node:assert/strict";
import {publicationAction} from "../../lib/commerce/storefront.ts";
import {storefrontQuery,storefrontProduct,validReviewExpiry} from "../../lib/server/commerce/storefront.ts";
const now=Date.parse("2026-11-10T12:00:00Z"),fx={rateMicros:12000000,asOf:new Date(now-1000).toISOString(),validUntil:new Date(now+86400000).toISOString()};
const row={product_id:"CJ_TEST",title:"Reviewed lamp",description:"A reviewed product description with actual specifications.",category:"Home",image_url:"https://cf.cjdropshipping.com/a.jpg",origin:"CN",checked_at:new Date(now).toISOString(),rights_evidence:"PRIVATE EVIDENCE",approved_by:"PRIVATE ACTOR",snapshot:{variants:[{supplierId:"v1",name:"Small",costUsdMinor:100},{supplierId:"v2",name:"Large",costUsdMinor:200}]}};
test("public query cannot request draft, retired or expired products",()=>{
 const {path}=storefrontQuery({q:"lamp",category:"Home",sort:"low",page:2},now),q=new URLSearchParams(path.split("?")[1]);
 assert.equal(q.get("status"),"eq.approved");assert.equal(q.get("review_expires_at"),"gt."+new Date(now).toISOString());assert.equal(q.get("offset"),"24");assert.equal(q.get("search_document"),"plfts(simple).lamp");
 assert.throws(()=>storefrontQuery({status:"draft"}));assert.throws(()=>storefrontQuery({page:-1}));assert.throws(()=>storefrontQuery({id:"x&status=eq.draft"}));
});
test("public product exposes retail cedis without supplier costs, actors or permission evidence",()=>{
 const product=storefrontProduct(row,fx,now),json=JSON.stringify(product);
 assert.equal(product.priceGhsMinor,1560);assert.equal(product.variants[1].priceGhsMinor,3120);assert.equal(product.variants[0].retailUsdMinor,130);
 for(const privateField of ["costUsdMinor","snapshot","rights_evidence","approved_by","PRIVATE"])assert.equal(json.includes(privateField),false);
 assert.equal(product.variants[0].id,"v1");
});
test("FX failures remove prices rather than substituting misleading cedi amounts",()=>{
 assert.equal(storefrontProduct(row,null,now).priceGhsMinor,null);
 assert.throws(()=>storefrontProduct(row,{...fx,validUntil:new Date(now-1).toISOString()},now));
 assert.throws(()=>storefrontProduct({...row,image_url:"https://unapproved.example/private.jpg"},fx,now));
});
test("publication requires explicit evidence, plain text, bounded review date and approved actions",()=>{
 const input={action:"approve",productId:"CJ_TEST",description:row.description,rightsEvidence:"Reviewed publication agreement with authorised scope.",mediaEvidence:"Reviewed permission for these exact product images.",origin:"CN",reviewExpiresAt:new Date(now+86400000).toISOString()};
 assert.equal(publicationAction.parse(input).action,"approve");
 for(const patch of [{rightsEvidence:""},{mediaEvidence:""},{description:"<script>bad</script>"},{costUsdMinor:1},{action:"delete"}])assert.throws(()=>publicationAction.parse({...input,...patch}));
 assert.throws(()=>validReviewExpiry(new Date(now-1).toISOString(),now));assert.throws(()=>validReviewExpiry(new Date(now+367*86400000).toISOString(),now));
 assert.equal(validReviewExpiry(input.reviewExpiresAt,now),input.reviewExpiresAt);
 assert.throws(()=>publicationAction.parse({action:"retire",productId:"CJ_TEST",reason:""}));
});
