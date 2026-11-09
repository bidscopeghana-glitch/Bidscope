"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Check,LockKeyhole,PackageCheck,RefreshCw,Truck} from "lucide-react";
import {CommerceHeader} from "./commerce-header";
import {readBag,shoppingBagKey,type BagLine} from "@/lib/commerce/shopping-bag";
import {deliveryDestinations} from "@/lib/commerce/retail-pricing";
import type {ReviewRecord} from "@/lib/commerce/checkout-review";
import {HostedCheckout} from "./hosted-checkout";
import {isLocalCommercePreview} from "@/lib/client/commerce-preview";
const usd=(v:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v/100);
const attemptKey="bidscope-checkout-review-attempt-v1";
export function CheckoutReviewPage(){const[local,setLocal]=useState<boolean|null>(null);useEffect(()=>{queueMicrotask(()=>setLocal(isLocalCommercePreview()));},[]);return local===null?<p>Loading checkout…</p>:local?<LocalCheckoutReviewPage/>:<HostedCheckout/>;}
function LocalCheckoutReviewPage(){
 const[bag,setBag]=useState<BagLine[]>([]),[ready,setReady]=useState(false),[destination,setDestination]=useState("GH"),[origin,setOrigin]=useState("CN"),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[records,setRecords]=useState<ReviewRecord[]>([]),[selected,setSelected]=useState<ReviewRecord|null>(null),[now,setNow]=useState(0);
 async function history(){try{const response=await fetch("/api/commerce/local-checkout",{cache:"no-store"});const data=await response.json() as {error?:string;records?:ReviewRecord[]};if(!response.ok||!data.records)throw Error(data.error||"Saved reviews are unavailable.");setRecords(data.records);}catch(error){setMessage((error as Error).message);}}
 useEffect(()=>{queueMicrotask(()=>{setBag(readBag(localStorage.getItem(shoppingBagKey)));setReady(true);setNow(Date.now());void history();});const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 async function prepare(fresh=false){
  setBusy(true);setMessage("");setSelected(null);
  try{
   const selection={destination,origin,lines:bag.map(({productId,variantId,quantity})=>({productId,variantId,quantity}))},signature=JSON.stringify(selection);
   let previous:{signature?:string;requestKey?:string}={};try{previous=JSON.parse(localStorage.getItem(attemptKey)||"{}");}catch{}
   const requestKey=!fresh&&previous.signature===signature&&previous.requestKey?previous.requestKey:crypto.randomUUID();
   localStorage.setItem(attemptKey,JSON.stringify({signature,requestKey}));
   const response=await fetch("/api/commerce/local-checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...selection,requestKey})});
   const data=await response.json() as {error?:string;record?:ReviewRecord;duplicate?:boolean};if(!response.ok||!data.record)throw Error(data.error||"The review did not complete. Check saved reviews before starting again.");
   setSelected(data.record);setNow(Date.now());setMessage(data.duplicate?"Opened the existing saved review. No duplicate review was created.":"Supplier checks saved. No payment, stock reservation or supplier order was created.");
  }catch(error){setMessage((error as Error).message);}finally{setBusy(false);void history();}
 }
 const review=selected?.review,expired=Boolean(review&&now>=Date.parse(review.expiresAt));
 return <main className="retail-page"><CommerceHeader destinationLabel={deliveryDestinations.find(([code])=>code===destination)?.[1]}/><div className="review-wrap">
  <Link href="/shop/cart" className="retail-back">← Back to your bag</Link><div className="review-title"><span>PRIVATE CHECKOUT PREPARATION</span><h1>A clear view before you pay.</h1><p>Check your options, delivery route and current prices. This review does not place an order.</p></div>
  <ol className="review-steps" aria-label="Order review steps"><li><Check size={17}/> Your bag</li><li className="active"><Truck size={18}/> Delivery & price review</li><li><LockKeyhole size={17}/> Payment unavailable</li></ol>
  <div className="review-layout"><section className="review-panel"><h2>Where should we check delivery?</h2><p>Coverage depends on each item and its dispatch origin. We do not need your full address for this private route check.</p><div className="review-selects"><label>Deliver to<select aria-label="Review delivery country" value={destination} onChange={event=>{setDestination(event.target.value);setSelected(null);}}>{deliveryDestinations.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label><label>Dispatch origin to check<select aria-label="Review dispatch origin" value={origin} onChange={event=>{setOrigin(event.target.value);setSelected(null);}}>{[["CN","China"],["US","United States"],["GB","United Kingdom"],["DE","Germany"],["FR","France"]].map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label></div>
   <h2>Your selection</h2>{!ready?<p>Loading your bag…</p>:bag.length?bag.map(line=><div className="review-selection" key={line.productId+line.variantId}><div><strong>{line.name}</strong><p>{line.variant}</p></div><span>Qty {line.quantity}</span></div>):<p>Your bag is empty. <Link href="/shop/catalogue">Explore products</Link></p>}
   <p className="review-note">Up to five different product options per review. Each item is quoted as a separate shipment; combined shipping is not assumed. The lowest returned postage is selected for this estimate.</p>
   <button className="retail-add review-action" disabled={!ready||!bag.length||bag.length>5||busy} onClick={()=>void prepare()}>{busy?<><RefreshCw size={17}/> Checking supplier prices, stock & routes…</>:<><PackageCheck size={18}/> Check current prices & delivery</>}</button>
   {busy&&<p role="status">Supplier requests run in sequence to respect API limits. Please keep this page open.</p>}
   <p role="status" className="review-message">{message}</p>
  </section><aside id="review-summary" className="review-panel review-summary"><span className="review-status">{expired?"PRICE REVIEW EXPIRED":"PAYMENT ON HOLD"}</span><h2>{review?"Your saved price review":"Your order review"}</h2>{review?<>
   <p className="review-reference">Review {review.id}<br/>Route {review.origin} → {review.destination}<br/>Checked {new Date(review.createdAt).toLocaleString("en-GB")}<br/>Prices expire {new Date(review.expiresAt).toLocaleTimeString("en-GB")}</p>
   <dl><div><dt>Products</dt><dd>{usd(review.merchandiseUsdMinor)}</dd></div><div><dt>Provider postage / known charges</dt><dd>{usd(review.postageUsdMinor)}</dd></div><div><dt>Known subtotal</dt><dd>{usd(review.knownSubtotalUsdMinor)}</dd></div><div><dt>Indicative GHS subtotal</dt><dd>GH₵{(review.knownSubtotalGhsMinor/100).toFixed(2)}</dd></div><div><dt>Payment fee</dt><dd>Not configured</dd></div><div><dt>Destination duties / taxes</dt><dd>Not confirmed</dd></div><div><dt>Final payable total</dt><dd>Unavailable</dd></div></dl>
   <p className="review-note">FX date {new Date(review.fxAsOf).toLocaleDateString("en-GB")} · <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a>. Indicative conversion, not a bank settlement rate.</p>
   {review.lines.map(line=><div className="review-route" key={line.productId+line.variantId}><strong>{line.name}</strong><p>{line.service} · carrier estimate {line.estimate}</p><p>Freight {usd(line.freightUsdMinor)} · provider tax {line.providerTaxUsdMinor===null?"unknown":usd(line.providerTaxUsdMinor)} · clearance {line.clearanceUsdMinor===null?"unknown":usd(line.clearanceUsdMinor)}</p><small>Supplier stock checked; not reserved.</small></div>)}
   <h3>Before payment can open</h3><ul>{review.blockers.map(blocker=><li key={blocker}>{blocker}</li>)}</ul>
   <button className="review-action retail-delivery-button" disabled={busy||!bag.length||bag.length>5} onClick={()=>void prepare(true)}>Start a fresh review of this bag</button>
  </>:<p>A server-checked breakdown will appear here. Saved browser prices cannot authorise payment.</p>}
   <button className="review-action retail-buy" disabled><LockKeyhole size={16}/> Payment is not enabled</button><p className="review-note">This local review is not a customer order or a payment request. No supplier purchase is made.</p>
  </aside></div>
  <section className="review-panel review-history"><div className="review-history-title"><div><span>WORKSTATION-ONLY RECORDS</span><h2>Saved checkout reviews</h2></div><button onClick={()=>void history()} disabled={busy}>Refresh saved reviews</button></div><p>These persist on this private server after reload. They are not production customer order history.</p>{records.length?records.map(record=><button className="review-history-row" key={record.id} disabled={busy} onClick={()=>{if(record.review){setDestination(record.review.destination);setOrigin(record.review.origin);}setSelected(record);setNow(Date.now());setMessage(record.error||"");document.getElementById("review-summary")?.scrollIntoView({behavior:"smooth",block:"start"});}}><span><strong>{record.review?record.review.lines.length+" product option(s)":record.status==="failed"?"Review could not be completed":"Review in progress"}</strong><small>{new Date(record.createdAt).toLocaleString("en-GB")} · {record.id.slice(0,8)}</small></span><b>{record.status==="held"?"Payment on hold":record.status}</b></button>):<p>No saved reviews yet.</p>}</section>
 </div></main>;
}
