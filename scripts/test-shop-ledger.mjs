// Isolated PostgreSQL/WASM integration test; never connects to Supabase.
// npm install --prefix .codex-tmp/commerce-sql-test --no-save --package-lock=false @electric-sql/pglite@0.5.16
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import path from "node:path";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
const {PGlite}=await import(pathToFileURL(path.resolve(".codex-tmp/commerce-sql-test/node_modules/@electric-sql/pglite/dist/index.js")).href);
const db=new PGlite();
let checks=0;
const check=(value)=>{assert.ok(value);checks++;};
const rejects=async(work)=>{await assert.rejects(work);checks++;};
try{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);");
 await db.exec(await readFile("supabase/migrations/20261109230000_commerce_cj_review_gate.sql","utf8"));
 await db.exec(await readFile("supabase/migrations/20261110000100_shop_order_ledger.sql","utf8"));
 const a=randomUUID(),b=randomUUID();await db.query("insert into auth.users values($1),($2)",[a,b]);
 async function quote(customer=a,mode="test",ready=false,expired=false){const id=randomUUID();await db.query(`insert into public.bidscope_shop_quotes(id,customer_id,mode,sale_ready,merchandise_minor,shipping_minor,total_minor,items,fulfilment_snapshot,delivery_address,created_at,expires_at)
 values($1,$2,$3,$4,1900,100,2000,'[{"name":"Fictional test product","quantity":1,"unitGhsMinor":1900}]','{"supplierCost":1000}','{"label":"FICTIONAL TEST ADDRESS"}',now()-interval '5 minutes',case when $5 then now()-interval '1 minute' else now()+interval '5 minutes' end)`,[id,customer,mode,ready,expired]);return id;}
 const create=async(customer,q,key)=>(await db.query("select public.bidscope_shop_create_order($1,$2,$3) as id",[customer,q,key])).rows[0].id;
 const q1=await quote(),key=randomUUID(),order=await create(a,q1,key);check(order===await create(a,q1,key));
 await rejects(()=>create(b,q1,randomUUID()));await rejects(()=>create(a,q1,randomUUID()));
 await rejects(async()=>create(a,await quote(),key));
 await rejects(async()=>create(a,await quote(a,"test",false,true),randomUUID()));
 await rejects(async()=>create(a,await quote(a,"live",false),randomUUID()));
 const reference=(await db.query("select payment_reference from public.bidscope_shop_orders where id=$1",[order])).rows[0].payment_reference;
 check((await db.query("select public.bidscope_shop_begin_payment($1,$2) as claimed",[order,b])).rows[0].claimed===false);
 check((await db.query("select public.bidscope_shop_begin_payment($1,$2) as claimed",[order,a])).rows[0].claimed===true);
 check((await db.query("select public.bidscope_shop_begin_payment($1,$2) as claimed",[order,a])).rows[0].claimed===false);
 const record=async(ref,transaction,amount=2000)=>(await db.query("select public.bidscope_shop_record_payment($1,$2,$3,'GHS','test') as status",[ref,transaction,amount])).rows[0].status;
 check(await record(reference,"123")==="paid");check(await record(reference,"123")==="paid");
 check(Number((await db.query("select count(*) as n from public.bidscope_shop_jobs where order_id=$1 and kind='fulfilment'",[order])).rows[0].n)===1);
 await rejects(()=>record(reference,"124"));
 const wrongAmountOrder=await create(a,await quote(),randomUUID());const wrongAmountRef=(await db.query("select payment_reference from public.bidscope_shop_orders where id=$1",[wrongAmountOrder])).rows[0].payment_reference;
 check(await record(wrongAmountRef,"125",1)==="payment_review");
 check(await record(wrongAmountRef,"125",1)==="payment_review");
 check(Number((await db.query("select count(*) as n from public.bidscope_shop_jobs where order_id=$1 and kind='fulfilment'",[wrongAmountOrder])).rows[0].n)===0);
 const lateOrder=await create(a,await quote(),randomUUID());await db.query("update public.bidscope_shop_orders set quote_expires_at=now()-interval '1 second' where id=$1",[lateOrder]);
 const lateRef=(await db.query("select payment_reference from public.bidscope_shop_orders where id=$1",[lateOrder])).rows[0].payment_reference;
 check(await record(lateRef,"126")==="payment_review");
 const collisionOrder=await create(a,await quote(),randomUUID());const collisionRef=(await db.query("select payment_reference from public.bidscope_shop_orders where id=$1",[collisionOrder])).rows[0].payment_reference;
 await rejects(()=>record(collisionRef,"123"));
 const request=async(customer,id,key,kind,message="Please review this fictional test order.")=>(await db.query("select public.bidscope_shop_request($1,$2,$3,$4,$5) as id",[customer,id,key,kind,message])).rows[0].id;
 await rejects(()=>request(b,order,randomUUID(),"support"));await rejects(()=>request(a,order,randomUUID(),"return"));
 const requestKey=randomUUID(),requestId=await request(a,order,requestKey,"cancellation");check(await request(a,order,requestKey,"cancellation")===requestId);
 await rejects(()=>request(a,order,requestKey,"support"));
 check((await db.query("select status from public.bidscope_shop_orders where id=$1",[order])).rows[0].status==="cancellation_requested");
 check(await record(reference,"123")==="cancellation_requested");
 const rights=(await db.query("select has_table_privilege('anon','public.bidscope_shop_orders','select') as anon,has_table_privilege('authenticated','public.bidscope_shop_orders','select') as customer,has_function_privilege('authenticated','public.bidscope_shop_record_payment(text,text,bigint,text,text)','execute') as execute")).rows[0];
 check(!rights.anon&&!rights.customer&&!rights.execute);
 const before=Number((await db.query("select count(*) as n from public.bidscope_shop_orders")).rows[0].n);
 await db.exec(await readFile("docs/commerce/rollback-order-ledger.sql","utf8"));
 check(Number((await db.query("select count(*) as n from public.bidscope_shop_orders")).rows[0].n)===before);
 console.log(`PASS: ${checks} isolated PostgreSQL checks; no external database, payment or supplier calls.`);
}finally{await db.close();}
