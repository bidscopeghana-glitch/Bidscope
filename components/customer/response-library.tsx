"use client";
import {useState} from "react";
import {ANSWER_CATEGORIES,answerNeedsReview,type LibraryAnswer,type AnswerVersion} from "@/lib/response-library";
import {api,useData,invalidate,date} from "./data";
import {useAccount,Empty,Skeleton} from "./shell";

export function ResponseLibrary(){
 const{organization,toast}=useAccount();
 const result=useData<{data:LibraryAnswer[];versions:AnswerVersion[];canApprove:boolean}>(organization?`/api/response-library?organizationId=${organization.id}`:null);
 const[editing,setEditing]=useState<LibraryAnswer|null>(null),[query,setQuery]=useState(""),[busy,setBusy]=useState(false);
 async function action(item:LibraryAnswer,action:"approve"|"archive"){
  setBusy(true);try{await api("/api/response-library",{organizationId:organization!.id,action,id:item.id,revision:item.revision});invalidate();toast(action==="approve"?"Approved version saved.":"Answer archived.","success");}catch(error){toast((error as Error).message,"error");}finally{setBusy(false);}
 }
 if(!organization)return <Empty title="Add your business first" description="Approved answers belong to your company workspace." href="/customer/profile" action="Create profile"/>;
 return <><div className="cc-page-heading"><div><p className="cc-eyebrow">BID WORKSPACE</p><h1>Answer library</h1><p>Prepare reusable responses. An owner or administrator approves each version before your team reuses it.</p></div></div>
 {result.loading?<Skeleton/>:result.error?<p role="alert" className="cc-error">{result.error}</p>:<>
 <form key={editing?`${editing.id}:${editing.revision}`:"new"} className="cc-editor cc-feedback-form" onSubmit={async event=>{
  event.preventDefault();const form=event.currentTarget,values=new FormData(form);setBusy(true);
  try{await api("/api/response-library",{organizationId:organization.id,action:editing?"save":"create",id:editing?.id,revision:editing?.revision,value:{title:values.get("title"),category:values.get("category"),tags:String(values.get("tags")||"").split(",").map(t=>t.trim()).filter(Boolean),content:values.get("content"),reviewDate:values.get("reviewDate")||null}});setEditing(null);form.reset();invalidate();toast("Draft saved. Approved content is unchanged.","success");}catch(error){toast((error as Error).message,"error");}finally{setBusy(false);}
 }}><h2>{editing?"Edit draft revision":"Create reusable answer"}</h2>
 <label>Title<input name="title" required maxLength={200} defaultValue={editing?.title}/></label>
 <label>Category<select name="category" defaultValue={editing?.category||ANSWER_CATEGORIES[0]}>{ANSWER_CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></label>
 <label>Tags (comma separated)<input name="tags" defaultValue={editing?.tags.join(", ")} maxLength={1200}/></label>
 <label>Answer<textarea name="content" required rows={10} maxLength={30000} defaultValue={editing?.draft_content}/></label>
 <label>Review by<input name="reviewDate" type="date" defaultValue={editing?.review_date||""}/></label>
 <div className="cc-inline-actions"><button className="cc-button primary" disabled={busy}>{busy?"Saving…":"Save draft"}</button>{editing&&<button type="button" className="cc-button" onClick={()=>setEditing(null)}>Cancel editing</button>}</div></form>
 <section className="cc-editor"><h2>Your company answers</h2><label>Search answers<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Title, category or tag"/></label>
 {!result.data?.data.length?<p>No answers yet. Start with your company profile or delivery approach.</p>:result.data.data.every(item=>!`${item.title} ${item.category} ${item.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()))?<p>No answers match your search.</p>:result.data.data.filter(item=>`${item.title} ${item.category} ${item.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())).map(item=>{
  const versions=result.data!.versions.filter(version=>version.answer_id===item.id),approved=versions.find(version=>version.version===item.approved_version);
  return <article className="cc-editor" key={item.id}><h3>{item.title}</h3><p>{item.category} · {approved?`Approved version ${approved.version}`:"Draft — awaiting approval"} · Updated {date(item.updated_at)}</p>
   {approved&&answerNeedsReview(approved.review_date)&&<p className="cc-error">Approved answer is due for review. Confirm it is current before reuse.</p>}
   <details><summary>Current draft</summary><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{item.draft_content}</p></details>
   {approved&&<details><summary>Approved answer</summary><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{approved.content}</p><p>Approved {date(approved.approved_at)} · Review {date(approved.review_date)}</p></details>}
   <div className="cc-inline-actions"><button className="cc-button" disabled={busy} onClick={()=>{setEditing(item);window.scrollTo({top:0,behavior:"smooth"});}}>Edit draft</button>{result.data!.canApprove&&<><button className="cc-button primary" disabled={busy} onClick={()=>void action(item,"approve")}>Approve current draft</button><button className="cc-button" disabled={busy} onClick={()=>void action(item,"archive")}>Archive</button></>}{approved&&<button className="cc-button" onClick={()=>void navigator.clipboard.writeText(approved.content).then(()=>toast("Approved answer copied. Review it for this tender before submitting.")).catch(()=>toast("Copy failed. Select the approved answer text to copy it.","error"))}>Copy approved answer</button>}</div>
   {versions.length>0&&<details><summary>Approval history ({versions.length})</summary>{versions.map(version=><details key={version.id}><summary>Version {version.version} · {date(version.approved_at)}</summary><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{version.content}</p></details>)}</details>}
  </article>;
 })}</section></>}
 </>;
}
