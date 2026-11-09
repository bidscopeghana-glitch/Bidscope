import assert from "node:assert/strict";
import test from "node:test";
import {createCjTokenManager} from "../../lib/server/commerce/cj-auth.ts";
import {requireLocalCommerceSetup} from "../../lib/server/commerce/cj-connection.ts";
const time=Date.parse("2026-11-09T12:00:00Z");
const token=(expiry=time+3600000)=>({accessToken:"fixture-access",accessTokenExpiryDate:new Date(expiry).toISOString(),refreshToken:"fixture-refresh",refreshTokenExpiryDate:new Date(time+86400000).toISOString()});
test("CJ caches concurrent authentication and never truncates the credential",async()=>{
 const calls:Array<{url:string;body:unknown}>=[];
 const transport=(async(url,init)=>{calls.push({url:String(url),body:JSON.parse(String(init?.body))});return Response.json({code:200,result:true,data:token()});}) as typeof fetch;
 const key="CJ-fixture-only-"+ "a".repeat(120);
 const manager=createCjTokenManager(async()=>key,transport,()=>time);
 const [a,b]=await Promise.all([manager.token(),manager.token()]);
 assert.equal(calls.length,1);assert.equal(a,b);
 assert.deepEqual(calls[0].body,{apiKey:key});
 assert.equal(calls[0].url,"https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken");
 await manager.token();assert.equal(calls.length,1);
 assert.deepEqual(manager.status(),{authenticated:true,expiresAt:token().accessTokenExpiryDate});
 assert.equal(JSON.stringify(manager.status()).includes("fixture-access"),false);
});
test("CJ refreshes near-expiry tokens with their unchanged refresh token",async()=>{
 let now=time;const calls:Array<{url:string;body:unknown}>=[];
 const transport=(async(url,init)=>{calls.push({url:String(url),body:JSON.parse(String(init?.body))});return Response.json({code:200,result:true,data:token(calls.length===1?time+600000:time+3600000)});}) as typeof fetch;
 const manager=createCjTokenManager(async()=>"CJ-fixture",transport,()=>now);
 await manager.token();now+=400000;await manager.token();
 assert.ok(calls[1].url.endsWith("/refreshAccessToken"));
 assert.deepEqual(calls[1].body,{refreshToken:"fixture-refresh"});
});
test("CJ errors redact provider messages and use a cooldown rather than retry storms",async()=>{
 let calls=0;
 const transport=(async()=>{calls++;return Response.json({code:1601000,result:false,message:"private apiKey or account details"});}) as typeof fetch;
 const manager=createCjTokenManager(async()=>"fixture-only",transport,()=>time);
 await assert.rejects(manager.token(),error=>error instanceof Error&&!error.message.includes("private"));
 await assert.rejects(manager.token(),/cooling down/);
 assert.equal(calls,1);
});
test("CJ rejects expired or malformed tokens even after HTTP success",async()=>{
 for(const data of [token(time-1),{...token(),accessTokenExpiryDate:"invalid"},{...token(),refreshToken:""}]){
  const transport=(async()=>Response.json({code:200,result:true,data})) as typeof fetch;
  await assert.rejects(createCjTokenManager(async()=>"fixture-only",transport,()=>time).token());
 }
});
test("local credential setup is opt-in, loopback-only and rejects cross-site writes",()=>{
 const previous=process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP;
 const request=(origin="http://localhost:3012",host="localhost:3012",contentType="application/json")=>new Request("http://localhost:3012/api/commerce/local-connect",{method:"POST",headers:{host,origin,"content-type":contentType},body:"{}"});
 try{
  delete process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP;
  assert.throws(()=>requireLocalCommerceSetup(request()));
  process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP="1";
  assert.doesNotThrow(()=>requireLocalCommerceSetup(request()));
  assert.doesNotThrow(()=>requireLocalCommerceSetup(request("http://127.0.0.1:3012","127.0.0.1:3012")));
  assert.throws(()=>requireLocalCommerceSetup(request("https://evil.example")));
  assert.throws(()=>requireLocalCommerceSetup(request("")));
  assert.throws(()=>requireLocalCommerceSetup(request("http://localhost:3012","evil.example")));
  assert.throws(()=>requireLocalCommerceSetup(request("http://localhost:3012","localhost:3012","text/plain")));
  assert.throws(()=>requireLocalCommerceSetup(new Request("https://www.bidscopeghana.com/api/commerce/local-connect",{headers:{host:"www.bidscopeghana.com"}})));
 }finally{if(previous===undefined)delete process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP;else process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP=previous;}
});
