import {DatabaseSync} from "node:sqlite";
import {mkdirSync} from "node:fs";
import {readFile,mkdir,writeFile,rename} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import path from "node:path";
import {verifyTestPayment} from "./payments.ts";
const directory=path.join(process.cwd(),".codex-tmp","commerce"),credential=path.join(directory,"paystack-test-key.json");
export async function commerceTestKey(){if(process.env.BIDSCOPE_COMMERCE_PAYSTACK_TEST_KEY?.startsWith("sk_test_"))return process.env.BIDSCOPE_COMMERCE_PAYSTACK_TEST_KEY;if(process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP!=="1")return "";try{const data=JSON.parse(await readFile(credential,"utf8"));return typeof data.key==="string"&&data.key.startsWith("sk_test_")?data.key:"";}catch{return "";}}
export async function saveCommerceTestKey(key:string){if(!/^sk_test_[A-Za-z0-9]{20,200}$/.test(key))throw Error("Only a Paystack test secret key is accepted. Live keys are rejected.");await mkdir(directory,{recursive:true,mode:0o700});const temporary=path.join(directory,"paystack-test-"+randomUUID()+".tmp");await writeFile(temporary,JSON.stringify({key,createdAt:new Date().toISOString()}),{mode:0o600,flag:"wx"});await rename(temporary,credential);return {configured:true,mode:"test",liveCheckout:false};}
export function createPaymentTestService(key:string,file=path.join(directory,"payment-tests.sqlite"),transport:typeof fetch=fetch){
 if(!key.startsWith("sk_test_"))throw Error("A Paystack test key is required; live payment is not supported by this test service.");
 mkdirSync(path.dirname(file),{recursive:true});const db=new DatabaseSync(file);db.exec("PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS payment_tests(reference TEXT PRIMARY KEY,amount INTEGER NOT NULL CHECK(amount=100),status TEXT NOT NULL,created_at TEXT NOT NULL,verified_at TEXT)");
 return {close(){db.close();},
 async initialize(callbackUrl:string){
  const callback=new URL(callbackUrl);if(!["http:","https:"].includes(callback.protocol)||!["localhost","127.0.0.1","[::1]"].includes(callback.hostname)||callback.pathname!=="/shop/payment-test"||callback.username||callback.password)throw Error("Only the private localhost test callback is allowed.");
  const reference="BIDSCOPE-COMMERCE-TEST-"+randomUUID();db.prepare("INSERT INTO payment_tests(reference,amount,status,created_at) VALUES(?,100,'pending',?)").run(reference,new Date().toISOString());
  try{const r=await transport("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({reference,amount:100,currency:"GHS",email:"bidscope-checkout-test@example.com",callback_url:callback.href,channels:["card","mobile_money"],metadata:{bidscope_commerce_test:true}}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});const data=await r.json() as {status?:boolean;data?:{reference?:string;authorization_url?:string}};if(!r.ok||!data.status||data.data?.reference!==reference||!data.data.authorization_url)throw Error("Paystack test initialization failed.");const url=new URL(data.data.authorization_url);if(url.protocol!=="https:"||url.hostname!=="checkout.paystack.com"||url.username||url.password||url.port)throw Error("Unexpected checkout destination.");db.prepare("UPDATE payment_tests SET status='initialized' WHERE reference=?").run(reference);return {reference,url:url.href,amount:100,currency:"GHS",mode:"test",liveCheckout:false};}
  catch{db.prepare("UPDATE payment_tests SET status='exception' WHERE reference=?").run(reference);throw Error("Test checkout could not be initialized. Its saved reference requires reconciliation; no automatic retry was made.");}
 },
 async verify(reference:string){const row=db.prepare("SELECT amount,status FROM payment_tests WHERE reference=?").get(reference) as {amount:number;status:string}|undefined;if(!row)throw Error("Unknown local test reference.");if(row.status==="verified")return {verified:true,duplicate:true,liveCheckout:false};await verifyTestPayment(reference,{amount:row.amount,currency:"GHS"},key,transport);const result=db.prepare("UPDATE payment_tests SET status='verified',verified_at=? WHERE reference=? AND status<>'verified'").run(new Date().toISOString(),reference);return {verified:true,duplicate:result.changes===0,liveCheckout:false};}
 };
}
