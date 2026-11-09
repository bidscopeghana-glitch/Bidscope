import {createNotification,stableDedupe} from "../notifications";
const copy={
 payment_verified:["Payment received","Your payment has been verified. Supplier fulfilment is being reviewed."],
 shipped:["Shipment update","A shipment update is available for your order."],
 exception:["Order needs attention","The team is reviewing a fulfilment issue. Open your order for details."],
 refund_confirmed:["Refund update","Your payment provider has confirmed a refund. Settlement timing depends on the payment method."]
} as const;
export async function notifyCommerceOrder(userId:string,orderId:string,event:keyof typeof copy,providerEventId:string){
 if(process.env.BIDSCOPE_COMMERCE_NOTIFICATIONS_ENABLED!=="1")return null;
 const [title,message]=copy[event];
 return createNotification({userId,type:"system",title,message,relatedEntityType:"commerce_order",relatedEntityId:orderId,relatedUrl:"/shop",dedupeKey:stableDedupe(["commerce",orderId,event,providerEventId])});
}
