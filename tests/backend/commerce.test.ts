import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {sampleProducts,samplePricing,quoteCart,variantFor,newOrder,recordPayment,submitSupplier,paySupplier,trackShipment,requestResolution,refundOrder} from "../../lib/commerce/core.ts";
import {CjSandboxProvider,supplierMappingId,alibabaProvider} from "../../lib/server/commerce/providers.ts";
import {verifyTestPayment,isValidPaystackSignature} from "../../lib/server/commerce/payments.ts";
import {claimJob,failJob,recoverExpiredLease,type Job} from "../../lib/server/commerce/jobs.ts";
const lines=[{variantId:"light-sand",quantity:2}],now=1000000;
const quote=()=>quoteCart(sampleProducts,lines,samplePricing,"GH",now);
const paid=()=>recordPayment(newOrder("DEMO-1",quote()),{reference:"test-pay",amount:quote().total,currency:"GHS",verified:true},quote(),now);
test("provider mapping is stable and distinct across product, variant and provider",()=>{
 assert.equal(supplierMappingId("cj","p","v"),supplierMappingId("cj","p","v"));
 assert.notEqual(supplierMappingId("cj","p","v"),supplierMappingId("alibaba","p","v"));
 assert.throws(()=>variantFor(sampleProducts,"missing"));
 assert.throws(()=>variantFor([...sampleProducts,sampleProducts[0]],"light-sand"));
});
test("quotes separate supplier costs, markup, shipping, fees and unknown duties",()=>{
 const q=quote();assert.equal(q.cost,27000);assert.equal(q.merchandise,35100);assert.equal(q.shipping,6500);assert.equal(q.margin,8100);
 assert.equal(q.duty,null);assert.equal(q.total,q.merchandise+q.shipping+q.fee);assert.equal(q.currency,"GHS");
 assert.throws(()=>quoteCart(sampleProducts,lines,{...samplePricing,feeBps:10000},"GH",now));
});
test("stock, destination, wholesale and publication restrictions fail closed",()=>{
 for(const variantId of ["tote-black","workspace-quote"])assert.throws(()=>quoteCart(sampleProducts,[{variantId,quantity:1}],samplePricing,"GH",now));
 assert.throws(()=>quoteCart(sampleProducts,[{variantId:"light-sand",quantity:13}],samplePricing,"GH",now));
 assert.throws(()=>quoteCart(sampleProducts,lines,samplePricing,"GB",now));
 assert.throws(()=>quoteCart(sampleProducts.map(p=>({...p,permission:"unknown" as const})),lines,samplePricing,"GH",now));
 assert.throws(()=>quoteCart(sampleProducts,[...lines,...lines],samplePricing,"GH",now));
});
test("payments require exact verified amount, currency, expiry and fresh price",()=>{
 const order=newOrder("DEMO-1",quote());
 for(const payment of [{reference:"r",amount:1,currency:"GHS",verified:true},{reference:"r",amount:quote().total,currency:"USD",verified:true},{reference:"r",amount:quote().total,currency:"GHS",verified:false}])assert.throws(()=>recordPayment(order,payment,quote(),now));
 const p={reference:"r",amount:quote().total,currency:"GHS",verified:true};
 assert.throws(()=>recordPayment(order,p,quote(),now+300001));
 const changed=quoteCart(sampleProducts,lines,{...samplePricing,shipping:7000},"GH",now);
 assert.throws(()=>recordPayment(order,p,changed,now));
 const first=recordPayment(order,p,quote(),now);assert.equal(recordPayment(first,p,quote(),now),first);
 assert.throws(()=>recordPayment(first,{...p,reference:"other"},quote(),now));
});
test("supplier orders cannot precede payment and duplicate retries preserve the supplier ID",()=>{
 assert.throws(()=>submitSupplier(newOrder("x",quote())));
 const first=submitSupplier(paid());assert.equal(first.supplierPaid,false);assert.equal(submitSupplier(first),first);
 const failed=paySupplier(first,true);assert.equal(failed.status,"exception");assert.equal(failed.supplierPaid,false);
 assert.equal(paySupplier(failed).supplierPaid,true);
});
test("split shipments preserve allocations and reject overfulfilment or regressions",()=>{
 const order=paySupplier(submitSupplier(paid()));
 const a={id:"a",lines:[{variantId:"light-sand",quantity:1}],carrier:"demo",tracking:"demo-a",delivered:false};
 const partial=trackShipment(order,a);assert.equal(partial.status,"partially_shipped");
 const shipped=trackShipment(partial,{...a,id:"b",tracking:"demo-b"});assert.equal(shipped.status,"shipped");
 assert.throws(()=>trackShipment(shipped,{...a,id:"c"}));
 const deliveredA=trackShipment(shipped,{...a,delivered:true});
 const delivered=trackShipment(deliveredA,{...a,id:"b",tracking:"demo-b",delivered:true});assert.equal(delivered.status,"delivered");
 assert.equal(trackShipment(delivered,a),delivered);
 assert.throws(()=>requestResolution(shipped,"cancel"));
});
test("refund requests and confirmations remain separate and idempotent",()=>{
 const cancel=requestResolution(paid(),"cancel"),pending=refundOrder(cancel,"ref");
 assert.equal(pending.status,"refund_pending");
 const done=refundOrder(pending,"ref",true);assert.equal(done.status,"refunded");assert.equal(refundOrder(done,"ref",true),done);
 assert.throws(()=>refundOrder(newOrder("x",quote()),"ref",true));
});
test("CJ transport enforces sandbox creation, no immediate supplier payment and official origin",async()=>{
 const calls:Array<{url:string;body:Record<string,unknown>}>=[];
 const transport=(async(url,init)=>{calls.push({url:String(url),body:JSON.parse(String(init?.body||"{}"))});return Response.json({code:200,result:true,data:{orderId:"sandbox-1"}});}) as typeof fetch;
 const permission={approved:true,evidence:"TEST ONLY fixture permission",expiresAt:"2099-01-01",productIds:["p"],mediaAllowed:false};
 const provider=new CjSandboxProvider("fixture-token","2099-01-01",permission,transport);
 await provider.createSandboxOrder({merchantReference:"BIDSCOPE-SANDBOX-1",lines:[{variantId:"v",quantity:1}],origin:"CN",logisticName:"fixture-route",address:{name:"Fictional tester",phone:"000000000",countryCode:"GH",country:"Ghana",province:"Test",city:"Test",postalCode:"000",address:"Fictional test address"}});
 assert.equal(calls[0].body.isSandbox,1);assert.equal(calls[0].body.payType,3);assert.ok(calls[0].url.startsWith("https://developers.cjdropshipping.com/"));
 assert.throws(()=>provider.product("unapproved"));assert.throws(()=>alibabaProvider());
 await assert.rejects(new CjSandboxProvider("","2099-01-01",permission,transport).stock("v"));
 await assert.rejects(new CjSandboxProvider("fixture-token","2099-01-01",{...permission,approved:false},transport).stock("v"));
});
test("payment signatures and server verification reject tampering and production credentials",async()=>{
 const raw=JSON.stringify({event:"charge.success"}),secret="sk_test_fixture";
 const sig=createHmac("sha512",secret).update(raw).digest("hex");
 assert.equal(isValidPaystackSignature(raw,sig,secret),true);assert.equal(isValidPaystackSignature(raw+" ",sig,secret),false);
 let calls=0;const transport=(async()=>{calls++;return Response.json({status:true,data:{status:"success",reference:"test-ref",amount:123,currency:"GHS"}});}) as typeof fetch;
 await assert.rejects(verifyTestPayment("test-ref",{amount:123,currency:"GHS"},"sk_live_not_allowed",transport));assert.equal(calls,0);
 assert.equal((await verifyTestPayment("test-ref",{amount:123,currency:"GHS"},secret,transport)).verified,true);
 await assert.rejects(verifyTestPayment("test-ref",{amount:124,currency:"GHS"},secret,transport));
});
test("supplier simulations refuse real orders and use only sandbox mutation endpoints",async()=>{
 let sandbox=0;const calls:Array<{url:string;method:string}>=[];
 const transport=(async(url,init)=>{calls.push({url:String(url),method:init?.method||"GET"});return Response.json({code:200,result:true,data:String(url).includes("getOrderDetail")?{isSandbox:sandbox,orderStatus:"CREATED"}:true});}) as typeof fetch;
 const provider=new CjSandboxProvider("fixture-token","2099-01-01",{approved:true,evidence:"TEST ONLY",expiresAt:"2099-01-01",productIds:["p"],mediaAllowed:false},transport);
 await assert.rejects(provider.sandboxAction("real","pay"));await assert.rejects(provider.confirmSandboxOrder("real"));assert.equal(calls.some(c=>["POST","PATCH"].includes(c.method)),false);
 sandbox=1;await provider.confirmSandboxOrder("sandbox");assert.equal(calls.filter(c=>c.method==="PATCH").length,1);assert.ok(calls.find(c=>c.method==="PATCH")?.url.endsWith("/shopping/order/confirmOrder"));
 sandbox=1;await provider.sandboxAction("sandbox","pay");await provider.sandboxAction("sandbox","status",400);await provider.sandboxAction("sandbox","tracking","BIDSCOPE-TEST-fixture");await assert.rejects(provider.sandboxAction("sandbox","tracking","REAL-TRACKING"));await assert.rejects(provider.sandboxAction("sandbox","status",900));
 assert.ok(calls.filter(c=>c.method==="POST").every(c=>c.url.includes("/shopping/sandbox/")));assert.equal(calls.filter(c=>c.method==="POST").length,3);
});
test("read retries are bounded; uncertain supplier writes enter the exception queue",()=>{
 const base:Job={id:"j",kind:"tracking",attempts:0,status:"pending",availableAt:0,leaseUntil:null,error:null};
 const claimed=claimJob(base,now)!;assert.equal(claimed.attempts,1);assert.equal(claimJob(claimed,now),null);
 const retry=failJob(claimed,"timeout",now);assert.equal(retry.status,"pending");assert.ok(retry.availableAt>now);
 assert.equal(failJob({...claimed,attempts:5},"timeout",now).status,"exception");
 assert.equal(recoverExpiredLease({...claimed,kind:"supplier_order"},now+60001).status,"exception");
});
