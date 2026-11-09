import {createHmac,timingSafeEqual} from "node:crypto";
import {z} from "zod";

export type ShopPaymentMode="test"|"live";
export type ExpectedShopPayment={reference:string;amountMinor:number;currency:"GHS";mode:ShopPaymentMode};
export class ShopPaymentMismatch extends Error{
 readonly payment:{providerTransactionId:string;amountMinor:number;currency:string;mode:ShopPaymentMode};
 constructor(payment:{providerTransactionId:string;amountMinor:number;currency:string;mode:ShopPaymentMode}){super("Verified payment requires amount/currency reconciliation.");this.payment=payment;}
}
const reference=z.string().regex(/^BSC-(SBX|LIVE)-[A-Za-z0-9-]{1,80}$/);
export function validateShopPaymentConfig(expected:ExpectedShopPayment,key:string){
 reference.parse(expected.reference);
 if(!Number.isSafeInteger(expected.amountMinor)||expected.amountMinor<1||expected.amountMinor>100_000_000)throw Error("Invalid order amount.");
 if(expected.currency!=="GHS"||!key.startsWith(expected.mode==="test"?"sk_test_":"sk_live_")||!expected.reference.startsWith(expected.mode==="test"?"BSC-SBX-":"BSC-LIVE-"))throw Error("Payment environment mismatch.");
}
export async function verifyShopPayment(expected:ExpectedShopPayment,key:string,transport:typeof fetch=fetch){
 validateShopPaymentConfig(expected,key);
 const response=await transport("https://api.paystack.co/transaction/verify/"+encodeURIComponent(expected.reference),{headers:{Authorization:"Bearer "+key},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
 const body=await response.json() as {status?:boolean;data?:{reference?:string;amount?:number;currency?:string;domain?:string;status?:string;id?:number}};
 const payment=body.data;
 if(!response.ok||body.status!==true||!payment||payment.status!=="success"||payment.reference!==expected.reference||payment.domain!==expected.mode||!Number.isSafeInteger(payment.id)||Number(payment.id)<=0||!Number.isSafeInteger(payment.amount)||Number(payment.amount)<1||typeof payment.currency!=="string"||! /^[A-Z]{3}$/.test(payment.currency))throw Error("Payment verification did not match the saved order.");
 if(payment.amount!==expected.amountMinor||payment.currency!==expected.currency)throw new ShopPaymentMismatch({providerTransactionId:String(payment.id),amountMinor:Number(payment.amount),currency:payment.currency,mode:expected.mode});
 return {...expected,providerTransactionId:String(payment.id),verified:true as const};
}

// Isolated commerce verification; existing tender-subscription webhooks are unchanged.
export function verifyShopWebhook(raw:Uint8Array,headers:Headers,config:{apiKey:string;signingSecrets?:string[]},nowSeconds=Math.floor(Date.now()/1000)){
 const modern=headers.get("paystack-signature");
 const secrets=(config.signingSecrets||[]).filter(secret=>secret.startsWith("whsec_"));
 if(secrets.length!==(config.signingSecrets||[]).length)return false;
 if(modern){
  const parts=modern.split(",").map(part=>part.trim());
  const timestamps=parts.filter(part=>part.startsWith("t="));
  if(timestamps.length!==1||!/^t=\d+$/.test(timestamps[0]))return false;
  const timestamp=Number(timestamps[0].slice(2));
  if(!Number.isSafeInteger(timestamp)||Math.abs(nowSeconds-timestamp)>300)return false;
  const signatures=parts.filter(part=>part.startsWith("v1=")).map(part=>part.slice(3)).filter(part=>/^whk_[A-Za-z0-9_-]+:[a-f0-9]{128}$/.test(part)).map(part=>part.slice(part.indexOf(":")+1));
  return secrets.some(secret=>{const expected=createHmac("sha512",secret).update(String(timestamp)+".").update(raw).digest();return signatures.some(signature=>timingSafeEqual(expected,Buffer.from(signature,"hex")));});
 }
 // Once a signing secret is configured, a missing modern header cannot downgrade.
 if(secrets.length||!/^sk_(test|live)_/.test(config.apiKey))return false;
 const legacy=headers.get("x-paystack-signature")||"";
 if(!/^[a-f0-9]{128}$/.test(legacy))return false;
 return timingSafeEqual(createHmac("sha512",config.apiKey).update(raw).digest(),Buffer.from(legacy,"hex"));
}
