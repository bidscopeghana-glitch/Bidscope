"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, LockKeyhole, MapPin, Search } from "lucide-react";

export type OpportunityPreview = { slug:string; title:string; teaser:string; country:string|null; region:string|null; category:string; deadline_at:string|null; status:string };
type Result = { data: OpportunityPreview[]; pagination: { total: number | null; page:number; pageSize:number } };
export function previewDate(value:string|null) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-GB", {dateStyle:"medium"}).format(new Date(value)) : "Deadline not stated"; }
const control = "h-12 min-w-0 rounded-xl border border-[#17362d]/15 bg-white px-4 text-base text-[#27493f] focus:border-[#187052]";

export function OpportunityBrowser() {
  const [result,setResult] = useState<Result|null>(null);
  const [query,setQuery] = useState("");
  const [revision,setRevision] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/opportunities?${query}`, {signal:controller.signal}).then(async response => {
      const body = await response.json() as Result & {error?:string};
      if(!response.ok) throw new Error(body.error || "Opportunities could not be loaded.");
      setResult(body);
    }).catch((caught:unknown) => { if(!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Please try again."); })
      .finally(() => {if(!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  },[query,revision]);
  function navigate(next:URLSearchParams) {setLoading(true);setError("");setQuery(next.toString());setRevision(value=>value+1);}
  function search(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const next = new URLSearchParams();
    for(const [key,value] of new FormData(event.currentTarget)) if(String(value).trim()) next.set(key,String(value).trim());
    next.set("page","1");navigate(next);
  }
  function page(delta:number) { const next = new URLSearchParams(query);next.set("page",String((result?.pagination.page||1)+delta));navigate(next); }
  return <>
    <section className="bg-[#103f32] text-white"><div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <p className="text-sm font-bold uppercase tracking-[.16em] text-[#8bd7b7]">Explore the opportunity</p>
      <h1 className="serif mt-4 max-w-4xl text-4xl leading-tight sm:text-6xl">Discover what fits.<br/>Unlock the details.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-white/75">Browse a snapshot of open opportunities. Create an account to review the available tender information, official sources and application routes.</p>
      <div className="mt-6 flex flex-wrap gap-4"><Link href="/sign-in?mode=sign-up" className="rounded-full bg-white px-6 py-3 font-bold text-[#103f32]">Create free account</Link><Link href="/plans" className="rounded-full border border-white/30 px-6 py-3 font-semibold">Compare plans</Link></div>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <form onSubmit={search} className="grid gap-3 rounded-3xl border border-[#17362d]/10 bg-[#fffdf8] p-5 md:grid-cols-4">
        <label className="flex items-center gap-2 rounded-xl border border-[#17362d]/15 bg-white px-4 md:col-span-2"><Search size={18}/><input aria-label="Search opportunities" name="q" placeholder="Search opportunities or sectors" className="h-12 min-w-0 w-full bg-transparent outline-none"/></label>
        <select aria-label="Category" name="category" className={control}><option value="">All categories</option><option value="goods">Goods</option><option value="works">Works</option><option value="services">Services</option><option value="consulting">Consulting</option></select>
        <select aria-label="Coverage" name="scope" className={control}><option value="ghana">Ghana</option><option value="africa">Africa</option><option value="international">International</option></select>
        <button disabled={loading} className="rounded-full bg-[#116149] px-6 py-3 font-bold text-white disabled:opacity-60 md:col-span-4">Search open opportunities</button>
      </form>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><h2 className="serif text-3xl text-[#17362d]">Open opportunities</h2><p className="text-sm text-[#61736a]">{result?.pagination.total ?? 0} results · Limited previews</p></div>
      {error && <p role="alert" className="mt-5 rounded-2xl bg-amber-50 p-5 text-amber-900">{error}</p>}
      <div aria-busy={loading} className="mt-5 grid gap-4">{loading ? <p role="status" className="p-8">Loading opportunities…</p> : result?.data.map(item => <Link href={`/opportunities/${item.slug}`} key={item.slug} className="group rounded-3xl border border-[#17362d]/10 bg-[#fffdf8] p-6 transition hover:border-[#116149]/40 hover:shadow-md">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#315b4e]"><span>{item.category}</span><span className="rounded-full bg-[#e8efe9] px-3 py-1">{item.status.replaceAll("_"," ")}</span><span className="inline-flex items-center gap-1 text-[#6a7a73]"><LockKeyhole size={13}/>Limited preview</span></div>
        <h3 className="mt-4 text-xl font-bold leading-7 text-[#17362d]">{item.title}</h3><p className="mt-2 max-w-3xl leading-7 text-[#667970]">{item.teaser}</p>
        <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-[#61736a]"><span className="flex items-center gap-1"><MapPin size={15}/>{[item.region,item.country].filter(Boolean).join(", ") || "Location not stated"}</span><span className="flex items-center gap-1"><CalendarClock size={15}/>{previewDate(item.deadline_at)}</span><span className="ml-auto flex items-center gap-2 font-bold text-[#116149]">Unlock details<ArrowRight size={17}/></span></div>
      </Link>)}</div>
      {!loading && !error && !result?.data.length && <p className="py-12 text-center text-[#61736a]">No open opportunities match your search. Try another category or keyword.</p>}
      {result && <div className="mt-6 flex justify-between gap-4"><button disabled={loading||result.pagination.page<=1} onClick={()=>page(-1)} className="rounded-full border px-5 py-3 disabled:opacity-40">Previous</button><span className="py-3">Page {result.pagination.page}</span><button disabled={loading||result.data.length<result.pagination.pageSize||(result.pagination.total!==null&&result.pagination.page*result.pagination.pageSize>=result.pagination.total)} onClick={()=>page(1)} className="rounded-full border px-5 py-3 disabled:opacity-40">Next</button></div>}
    </section>
  </>;
}
