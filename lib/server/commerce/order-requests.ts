import {z} from "zod";
import {supabaseRpc} from "../supabase-rest.ts";
import {requireShopLedger} from "./shop-order-store.ts";
export const orderRequestInput=z.object({orderId:z.string().uuid(),requestKey:z.string().uuid(),kind:z.enum(["cancellation","return","support"]),message:z.string().trim().min(1).max(3000)}).strict();
export async function submitOrderRequest(customerId:string,raw:unknown){
 requireShopLedger();const input=orderRequestInput.parse(raw);
 return (await supabaseRpc<string>("bidscope_shop_request",{p_customer:customerId,p_order:input.orderId,p_key:input.requestKey,p_kind:input.kind,p_message:input.message})).data;
}
