import test from "node:test";
import assert from "node:assert/strict";
import {buildSandboxShopQuote} from "../../lib/server/commerce/shop-quotes.ts";
import {initializeShopTestPayment,validShopCheckoutUrl} from "../../lib/server/commerce/shop-test-checkout.ts";
const now=Date.parse("2026-11-10T01:00:00Z");
const input={origin:"CN",address:{name:"Fictional Tester",phone:"0000000000",countryCode:"GH",province:"Test",city:"Test",postalCode:"000",address:"Fictional test address"},lines:[{productId:"p1",variantId:"v1",quantity:2}],acknowledgeImportCharges:true,acknowledgeReturnTerms:true};
function dependencies(){return {now:()=>now,exists:async()=>true,fx:async()=>({rateMicros:10000000,asOf:new Date(now).toISOString(),validUntil:new Date(now+3600000).toISOString()}),check:async()=>({productId:"p1",variantId:"v1",name:"Fictional lamp",variantName:"Test",costUsdMinor:100,shipping:{checkedAt:new Date(now).toISOString(),origin:"CN",destination:"GH",quantity:2,stock:{total:10,warehouse:10,factory:0},routes:[{name:"Test carrier",estimate:"5-10",shippingUsdMinor:200,taxUsdMinor:0 as number|null,clearanceUsdMinor:0 as number|null,totalPostageUsdMinor:200 as number|null}],checkoutEnabled:false as const}})};}
test("sandbox quotes reprice server-side in GHS, absorb customer processing fees and disclose excluded import charges",async()=>{
 const quote=await buildSandboxShopQuote(input,dependencies());assert.equal(quote.mode,"test");assert.equal(quote.sale_ready,false);assert.equal(quote.merchandise_minor,2600);assert.equal(quote.shipping_minor,2000);assert.equal(quote.total_minor,4600);assert.equal(quote.customer_fee_minor,0);assert.equal(quote.import_charges_policy,"customer_pays_excluded");assert.equal(quote.items[0].unitGhsMinor,1300);
});
test("quotes reject client prices, duplicate options, unavailable stock, foreign mappings and incomplete freight",async()=>{
 await assert.rejects(buildSandboxShopQuote({...input,total:1},dependencies()));
 await assert.rejects(buildSandboxShopQuote({...input,lines:[...input.lines,...input.lines]},dependencies()));
 await assert.rejects(buildSandboxShopQuote(input,{...dependencies(),exists:async()=>false}));
 for(const type of ["stock","mapping","shipping","missing"]){const deps=dependencies(),base=await deps.check();if(type==="stock")base.shipping.stock.total=0;if(type==="mapping")base.variantId="wrong";if(type==="shipping")base.shipping.routes[0].totalPostageUsdMinor=1;if(type==="missing"){base.shipping.routes[0].totalPostageUsdMinor=null;base.shipping.routes[0].taxUsdMinor=null;}await assert.rejects(buildSandboxShopQuote(input,{...deps,check:async()=>base}));}
});

test("return information must be acknowledged and its version and server timestamp are preserved",async()=>{
 const quote=await buildSandboxShopQuote(input,dependencies());
 assert.equal(quote.fulfilment_snapshot.returnDisclosure.version,"2026-11-10-draft-1");
 assert.equal(quote.fulfilment_snapshot.returnDisclosure.acknowledgedAt,new Date(now).toISOString());
 assert.match(quote.fulfilment_snapshot.returnDisclosure.text,/does not waive/);
 for(const acknowledgeReturnTerms of [false,undefined,"true"]){
  await assert.rejects(buildSandboxShopQuote({...input,acknowledgeReturnTerms},dependencies()));
 }
});
test("sandbox checkout accepts only trusted test orders and official Paystack checkout URLs",async()=>{
 const expected={reference:"BSC-SBX-test",amountMinor:4600,currency:"GHS" as const,mode:"test" as const};let requestBody:Record<string,unknown>={};
 const transport=(async(_url,init)=>{requestBody=JSON.parse(String(init?.body));return Response.json({status:true,data:{reference:expected.reference,authorization_url:"https://checkout.paystack.com/fixture"}});}) as typeof fetch;
 assert.equal(await initializeShopTestPayment(expected,"fictional@example.com","https://shop.example.com/shop/orders","sk_test_fixture",transport),"https://checkout.paystack.com/fixture");assert.equal(requestBody.amount,4600);assert.deepEqual(requestBody.channels,["card","mobile_money"]);
 await assert.rejects(initializeShopTestPayment(expected,"fictional@example.com","https://shop.example.com/shop/orders","sk_live_fixture",transport));
 for(const url of ["https://checkout.paystack.com.evil.test/x","http://checkout.paystack.com/x","https://user@checkout.paystack.com/x","https://checkout.paystack.com/"])assert.throws(()=>validShopCheckoutUrl(url));
});
