"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole, Check } from "lucide-react";
import { type OpportunityPreview, previewDate } from "../opportunity-browser";

export function OpportunityDetail({slug}:{slug:string}) {
  const [item,setItem] = useState<OpportunityPreview|null>(null);
  const [error,setError] = useState("");
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`/api/opportunities/${encodeURIComponent(slug)}`,{signal:controller.signal}).then(async response=>{
      const body=await response.json() as {data?:OpportunityPreview;error?:string};if(!response.ok||!body.data)throw new Error(body.error||"Opportunity could not be loaded.");setItem(body.data);
    }).catch((caught:unknown)=>{if(!controller.signal.aborted)setError(caught instanceof Error?caught.message:"Please try again.");});
    return ()=>controller.abort();
  },[slug]);
  const next=encodeURIComponent(`/customer/opportunity/${slug}`);
  return <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
    <Link href="/opportunities" className="inline-flex items-center gap-2 font-semibold text-[#547067]"><ArrowLeft size={17}/>All opportunities</Link>
    {error ? <p role="alert" className="mt-6 rounded-2xl bg-amber-50 p-5 text-amber-900">{error}</p> : !item ? <p role="status" className="py-16">Loading opportunity preview…</p> : <>
      <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold uppercase tracking-wider text-[#315b4e]"><span>{item.category}</span><span>{item.status.replaceAll("_"," ")}</span><span className="inline-flex items-center gap-1"><LockKeyhole size={15}/>Guest preview</span></div>
      <h1 className="serif mt-5 max-w-4xl text-3xl leading-tight text-[#17362d] sm:text-5xl">{item.title}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-[#65776f]">{item.teaser}</p>
      <dl className="mt-7 flex flex-wrap gap-x-12 gap-y-5 rounded-2xl bg-white p-6"><div><dt className="text-sm text-[#65776f]">Location</dt><dd className="mt-1 font-semibold">{[item.region,item.country].filter(Boolean).join(", ")||"Not stated"}</dd></div><div><dt className="text-sm text-[#65776f]">Deadline</dt><dd className="mt-1 font-semibold">{previewDate(item.deadline_at)}</dd></div></dl>
      <div className="mt-8 grid overflow-hidden rounded-3xl border border-[#17362d]/10 bg-[#fffdf8] lg:grid-cols-2">
        <div className="p-6 sm:p-9"><LockKeyhole className="text-[#116149]" size={30}/><h2 className="serif mt-4 text-3xl">See the opportunity in context.</h2><p className="mt-4 leading-7 text-[#65776f]">Sign in to review the information available for this tender. We link to the official source and clearly mark details that the source has not provided.</p><ul className="mt-6 space-y-4">{["Buyer and official tender reference","Published scope, requirements and eligibility","Available documents and registration guidance","Official source and application route"].map(label=><li key={label} className="flex items-start gap-3"><Check size={19} className="mt-1 shrink-0 text-[#116149]"/>{label}</li>)}</ul></div>
        <div className="flex flex-col justify-center bg-[#103f32] p-6 text-white sm:p-9"><p className="text-sm font-bold uppercase tracking-widest text-[#8bd7b7]">Your next step</p><h2 className="serif mt-4 text-3xl">Turn discovery into a decision.</h2><p className="mt-4 leading-7 text-white/75">Create your BidScope account to open this opportunity in your workspace. Advanced intelligence and tools depend on your plan.</p><Link href={`/sign-in?mode=sign-up&next=${next}`} className="mt-7 inline-flex items-center justify-center gap-3 rounded-full bg-white px-5 py-4 font-bold text-[#103f32]">Create free account<ArrowRight size={18}/></Link><Link href={`/sign-in?next=${next}`} className="mt-4 text-center font-semibold underline underline-offset-4">Already have an account? Sign in</Link><Link href={`/customer/opportunity/${slug}`} className="mt-4 text-center text-sm text-white/70 underline">Already signed in? Open in workspace</Link></div>
      </div>
    </>}
  </section>;
}
