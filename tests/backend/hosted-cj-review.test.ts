import test from "node:test";
import assert from "node:assert/strict";
import {reviewHostedCjProduct} from "../../lib/server/commerce/hosted-cj-review.ts";
import type {CjDraft} from "../../lib/server/commerce/cj-catalogue.ts";

const draft:CjDraft={provider:"cj",id:"mapped",supplierId:"p1",name:"Lamp",sku:"L",category:"Home",checkedAt:"2026-11-09T00:00:00Z",publication:"unreviewed",mediaAllowed:false,variants:[]};
function fixture(){const calls:string[]=[];return {calls,deps:{exists:async()=>{calls.push("exists");return true;},acquire:async()=>{calls.push("acquire");return "lease";},release:async(lease:string)=>{calls.push("release:"+lease);},product:async()=>{calls.push("product");return draft;}}};}
test("hosted CJ review validates identifiers and known drafts before provider access",async()=>{const {calls,deps}=fixture();await assert.rejects(reviewHostedCjProduct({id:"../bad"},deps));assert.deepEqual(calls,[]);deps.exists=async()=>false;await assert.rejects(reviewHostedCjProduct({id:"p1"},deps),/not found/);assert.deepEqual(calls,[]);});
test("a busy distributed lease prevents CJ calls",async()=>{const {calls,deps}=fixture();await assert.rejects(reviewHostedCjProduct({id:"p1"},{...deps,acquire:async()=>null}),/in progress/);assert.deepEqual(calls,["exists"]);});
test("successful review releases lease and never enables checkout or claims stock",async()=>{const {calls,deps}=fixture();const result=await reviewHostedCjProduct({id:"p1"},deps);assert.equal(result.checkoutEnabled,false);assert.equal(result.stockVerified,false);assert.equal(result.shippingVerified,false);assert.deepEqual(calls,["exists","acquire","product","release:lease"]);});
test("provider failures and mismatched IDs release their lease",async()=>{for(const fail of [true,false]){const {calls,deps}=fixture();deps.product=async()=>{if(fail)throw Error("offline");return {...draft,supplierId:"wrong"};};await assert.rejects(reviewHostedCjProduct({id:"p1"},deps),fail?/offline/:/different product/);assert.equal(calls.at(-1),"release:lease");}});
