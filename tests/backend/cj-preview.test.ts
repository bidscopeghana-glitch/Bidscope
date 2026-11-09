import test from "node:test";
import assert from "node:assert/strict";
import {cjPreviewImage,cjStorefrontPreview,cjPreviewFeedSchema} from "../../lib/commerce/cj-preview.ts";
import {normalizeCjDraft} from "../../lib/server/commerce/cj-catalogue.ts";
import {quoteCart,samplePricing} from "../../lib/commerce/core.ts";
const draft=normalizeCjDraft({pid:"fixture-product",productNameEn:"Fixture real product",variants:[{vid:"fixture-variant",variantSellPrice:"3.25"}]},"2026-11-09T12:00:00.000Z");
test("real CJ preview preserves supplier mapping without claiming stock or publication approval",()=>{
 const product=cjStorefrontPreview(draft,"https://cf.cjdropshipping.com/photo.jpg","Home","lamp");
 assert.equal(product.sample,false);assert.equal(product.provider,"cj");assert.equal(product.permission,"unknown");assert.equal(product.supplierId,draft.supplierId);assert.equal(product.variants[0].supplierId,"fixture-variant");assert.equal(product.variants[0].cost,325);assert.equal(product.variants[0].stock,0);
 assert.throws(()=>quoteCart([product],[{variantId:product.variants[0].id,quantity:1}],samplePricing,"GH"));
});
test("preview image validation rejects arbitrary hosts, credentials, ports and non-HTTPS media",()=>{
 for(const url of ["http://cf.cjdropshipping.com/x.jpg","https://cjdropshipping.com.evil.invalid/x.jpg","https://private.example/x.jpg","https://user:secret@cf.cjdropshipping.com/x.jpg","https://cf.cjdropshipping.com:8443/x.jpg","https://other-bucket.oss-accelerate.aliyuncs.com/x.jpg","https://cj-product-center.oss-accelerate.aliyuncs.com.evil.invalid/x.jpg","data:image/png;base64,abc"]){assert.equal(cjPreviewImage(url),undefined);assert.throws(()=>cjStorefrontPreview(draft,url,"Home","lamp"));}
 assert.equal(cjPreviewImage("https://cf.cjdropshipping.com/x.jpg"),"https://cf.cjdropshipping.com/x.jpg");
});
test("only the exact CJ API media buckets are allowed without granting publication or stock",()=>{
 for(const host of ["cj-product-center.oss-accelerate.aliyuncs.com","cc-west-usa.oss-us-west-1.aliyuncs.com"]){const p=cjStorefrontPreview(draft,`https://${host}/photo.jpg`,"Home","lamp");assert.equal(p.permission,"unknown");assert.equal(p.variants[0].stock,0);assert.equal(p.image,`https://${host}/photo.jpg`);}
});
test("private feed schema strips unknown fields and rejects publication or stock escalation",()=>{
 const product=cjStorefrontPreview(draft,"https://cf.cjdropshipping.com/photo.jpg","Home","lamp");
 const feed={version:1,mode:"private_cj_preview",generatedAt:"2026-11-09T12:00:00.000Z",items:[{...product,accessToken:"fixture-should-be-stripped"}]};
 assert.equal(JSON.stringify(cjPreviewFeedSchema.parse(feed)).includes("accessToken"),false);
 assert.equal(cjPreviewFeedSchema.safeParse({...feed,items:[{...product,permission:"approved"}]}).success,false);
 assert.equal(cjPreviewFeedSchema.safeParse({...feed,items:[{...product,variants:[{...product.variants[0],stock:100}]}]}).success,false);
});
