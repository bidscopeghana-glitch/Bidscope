import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {verifyShopPayment,verifyShopWebhook} from "../../lib/server/commerce/shop-payments.ts";
const expected={reference:"BSC-SBX-fixture",amountMinor:12345,currency:"GHS" as const,mode:"test" as const};
test("commerce payment verification binds status, amount, reference, currency, environment and provider ID",async()=>{
 const good={reference:expected.reference,amount:12345,currency:"GHS",domain:"test",status:"success",id:123};
 for(const patch of [{amount:1},{currency:"USD"},{reference:"other"},{domain:"live"},{status:"pending"},{id:0},{id:undefined}]){
  await assert.rejects(verifyShopPayment(expected,"sk_test_fixture",(async()=>Response.json({status:true,data:{...good,...patch}})) as typeof fetch));
 }
 const result=await verifyShopPayment(expected,"sk_test_fixture",(async()=>Response.json({status:true,data:good})) as typeof fetch);assert.equal(result.providerTransactionId,"123");
 let calls=0;await assert.rejects(verifyShopPayment(expected,"sk_live_fixture",(async()=>{calls++;throw Error();}) as typeof fetch));assert.equal(calls,0);
});
test("commerce webhook validates raw legacy HMAC and prevents signature downgrade",()=>{
 const raw=Buffer.from('{"event":"charge.success"}'),apiKey="sk_test_fixture";
 const sig=createHmac("sha512",apiKey).update(raw).digest("hex"),headers=new Headers({"x-paystack-signature":sig});
 assert.equal(verifyShopWebhook(raw,headers,{apiKey}),true);
 assert.equal(verifyShopWebhook(Buffer.from(raw+" "),headers,{apiKey}),false);
 assert.equal(verifyShopWebhook(raw,headers,{apiKey,signingSecrets:["whsec_fixture"]}),false);
 assert.equal(verifyShopWebhook(raw,headers,{apiKey,signingSecrets:["malformed"]}),false);
 headers.set("paystack-signature","broken");assert.equal(verifyShopWebhook(raw,headers,{apiKey}),false);
});
test("modern commerce signatures support rotation and reject expired or ambiguous timestamps",()=>{
 const raw=Buffer.from('{"event":"charge.success"}'),secret="whsec_fixture",timestamp=1800000000;
 const sig=createHmac("sha512",secret).update(timestamp+".").update(raw).digest("hex");
 const headers=new Headers({"paystack-signature":`t=${timestamp},v1=whk_old:${"0".repeat(128)},v1=whk_current:${sig}`});
 const config={apiKey:"sk_test_fixture",signingSecrets:["whsec_old",secret]};
 assert.equal(verifyShopWebhook(raw,headers,config,timestamp+300),true);
 assert.equal(verifyShopWebhook(raw,headers,config,timestamp+301),false);
 headers.set("paystack-signature",`t=${timestamp},t=${timestamp},v1=whk_current:${sig}`);assert.equal(verifyShopWebhook(raw,headers,config,timestamp),false);
});
