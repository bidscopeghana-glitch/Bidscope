export type Variant={id:string;supplierId:string;name:string;cost:number;stock:number};
export type Product={id:string;supplierId:string;provider:"sample"|"cj"|"alibaba";name:string;category:string;description:string;origin:string;kind:"retail"|"quote";art:"lamp"|"bag"|"bottle"|"chair";permission:"sample"|"approved"|"unknown";evidence:string;sample:boolean;image?:string;checkedAt?:string;variants:Variant[]};
export type Line={variantId:string;quantity:number};
export type Pricing={fx:number;markupBps:number;feeBps:number;shipping:number;duty:number|null};
export type Quote={lines:Line[];cost:number;merchandise:number;shipping:number;duty:number|null;fee:number;total:number;margin:number;currency:"GHS";expires:number;fingerprint:string};
export type Shipment={id:string;lines:Line[];carrier:string;tracking:string;delivered:boolean};
export type Status="awaiting_payment"|"paid"|"supplier_payment_pending"|"exception"|"partially_shipped"|"shipped"|"delivered"|"cancellation_requested"|"return_requested"|"refund_pending"|"refunded";
export type Order={id:string;quote:Quote;status:Status;payment:string|null;supplierOrder:string|null;supplierPaid:boolean;shipments:Shipment[];events:string[];refund:string|null};
export const samplePricing:Pricing={fx:15,markupBps:3000,feeBps:195,shipping:6500,duty:null};
export const sampleProducts:Product[]=[
 {id:"sample-light",supplierId:"DEMO-P1",provider:"sample",name:"Arc desk light",category:"Home & living",description:"A sculptural task light concept for thoughtful workspaces. Dimensions, electrical compliance and materials require supplier verification.",origin:"China — sample only",kind:"retail",art:"lamp",permission:"sample",evidence:"Original BidScope illustration and fictional copy",sample:true,variants:[{id:"light-sand",supplierId:"DEMO-V1",name:"Sand",cost:900,stock:12},{id:"light-forest",supplierId:"DEMO-V2",name:"Forest",cost:950,stock:4}]},
 {id:"sample-tote",supplierId:"DEMO-P2",provider:"sample",name:"Everyday carry tote",category:"Bags & accessories",description:"An everyday carry concept with a clean silhouette. Sample materials and specifications are unverified.",origin:"China — sample only",kind:"retail",art:"bag",permission:"sample",evidence:"Original BidScope illustration and fictional copy",sample:true,variants:[{id:"tote-natural",supplierId:"DEMO-V3",name:"Natural",cost:650,stock:20},{id:"tote-black",supplierId:"DEMO-V4",name:"Charcoal",cost:700,stock:0}]},
 {id:"sample-flask",supplierId:"DEMO-P3",provider:"sample",name:"Daily travel flask",category:"Travel & outdoors",description:"An understated travel flask concept. Capacity, materials and food-contact testing require review.",origin:"China — sample only",kind:"retail",art:"bottle",permission:"sample",evidence:"Original BidScope illustration and fictional copy",sample:true,variants:[{id:"flask-sage",supplierId:"DEMO-V5",name:"Sage",cost:500,stock:30}]},
 {id:"sample-workspace",supplierId:"DEMO-P4",provider:"sample",name:"Workspace furniture sourcing",category:"Business sourcing",description:"Tell us your project quantity, specification and destination. Wholesale sourcing requires an individually reviewed quote.",origin:"To be confirmed",kind:"quote",art:"chair",permission:"sample",evidence:"Original BidScope illustration and fictional copy",sample:true,variants:[{id:"workspace-quote",supplierId:"DEMO-V6",name:"Project specification",cost:0,stock:0}]}
];
export function variantFor(products:Product[],id:string){
 const found=products.flatMap(product=>product.variants.filter(v=>v.id===id).map(variant=>({product,variant})));
 if(found.length!==1)throw Error("Missing or ambiguous product / variant mapping.");
 return found[0];
}
export function quoteCart(products:Product[],lines:Line[],pricing:Pricing,destination:string,now=Date.now()):Quote{
 if(destination!=="GH")throw Error("No route configured for this destination. Ghana coverage is simulated only.");
 if(!lines.length||lines.length>50||new Set(lines.map(l=>l.variantId)).size!==lines.length)throw Error("Choose unique variants, up to 50 per order.");
 if(!Number.isFinite(pricing.fx)||pricing.fx<=0||pricing.fx>1000||![pricing.markupBps,pricing.feeBps,pricing.shipping].every(n=>Number.isSafeInteger(n)&&n>=0)||pricing.feeBps>=10000||pricing.markupBps>100000||pricing.duty!==null&&(!Number.isSafeInteger(pricing.duty)||pricing.duty<0))throw Error("Invalid pricing settings.");
 let cost=0;
 for(const line of lines){
  const {product,variant}=variantFor(products,line.variantId);
  if(product.kind!=="retail")throw Error("Wholesale enquiries require a reviewed quote.");
  if(product.permission!=="approved"&&!(product.sample&&product.permission==="sample"))throw Error("Publication permission is not approved.");
  if(!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>999||variant.stock<line.quantity)throw Error("Stock unavailable for the selected quantity.");
  if(!Number.isSafeInteger(variant.cost)||variant.cost<0)throw Error("Invalid supplier price.");
  cost+=Math.ceil(variant.cost*pricing.fx)*line.quantity;
 }
 const merchandise=Math.ceil(cost*(10000+pricing.markupBps)/10000);
 const base=merchandise+pricing.shipping+(pricing.duty??0),total=Math.ceil(base*10000/(10000-pricing.feeBps));
 if(!Number.isSafeInteger(total)||total>100_000_000)throw Error("Manual pricing review required.");
 return {lines:structuredClone(lines),cost,merchandise,shipping:pricing.shipping,duty:pricing.duty,fee:total-base,total,margin:merchandise-cost,currency:"GHS",expires:now+300000,fingerprint:JSON.stringify({lines,cost,pricing,destination})};
}
export function newOrder(id:string,quote:Quote):Order{return {id,quote:structuredClone(quote),status:"awaiting_payment",payment:null,supplierOrder:null,supplierPaid:false,shipments:[],events:["Sample order created; no money collected."],refund:null};}
export function recordPayment(order:Order,payment:{reference:string;amount:number;currency:string;verified:boolean},fresh:Quote,now=Date.now()):Order{
 if(!payment.verified||payment.amount!==order.quote.total||payment.currency!=="GHS"||!payment.reference)throw Error("Payment verification failed.");
 if(order.payment){if(order.payment!==payment.reference)throw Error("Another payment is already recorded.");return order;}
 if(order.status!=="awaiting_payment"||now>=order.quote.expires||fresh.fingerprint!==order.quote.fingerprint)throw Error("Revalidate price, stock and shipping before payment.");
 return {...order,payment:payment.reference,status:"paid",events:[...order.events,"Sample customer payment verified; supplier remains unpaid."]};
}
export function submitSupplier(order:Order,fail=false):Order{
 if(order.supplierOrder)return order;
 if(!order.payment||!["paid","exception"].includes(order.status))throw Error("Verified customer payment required.");
 if(fail)return {...order,status:"exception",events:[...order.events,"Ambiguous sample supplier timeout. Reconcile merchant reference before retry."]};
 return {...order,supplierOrder:"DEMO-SUPPLIER-"+order.id,status:"supplier_payment_pending",events:[...order.events,"Sample supplier order created once; supplier payment pending."]};
}
export function paySupplier(order:Order,fail=false):Order{
 if(!order.supplierOrder||!["supplier_payment_pending","exception"].includes(order.status))throw Error("Supplier order required.");
 if(order.supplierPaid)return order;
 return {...order,supplierPaid:!fail,status:fail?"exception":"paid",events:[...order.events,fail?"Sample supplier payment failed; admin action required.":"Sample supplier payment confirmed separately."]};
}
export function trackShipment(order:Order,shipment:Shipment):Order{
 if(!order.supplierPaid||!["paid","partially_shipped","shipped","delivered"].includes(order.status))throw Error("An active paid supplier order is required.");
 if(!shipment.lines.length||!shipment.carrier||!shipment.tracking)throw Error("Tracking evidence is incomplete.");
 const existing=order.shipments.find(s=>s.id===shipment.id);
 if(existing&&JSON.stringify(existing.lines)!==JSON.stringify(shipment.lines))throw Error("Shipment allocation cannot change.");
 if(existing?.delivered&&!shipment.delivered)return order;
 const shipments=[...order.shipments.filter(s=>s.id!==shipment.id),shipment];
 for(const s of shipments)for(const l of s.lines)if(!Number.isInteger(l.quantity)||l.quantity<1||!order.quote.lines.some(x=>x.variantId===l.variantId))throw Error("Invalid shipment line.");
 for(const l of order.quote.lines)if(shipments.flatMap(s=>s.lines).filter(x=>x.variantId===l.variantId).reduce((n,x)=>n+x.quantity,0)>l.quantity)throw Error("Shipment exceeds purchased quantity.");
 const full=order.quote.lines.every(l=>shipments.flatMap(s=>s.lines).filter(x=>x.variantId===l.variantId).reduce((n,x)=>n+x.quantity,0)===l.quantity);
 return {...order,shipments,status:full?(shipments.every(s=>s.delivered)?"delivered":"shipped"):"partially_shipped",events:[...order.events,"Sample tracking: "+shipment.tracking]};
}
export function requestResolution(order:Order,kind:"cancel"|"return"):Order{
 if(kind==="cancel"&&!["awaiting_payment","paid","supplier_payment_pending","exception"].includes(order.status))throw Error("Shipment has started; a return may be appropriate.");
 if(kind==="return"&&order.status!=="delivered")throw Error("Returns require a delivered order.");
 return {...order,status:kind==="cancel"?"cancellation_requested":"return_requested",events:[...order.events,kind+" requested; provider review required."]};
}
export function refundOrder(order:Order,reference:string,confirmed=false):Order{
 if(order.status==="refunded")return order;
 if(!reference||!order.payment||!["cancellation_requested","return_requested","exception","refund_pending"].includes(order.status))throw Error("Refund requires a paid order and a resolution request.");
 return {...order,status:confirmed?"refunded":"refund_pending",refund:reference,events:[...order.events,confirmed?"Sample refund confirmed; no money moved.":"Sample refund awaiting provider confirmation."]};
}
export function money(n:number){return new Intl.NumberFormat("en-GH",{style:"currency",currency:"GHS"}).format(n/100);}
