import {readFile,mkdir,writeFile,rename,unlink} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import path from "node:path";

const directory=path.join(process.cwd(),".codex-tmp","commerce");
const liveFile=path.join(directory,"paystack-live-key.json");
const livePattern=/^sk_live_[A-Za-z0-9]{20,200}$/;

// This module exposes a read-only credential connection, not a payment method.
// Do not share its credential with the existing subscription integration or the
// isolated TEST checkout. A configured key never opens customer checkout.
export async function commerceLiveStatus(file=liveFile){
 if(process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP!=="1")return {configured:false,mode:"live",liveCheckout:false,verifiedAt:null};
 try{const saved=JSON.parse(await readFile(file,"utf8"));return {configured:typeof saved.key==="string"&&livePattern.test(saved.key),mode:"live",liveCheckout:false,verifiedAt:typeof saved.verifiedAt==="string"?saved.verifiedAt:null};}catch{return {configured:false,mode:"live",liveCheckout:false,verifiedAt:null};}
}

export async function saveCommerceLiveKey(key:string,file=liveFile,transport:typeof fetch=fetch){
 if(process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP!=="1")throw Error("Private local setup is required.");
 if(!livePattern.test(key))throw Error("A valid Paystack live secret key is required. Test keys are not accepted here.");
 // Official read-only integration endpoint. Never initialize a transaction,
 // fetch customer histories/balances, or change Paystack settings to test a key.
 const response=await transport("https://api.paystack.co/integration/payment_session_timeout",{method:"GET",headers:{Authorization:"Bearer "+key},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});
 let body:unknown;try{body=await response.json();}catch{throw Error("Paystack did not confirm the live credential.");}
 const result=body as {status?:boolean;data?:{payment_session_timeout?:unknown}};
 if(!response.ok||result?.status!==true||typeof result.data?.payment_session_timeout!=="number"||!Number.isFinite(result.data.payment_session_timeout))throw Error("Paystack did not confirm the live credential. Nothing was saved.");
 const verifiedAt=new Date().toISOString(),folder=path.dirname(file);
 await mkdir(folder,{recursive:true,mode:0o700});
 const temporary=path.join(folder,"paystack-live-"+randomUUID()+".tmp");
 await writeFile(temporary,JSON.stringify({key,verifiedAt,validation:"read_only_integration_get"}),{flag:"wx",mode:0o600});
 try{await rename(temporary,file);}catch(error){await unlink(temporary).catch(()=>{});throw error;}
 return {configured:true,mode:"live",liveCheckout:false,verifiedAt};
}
