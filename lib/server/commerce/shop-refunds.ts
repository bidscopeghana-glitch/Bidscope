import {z} from "zod";
export type ExpectedTestRefund={reference:string;paymentReference:string;transactionId:string;amountMinor:number};
function validate(expected:ExpectedTestRefund,key:string){
 if(!key.startsWith("sk_test_")||!/^BSC-RF-SBX-[A-Za-z0-9_-]{8,50}$/.test(expected.reference)||!/^BSC-SBX-[A-Za-z0-9-]{1,80}$/.test(expected.paymentReference)||!/^\d{1,30}$/.test(expected.transactionId)||!Number.isSafeInteger(expected.amountMinor)||expected.amountMinor<1)throw Error("A saved sandbox refund is required.");
}
export function checkedTestRefund(raw:unknown,expected:ExpectedTestRefund){
 const r=z.object({id:z.number().int().positive(),domain:z.literal("test"),amount:z.number().int().positive(),currency:z.literal("GHS"),reference:z.string().optional(),transaction:z.union([z.number().int().positive(),z.object({id:z.number().int().positive(),reference:z.string(),domain:z.literal("test").optional()})]),status:z.enum(["pending","processing","processed","failed","needs-attention","needs_attention"])}).parse(raw);
 const id=typeof r.transaction==="number"?String(r.transaction):String(r.transaction.id);
 if(id!==expected.transactionId||r.amount!==expected.amountMinor||r.reference&&r.reference!==expected.reference||typeof r.transaction!=="number"&&r.transaction.reference!==expected.paymentReference)throw Error("Refund verification mismatch.");
 return {providerId:String(r.id),status:r.status.replace("-","_")};
}
export async function createTestRefund(expected:ExpectedTestRefund,key:string,transport:typeof fetch=fetch){
 validate(expected,key);
 const response=await transport("https://api.paystack.co/refund",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({transaction:expected.paymentReference,reference:expected.reference,amount:expected.amountMinor,currency:"GHS",merchant_note:"BidScope private SANDBOX test refund"}),redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});
 const envelope=await response.json() as {status?:boolean;data?:unknown};if(!response.ok||envelope.status!==true)throw Error("Refund write needs reconciliation; do not resubmit automatically.");
 return checkedTestRefund(envelope.data,expected);
}
export async function readTestRefund(expected:ExpectedTestRefund,providerId:string|null,key:string,transport:typeof fetch=fetch){
 validate(expected,key);if(providerId&&!/^\d{1,30}$/.test(providerId))throw Error("Invalid provider refund ID.");
 const path=providerId?"/refund/"+providerId:"/refund?"+new URLSearchParams({reference:expected.reference,transaction:expected.transactionId,perPage:"10",page:"1"});
 const response=await transport("https://api.paystack.co"+path,{headers:{Authorization:"Bearer "+key},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});
 const envelope=await response.json() as {status?:boolean;data?:unknown};if(!response.ok||envelope.status!==true)throw Error("Refund status unavailable.");
 const raw=providerId?envelope.data:z.array(z.object({reference:z.string()}).passthrough()).parse(envelope.data).find(item=>item.reference===expected.reference);
 const checked=checkedTestRefund(raw,expected);if(providerId&&checked.providerId!==providerId)throw Error("Refund provider ID mismatch.");return checked;
}
