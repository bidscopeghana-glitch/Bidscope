// Isolated PostgreSQL. No live credentials or external calls.
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const {PGlite}=await import(pathToFileURL(path.resolve(".codex-tmp/commerce-sql-test/node_modules/@electric-sql/pglite/dist/index.js")).href);
const db=new PGlite();let checks=0;const check=value=>{assert.ok(value);checks++;};
try{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);");
 await db.exec(await readFile("supabase/migrations/20261110120000_shop_publications.sql","utf8"));
 const actor=randomUUID();await db.query("insert into auth.users values($1)",[actor]);
 const details={title:"Reviewed product",description:"Actual reviewed specifications of this test product.",category:"Home",image:"https://cf.cjdropshipping.com/test.jpg",origin:"CN",snapshot:{variants:[{supplierId:"v1",name:"Option",costUsdMinor:100}]},minUsdMinor:100,checkedAt:new Date().toISOString(),rightsEvidence:"Content rights reviewed for this product.",mediaEvidence:"Media rights reviewed for this product.",reviewExpiresAt:new Date(Date.now()+86400000).toISOString()};
 const publish=async(product,value)=>db.query("select public.bidscope_shop_publish($1,$2,$3)",[actor,product,JSON.stringify(value)]);
 await publish("CJ1",details);check((await db.query("select count(*)::int as n from public.bidscope_shop_publications")).rows[0].n===1);
 check((await db.query("select count(*)::int as n from public.bidscope_shop_publication_audit")).rows[0].n===1);
 await publish("CJ1",{...details,title:"Updated review"});check((await db.query("select count(*)::int as n from public.bidscope_shop_publications")).rows[0].n===1);
 check((await db.query("select count(*)::int as n from public.bidscope_shop_publication_audit")).rows[0].n===2);
 for(const patch of [{rightsEvidence:""},{mediaEvidence:""},{reviewExpiresAt:new Date(Date.now()-86400000).toISOString()},{snapshot:{}},{description:"<script>description long enough but unsafe html</script>"}]){await assert.rejects(()=>publish("INVALID",{...details,...patch}));checks++;}
 check((await db.query("select count(*)::int as n from public.bidscope_shop_publications")).rows[0].n===1);
 check((await db.query("select * from public.bidscope_shop_publication_categories()")).rows.length===1);
 await db.query("select public.bidscope_shop_retire_publication($1,$2,$3)",[actor,"CJ1","Permission requires additional review"]);
 check((await db.query("select * from public.bidscope_shop_publication_categories()")).rows.length===0);
 check((await db.query("select status from public.bidscope_shop_publications where product_id='CJ1'")).rows[0].status==="retired");
 check((await db.query("select count(*)::int as n from public.bidscope_shop_publication_audit")).rows[0].n===3);
 const privileges=(await db.query("select bool_and(c.relrowsecurity and not has_table_privilege('anon',c.oid,'select') and not has_table_privilege('authenticated',c.oid,'select')) as protected from pg_class c where c.relname in('bidscope_shop_publications','bidscope_shop_publication_audit')")).rows[0];check(privileges.protected);
 const rpc=(await db.query("select count(*)::int as n,bool_and(not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('authenticated',p.oid,'execute') and has_function_privilege('service_role',p.oid,'execute')) as protected from pg_proc p where p.proname in('bidscope_shop_publish','bidscope_shop_retire_publication','bidscope_shop_publication_categories')")).rows[0];check(rpc.n===3&&rpc.protected);
 await db.exec(await readFile("docs/commerce/rollback-publications.sql","utf8"));check((await db.query("select count(*)::int as n from public.bidscope_shop_publication_audit")).rows[0].n===3);
 console.log(`PASS: ${checks} publication PostgreSQL checks; no external calls.`);
}finally{await db.close();}
