import {existsSync} from "node:fs";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {cjConnection} from "../lib/server/commerce/cj-connection.ts";
import {createCjCatalogueInspector} from "../lib/server/commerce/cj-catalogue.ts";
import {CjSandboxProvider} from "../lib/server/commerce/providers.ts";
import {waitForCjRequestStart} from "../lib/server/commerce/cj-read-pacer.ts";
if(process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP!=="1"||process.env.BIDSCOPE_CJ_SANDBOX_TEST!=="1")throw Error("Explicit private sandbox test flags are required.");
const directory=path.join(process.cwd(),".codex-tmp","commerce"),file=path.join(directory,"cj-sandbox-pilot.json");
if(existsSync(file)){const prior=JSON.parse(await readFile(file,"utf8"));console.log(JSON.stringify({phase:prior.phase,orderId:prior.orderId,merchantReference:prior.merchantReference}));throw Error("A pilot record already exists. Reconcile that test instead of creating a duplicate.");}
const productId="4D76667F-8B43-447D-8E7E-55E753ED323A",api=createCjCatalogueInspector(()=>cjConnection.token());
const product=await api.product(productId),variant=product.variants.find(v=>/plug in/i.test(v.name));if(!variant)throw Error("The selected fixture variant is no longer available.");
const quote=await api.shipping(productId,variant.supplierId,"CN",1,"GB");if(!quote.routes.length)throw Error("No current GB route was returned.");
const route=[...quote.routes].sort((a,b)=>a.shippingUsdMinor-b.shippingUsdMinor)[0];
const state:{merchantReference:string;mode:string;liveCharges:boolean;phase:string;orderId?:string;shipmentOrderId?:string;tracking?:string;status?:string;events:unknown[]}={merchantReference:"BIDSCOPE-SANDBOX-"+randomUUID().replaceAll("-","").slice(0,24),mode:"sandbox",liveCharges:false,phase:"prepared",events:[]};
await mkdir(directory,{recursive:true,mode:0o700});await writeFile(file,JSON.stringify(state),{mode:0o600,flag:"wx"});
const save=()=>writeFile(file,JSON.stringify(state,null,2),{mode:0o600});
const transport:typeof fetch=async(url,init)=>{await waitForCjRequestStart();const result=await fetch(url,init);const metadata=await result.clone().json() as {code?:number;requestId?:string};state.events.push({path:new URL(String(url)).pathname,http:result.status,code:metadata.code,requestId:metadata.requestId});await save();return result;};
const token=await cjConnection.token();
// This grant is ONLY the owner's private API sandbox test, not product/media publication.
const provider=new CjSandboxProvider(token.accessToken,token.accessTokenExpiryDate,{approved:true,evidence:"Owner-authorised private CJ API sandbox pilot; no publication permission inferred.",expiresAt:new Date(Date.now()+3600000).toISOString(),productIds:[productId],mediaAllowed:false},transport);
try{
 const created=await provider.createSandboxOrder({merchantReference:state.merchantReference,lines:[{variantId:variant.supplierId,quantity:1}],origin:"CN",logisticName:route.name,address:{name:"BidScope Sandbox Test",phone:"00000000000",countryCode:"GB",country:"United Kingdom",province:"London",city:"London",postalCode:"SW1A1AA",address:"SANDBOX TEST ONLY - NO PHYSICAL DELIVERY"}}) as {orderId?:string;shipmentOrderId?:string};
 if(!created.orderId)throw Error("The sandbox response did not provide an order ID; reconcile the saved reference.");state.orderId=created.orderId;state.shipmentOrderId=created.shipmentOrderId;state.phase="created";await save();
 let order=await provider.order(state.orderId) as {isSandbox?:number|string;orderStatus?:string;trackNumber?:string};if(String(order.isSandbox)!=="1")throw Error("The returned order is not confirmed as sandbox. No simulation may proceed.");
 await provider.confirmSandboxOrder(state.orderId);await provider.sandboxAction(state.orderId,"pay");state.phase="simulated_payment";await save();
 await provider.sandboxAction(state.orderId,"status",400);state.tracking="BIDSCOPE-TEST-"+randomUUID().slice(0,12);await provider.sandboxAction(state.orderId,"tracking",state.tracking);await provider.sandboxAction(state.orderId,"status",500);
 order=await provider.order(state.orderId) as typeof order;if(String(order.isSandbox)!=="1"||order.trackNumber!==state.tracking)throw Error("Sandbox tracking reconciliation did not match.");state.status=order.orderStatus;state.phase="shipped_and_tracking_verified";await save();
 await provider.sandboxAction(state.orderId,"status",600);order=await provider.order(state.orderId) as typeof order;state.status=order.orderStatus;state.phase="completed";await save();console.log(JSON.stringify({mode:state.mode,phase:state.phase,orderId:state.orderId,status:state.status,trackingMatched:true,liveCharges:false}));
}catch(error){state.phase="exception_requires_reconciliation";await save();console.log(JSON.stringify({mode:state.mode,phase:state.phase,orderId:state.orderId,merchantReference:state.merchantReference,liveCharges:false}));throw error;}
