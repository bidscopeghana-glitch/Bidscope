import {supabaseRest,supabaseRpc} from "../supabase-rest.ts";
import {ApiError} from "../api-error.ts";
export type StoredShopOrder={id:string;customer_id:string;payment_reference:string;payment_mode:"test"|"live";status:string;currency:"GHS";total_minor:number;quote_expires_at:string;created_at:string};
export function requireShopLedger(){if(process.env.BIDSCOPE_SHOP_LEDGER_READY!=="1")throw new ApiError(503,"Shopping order storage is not ready yet.","shop_ledger_unavailable");}
export async function orderForPayment(reference:string){
 requireShopLedger();
 const query=new URLSearchParams({select:"id,customer_id,payment_reference,payment_mode,status,currency,total_minor,quote_expires_at,created_at",payment_reference:"eq."+reference,limit:"1"});
 return (await supabaseRest<StoredShopOrder[]>("bidscope_shop_orders?"+query)).data[0]??null;
}
export async function recordShopPayment(order:StoredShopOrder,payment:{providerTransactionId:string;amountMinor:number;currency:string;mode:string}){
 requireShopLedger();
 return (await supabaseRpc<string>("bidscope_shop_record_payment",{p_reference:order.payment_reference,p_transaction:payment.providerTransactionId,p_amount:payment.amountMinor,p_currency:payment.currency,p_mode:payment.mode})).data;
}
export async function ownShopOrders(customerId:string){
 requireShopLedger();
 const query=new URLSearchParams({select:"id,payment_reference,payment_mode,status,currency,total_minor,shipping_minor,customer_fee_minor,import_charges_policy,created_at,items,shipments,refunds:bidscope_shop_refunds(amount_minor,status,created_at)",customer_id:"eq."+customerId,order:"created_at.desc,id.desc",limit:"50"});
 return (await supabaseRest<unknown[]>("bidscope_shop_orders?"+query)).data;
}
