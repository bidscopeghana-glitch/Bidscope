import {isValidPaystackSignature} from "../paystack-signature.ts";
export {isValidPaystackSignature};
export async function verifyTestPayment(reference:string,expected:{amount:number;currency:string},key:string,transport:typeof fetch=fetch){
 if(!key.startsWith("sk_test_"))throw Error("Commerce accepts Paystack test credentials only.");
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(reference)||!Number.isSafeInteger(expected.amount)||expected.amount<1)throw Error("Invalid payment reference or amount.");
 const response=await transport("https://api.paystack.co/transaction/verify/"+encodeURIComponent(reference),{headers:{Authorization:"Bearer "+key},cache:"no-store",signal:AbortSignal.timeout(15000),redirect:"error"});
 const result=await response.json() as {status:boolean;data?:{status:string;reference:string;amount:number;currency:string}};
 const p=result.data;
 if(!response.ok||!result.status||!p||p.status!=="success"||p.reference!==reference||p.amount!==expected.amount||p.currency!==expected.currency)throw Error("Server payment verification mismatch.");
 return {reference:p.reference,amount:p.amount,currency:p.currency,verified:true as const};
}
