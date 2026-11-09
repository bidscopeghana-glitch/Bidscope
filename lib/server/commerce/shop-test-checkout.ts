import {z} from "zod";
import {validateShopPaymentConfig,type ExpectedShopPayment} from "./shop-payments.ts";
export function validShopCheckoutUrl(value:string){const url=new URL(value);if(url.protocol!=="https:"||url.hostname!=="checkout.paystack.com"||url.port||url.username||url.password||url.pathname==="/")throw Error("Payment provider returned an invalid checkout URL.");return url.toString();}
export async function initializeShopTestPayment(expected:ExpectedShopPayment,email:string,callback:string,key:string,transport:typeof fetch=fetch){
 if(expected.mode!=="test")throw Error("This checkout accepts sandbox payments only.");
 validateShopPaymentConfig(expected,key);z.string().email().max(320).parse(email);
 const callbackUrl=new URL(callback);if(callbackUrl.protocol!=="https:"||callbackUrl.username||callbackUrl.password||callbackUrl.pathname!=="/shop/orders")throw Error("Invalid payment callback.");
 const response=await transport("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({email,amount:expected.amountMinor,currency:expected.currency,reference:expected.reference,callback_url:callback,channels:["card","mobile_money"],metadata:{bidscope_commerce_mode:"test"}}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
 const result=await response.json() as {status?:boolean;data?:{authorization_url?:string;reference?:string}};
 if(!response.ok||result.status!==true||result.data?.reference!==expected.reference||!result.data.authorization_url)throw Error("Sandbox checkout initialization needs reconciliation.");
 return validShopCheckoutUrl(result.data.authorization_url);
}
