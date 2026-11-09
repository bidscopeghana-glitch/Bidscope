import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {saveCommerceLiveKey,commerceLiveStatus} from "../../lib/server/commerce/paystack-live.ts";
const fixtureKey="sk_live_"+"fixture".repeat(5);
async function cleanTemporary(folder:string){assert.equal(path.dirname(path.resolve(folder)),path.resolve(tmpdir()));await rm(folder,{recursive:true,force:true});}
test("live key setup validates with only the official read-only integration request and returns no secret",async()=>{
 const prior=process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP;process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP="1";const directory=await mkdtemp(path.join(tmpdir(),"bidscope-live-key-")),file=path.join(directory,"live.json");const calls:Array<{url:string;method:string}> = [];
 const transport=(async(url,init)=>{calls.push({url:String(url),method:init?.method||"GET"});assert.equal((init?.headers as Record<string,string>).Authorization,"Bearer "+fixtureKey);assert.equal(init?.redirect,"error");return Response.json({status:true,data:{payment_session_timeout:30}});}) as typeof fetch;
 try{const result=await saveCommerceLiveKey(fixtureKey,file,transport);assert.equal(result.configured,true);assert.equal(result.liveCheckout,false);assert.equal(JSON.stringify(result).includes(fixtureKey),false);assert.deepEqual(calls,[{url:"https://api.paystack.co/integration/payment_session_timeout",method:"GET"}]);const status=await commerceLiveStatus(file);assert.equal(status.configured,true);assert.equal(JSON.stringify(status).includes(fixtureKey),false);assert.equal(JSON.parse(await readFile(file,"utf8")).key,fixtureKey);}finally{await cleanTemporary(directory);if(prior===undefined)delete process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP;else process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP=prior;}
});
test("test keys, missing local flag and failed authentication never save a live credential",async()=>{
 const prior=process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP,folder=await mkdtemp(path.join(tmpdir(),"bidscope-live-denied-")),file=path.join(folder,"live.json");let calls=0;const denied=(async()=>{calls++;return Response.json({status:false},{status:401});}) as typeof fetch;
 try{delete process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP;await assert.rejects(saveCommerceLiveKey(fixtureKey,file,denied));assert.equal(calls,0);process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP="1";await assert.rejects(saveCommerceLiveKey("sk_test_"+"fixture".repeat(5),file,denied));assert.equal(calls,0);await assert.rejects(saveCommerceLiveKey(fixtureKey,file,denied));assert.equal(calls,1);await assert.rejects(readFile(file));assert.equal((await commerceLiveStatus(file)).configured,false);}finally{await cleanTemporary(folder);if(prior===undefined)delete process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP;else process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP=prior;}
});
