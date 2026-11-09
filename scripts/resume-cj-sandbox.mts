import {readFile,writeFile} from "node:fs/promises";import path from "node:path";
import {randomUUID} from "node:crypto";
import {cjConnection} from "../lib/server/commerce/cj-connection.ts";
import {CjSandboxProvider} from "../lib/server/commerce/providers.ts";
import {waitForCjRequestStart} from "../lib/server/commerce/cj-read-pacer.ts";
if(process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP!=="1"||process.env.BIDSCOPE_CJ_SANDBOX_TEST!=="1")throw Error("Explicit sandbox-only flags required.");
const file=path.join(process.cwd(),".codex-tmp","commerce","cj-sandbox-pilot.json"),state=JSON.parse(await readFile(file,"utf8"));
if(state.mode!=="sandbox"||!state.orderId||!String(state.merchantReference).startsWith("BIDSCOPE-SANDBOX-"))throw Error("A saved sandbox pilot is required. This script never creates a new order.");
const save=()=>writeFile(file,JSON.stringify(state,null,2),{mode:0o600});
const t=await cjConnection.token(),p=new CjSandboxProvider(t.accessToken,t.accessTokenExpiryDate,{approved:true,evidence:"Owner-authorised reconciliation of this private API sandbox pilot; no public content grant.",expiresAt:new Date(Date.now()+3600000).toISOString(),productIds:[],mediaAllowed:false},async(u,i)=>{await waitForCjRequestStart();const r=await fetch(u,i);const m=await r.clone().json() as {code?:number;requestId?:string};state.events.push({path:new URL(String(u)).pathname,http:r.status,code:m.code,requestId:m.requestId});await save();return r;});
type Snapshot={isSandbox?:number|string;orderStatus?:string;subStatus?:string;trackNumber?:string;orderNum?:string};
async function snapshot(){const d=await p.order(state.orderId) as Snapshot;if(String(d.isSandbox)!=="1"||d.orderNum!==state.merchantReference)throw Error("Sandbox identity or merchant-reference mismatch.");return d;}
try{
 let d=await snapshot();
 if(["CREATED","IN_CART"].includes(d.orderStatus||"")){await p.confirmSandboxOrder(state.orderId);d=await snapshot();}
 if(d.orderStatus==="UNPAID"){await p.sandboxAction(state.orderId,"pay");d=await snapshot();}
 if(d.orderStatus==="UNSHIPPED"&&d.subStatus==="PENDING"){await p.sandboxAction(state.orderId,"status",400);d=await snapshot();}
 state.tracking||="BIDSCOPE-TEST-"+randomUUID().slice(0,12);await save();
 if(d.orderStatus==="UNSHIPPED"){
  if(d.trackNumber!==state.tracking)await p.sandboxAction(state.orderId,"tracking",state.tracking);
  await p.sandboxAction(state.orderId,"status",500);d=await snapshot();
 }
 if(d.trackNumber!==state.tracking)throw Error("Sandbox tracking did not reconcile.");
 if(d.orderStatus==="SHIPPED"){await p.sandboxAction(state.orderId,"status",600);d=await snapshot();}
 if(!["DELIVERED","COMPLETED"].includes(d.orderStatus||""))throw Error("The provider has not confirmed the completed sandbox state.");
 state.phase="completed";state.status=d.orderStatus;await save();console.log(JSON.stringify({mode:"sandbox",phase:state.phase,orderId:state.orderId,status:d.orderStatus,trackingMatched:true,liveCharges:false}));
}catch(error){state.phase="exception_requires_reconciliation";await save();throw error;}
