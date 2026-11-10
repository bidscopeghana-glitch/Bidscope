import test from "node:test";
import assert from "node:assert/strict";
import {sandboxSupplierInput,checkedSandboxOrder,nextSandboxStatus} from "../../lib/server/commerce/sandbox-fulfilment.ts";
import {createTestRefund,readTestRefund,checkedTestRefund} from "../../lib/server/commerce/shop-refunds.ts";
const reference="BIDSCOPE-SANDBOX-"+"a".repeat(24);
const payload={productId:"p",variantId:"v",quantity:2,origin:"CN",destination:"GH",service:"Test line",supplierUnitUsdMinor:100,postageUsdMinor:200};
const address={name:"Fictional test",phone:"0000000000",countryCode:"GH",province:"Test",city:"Test",postalCode:"000",address:"FICTIONAL TEST ADDRESS"};
test("sandbox supplier plan binds destination, supplier IDs and bounded quantity",()=>{
 const plan=sandboxSupplierInput(reference,payload,address);assert.equal(plan.address.country,"Ghana");assert.deepEqual(plan.lines,[{variantId:"v",quantity:2}]);
 assert.throws(()=>sandboxSupplierInput("LIVE-anything",payload,address));assert.throws(()=>sandboxSupplierInput(reference,payload,{...address,countryCode:"GB"}));assert.throws(()=>sandboxSupplierInput(reference,{...payload,quantity:0},address));
});
test("supplier reconciliation rejects real orders and mismatched provider or merchant IDs",()=>{
 const raw={orderId:"cj1",orderNum:reference,isSandbox:1,orderStatus:"CREATED"};assert.equal(checkedSandboxOrder(raw,reference,"cj1").orderId,"cj1");
 assert.throws(()=>checkedSandboxOrder({...raw,isSandbox:0},reference));assert.throws(()=>checkedSandboxOrder(raw,"other"));assert.throws(()=>checkedSandboxOrder(raw,reference,"wrong"));
 assert.equal(checkedSandboxOrder({...raw,orderId:"2611092252430647600"},reference,"SD2611092252410649700").orderId,"2611092252430647600");
 assert.throws(()=>checkedSandboxOrder({...raw,orderId:"2611092252430647600",orderNum:"another-reference"},reference,"SD2611092252410649700"));
 assert.equal(nextSandboxStatus("PENDING"),400);assert.equal(nextSandboxStatus("UNSHIPPED","PENDING"),400);assert.equal(nextSandboxStatus("PROCESSING"),500);assert.equal(nextSandboxStatus("SHIPPED"),600);assert.equal(nextSandboxStatus("DELIVERED"),null);
});
const expected={reference:"BSC-RF-SBX-"+"a".repeat(32),paymentReference:"BSC-SBX-test",transactionId:"123",amountMinor:2000};
const refund={id:7,transaction:{id:123,reference:"BSC-SBX-test",domain:"test"},domain:"test",amount:2000,currency:"GHS",reference:expected.reference,status:"pending"};
test("refunds distinguish pending from processed and verify original payment, amount, currency and test mode",()=>{
 assert.equal(checkedTestRefund(refund,expected).status,"pending");assert.equal(checkedTestRefund({...refund,status:"processed"},expected).status,"processed");
 for(const patch of [{domain:"live"},{amount:1},{currency:"USD"},{reference:"wrong"},{transaction:99},{status:"unknown"}])assert.throws(()=>checkedTestRefund({...refund,...patch},expected));
});
test("refund adapter rejects live keys before transport and reconciles by saved refund reference",async()=>{
 let calls=0;const transport=(async(url,init)=>{calls++;const request=new URL(String(url));if(init?.method==="POST"){const body=JSON.parse(String(init.body));assert.equal(body.reference,expected.reference);assert.equal(body.amount,2000);return Response.json({status:true,data:refund});}assert.equal(request.searchParams.get("reference"),expected.reference);assert.equal(request.searchParams.get("transaction"),"123");return Response.json({status:true,data:[refund]});}) as typeof fetch;
 await assert.rejects(createTestRefund(expected,"sk_live_blocked",transport));assert.equal(calls,0);
 assert.equal((await createTestRefund(expected,"sk_test_fixture",transport)).status,"pending");
 assert.equal((await readTestRefund(expected,null,"sk_test_fixture",transport)).providerId,"7");
 await assert.rejects(readTestRefund(expected,"../bad","sk_test_fixture",transport));
});
