"use client";
import {useState} from "react";
import {CheckCircle2,MessageCircleMore,Send,Star} from "lucide-react";
import {api,invalidate,useData,date} from "./data";
import {useAccount} from "./shell";

type FeedbackRow={id:string;category:string;subject:string;message:string;rating:number|null;status:string;created_at:string;updated_at:string};
const categories=[["GENERAL","General feedback"],["TENDER_DATA","Tender information"],["AI_ANALYSIS","AI Tender Evaluation"],["ALERTS","Alerts and notifications"],["BILLING","Plans and billing"],["BUYER_WORKSPACE","Buyer workspace"],["TECHNICAL","Technical problem"],["FEATURE_REQUEST","Feature request"]] as const;

export function FeedbackPage(){
 const{toast}=useAccount(),history=useData<{data:FeedbackRow[]}>("/api/feedback"),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[rating,setRating]=useState<number|null>(null);
 return <><div className="cc-page-heading"><div><p className="cc-eyebrow">HELP SHAPE BIDSCOPE</p><h1>Feedback</h1><p>Report a problem, correct tender information or suggest an improvement. Every submission is reviewed by the BidScope team.</p></div><div className="cc-feedback-hero" aria-hidden="true"><MessageCircleMore size={38}/></div></div>
 <div className="cc-feedback-layout"><form className="cc-editor cc-feedback-form" onSubmit={async event=>{event.preventDefault();setBusy(true);setSent(false);const form=event.currentTarget,data=new FormData(form);try{await api("/api/feedback",{category:data.get("category"),subject:data.get("subject"),message:data.get("message"),rating,pageUrl:window.location.href});form.reset();setRating(null);setSent(true);toast("Thank you. Your feedback was sent to BidScope.");invalidate();}catch(error){toast(error instanceof Error?error.message:"Feedback could not be sent.");}finally{setBusy(false);}}}>
   <div><p className="cc-eyebrow">SEND FEEDBACK</p><h2>Tell us what happened</h2><p className="cc-quiet">Do not include passwords, payment-card details or confidential tender documents.</p></div>
   {sent?<p className="cc-success"><CheckCircle2 size={17}/>Feedback received. You can track its status below.</p>:null}
   <label>Category<select name="category" defaultValue="GENERAL">{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label>Subject<input name="subject" required minLength={3} maxLength={160} placeholder="Briefly describe your feedback"/></label>
   <label>Details<textarea name="message" required minLength={10} maxLength={5000} rows={8} placeholder="Include the steps, page or tender involved and what you expected to happen."/></label>
   <fieldset><legend>Overall experience (optional)</legend><div className="cc-rating">{[1,2,3,4,5].map(value=><button type="button" key={value} aria-label={`${value} star${value===1?"":"s"}`} aria-pressed={rating===value} onClick={()=>setRating(value)}><Star size={21} fill={rating!==null&&value<=rating?"currentColor":"none"}/></button>)}</div></fieldset>
   <button className="cc-button primary" disabled={busy}><Send size={15}/>{busy?"Sending…":"Send feedback"}</button>
 </form><section className="cc-panel cc-feedback-history"><p className="cc-eyebrow">YOUR SUBMISSIONS</p><h2>Feedback history</h2>{history.loading?<p>Loading feedback…</p>:history.error?<p role="alert" className="cc-error">{history.error}</p>:history.data?.data.length?history.data.data.map(item=><article key={item.id}><div><span className={`cc-feedback-status ${item.status.toLowerCase()}`}>{item.status.replaceAll("_"," ")}</span><small>{date(item.created_at)}</small></div><h3>{item.subject}</h3><p>{item.message}</p><small>{categories.find(([value])=>value===item.category)?.[1]||item.category}{item.rating?` · ${item.rating}/5`:""}</small></article>):<p className="cc-quiet">You have not submitted feedback yet.</p>}</section></div></>;
}
