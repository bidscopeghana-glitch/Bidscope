"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CalendarClock, Filter, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { SourceBadge } from "@/components/procurement/source-badge";

type Opportunity = { id:string; slug:string; bidscope_reference:string; title:string; summary:string; buyer_name:string; region:string|null; sector:string|null; category:string; procurement_method:string|null; contract_type:string|null; currency:string|null; estimated_value:number|null; deadline_at:string|null; status:string; source_name:string; funding_source:string; external_reference:string|null; data_confidence:string };
type Result = { data: Opportunity[]; pagination: { total: number | null } };
const selectClass = "h-11 min-w-0 rounded-xl border border-[#17362d]/15 bg-white px-3 text-sm text-[#27493f] outline-none focus:border-[#187052]";

async function fetchOpportunityResults(next: URLSearchParams): Promise<Result> {
  const response = await fetch(`/api/opportunities?${next.toString()}`);
  const json = await response.json() as Result & { error?: string };
  if (!response.ok) throw new Error(json.error || "Opportunities could not be loaded.");
  return { ...json, data: json.data.filter((item) => item.status.toUpperCase() === "OPEN") };
}

export function OpportunityBrowser() {
  const [result, setResult] = useState<Result>({ data: [], pagination: { total: null } });
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [params, setParams] = useState(new URLSearchParams());

  async function load(next = params) {
    setLoading(true); setError("");
    try {
      setResult(await fetchOpportunityResults(next));
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Opportunities could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    void fetchOpportunityResults(new URLSearchParams())
      .then(setResult)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Opportunities could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const next = new URLSearchParams();
    for (const [key, value] of form.entries()) if (String(value).trim()) next.set(key, String(value).trim());
    setParams(next); void load(next);
  }

  return <><section className="bg-[#103f32] text-white"><div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8bd7b7]">Unified procurement intelligence</p><h1 className="serif mt-4 max-w-4xl text-4xl font-medium leading-tight tracking-[-.04em] sm:text-6xl">One search. Every connected opportunity.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">Discover Ghana public-sector and development-funded opportunities, with their source, status and official route made clear.</p></div></section>
  <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><form onSubmit={submit} className="rounded-[24px] border border-[#17362d]/10 bg-[#fffdf8] p-4 shadow-[0_16px_50px_rgba(22,54,44,.07)] sm:p-6"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#49675c]"><SlidersHorizontal size={16}/>Search open opportunities</div><div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr]"><label className="flex h-12 items-center gap-3 rounded-xl border border-[#17362d]/15 bg-white px-4"><Search size={17} className="text-[#6f827a]"/><input name="q" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Title, buyer, category, reference…"/></label><select name="source" className={selectClass} defaultValue=""><option value="">All sources</option><option>GHANEPS</option><option>MRH e-Bids</option><option>Bank of Ghana</option><option>UNGM</option><option>African Development Bank</option><option>World Bank</option></select><select name="fundingSource" className={selectClass} defaultValue=""><option value="">All funding</option><option>Government of Ghana</option><option>World Bank</option><option>African Development Bank</option><option>United Nations</option><option>Development Partner</option><option>Internally Funded</option></select></div><details className="mt-3 rounded-xl border border-[#17362d]/10 bg-[#f7f4eb]"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold"><span className="inline-flex items-center gap-2"><Filter size={15}/>More filters</span></summary><div className="grid gap-3 border-t border-[#17362d]/10 p-4 sm:grid-cols-2 lg:grid-cols-4"><input name="buyer" className={selectClass} placeholder="Buyer"/><input name="sector" className={selectClass} placeholder="Sector"/><input name="region" className={selectClass} placeholder="Region"/><select name="category" className={selectClass} defaultValue=""><option value="">All categories</option><option value="goods">Goods</option><option value="works">Works</option><option value="services">Services</option><option value="consulting">Consulting</option></select><input name="contractType" className={selectClass} placeholder="Contract type"/><input name="procurementMethod" className={selectClass} placeholder="Procurement method"/><input name="eligibility" className={selectClass} placeholder="Eligibility country"/><input name="deadlineBefore" type="date" className={selectClass}/><input name="minimumValue" type="number" min="0" className={selectClass} placeholder="Minimum value"/><input name="maximumValue" type="number" min="0" className={selectClass} placeholder="Maximum value"/></div></details><button className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-[#116149] px-6 text-sm font-bold text-white hover:-translate-y-0.5 hover:bg-[#0d523e]">Find open opportunities</button></form>
  <div className="mt-8 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#64776f]">Results</p><h2 className="serif mt-1 text-3xl text-[#17362d]">Opportunities worth reviewing</h2></div><span className="text-xs text-[#6a7a73]">{result.pagination.total ?? result.data.length} found</span></div>
  {error && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{error} The source registry may still need its database migration.</div>}
  <div className="mt-5 grid gap-4">{loading ? [1,2,3].map((item) => <div key={item} className="h-44 animate-pulse rounded-[22px] bg-white"/>) : result.data.map((item) => <a href={`/opportunities/${item.slug}`} key={item.id} className="group rounded-[22px] border border-[#17362d]/10 bg-[#fffdf8] p-5 shadow-sm hover:-translate-y-0.5 hover:border-[#116149]/25 hover:shadow-lg sm:p-6"><div className="flex flex-wrap items-center gap-2"><SourceBadge source={item.source_name}/><span className="rounded-full bg-[#e8efe9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#315b4e]">{item.status}</span><span className="text-[10px] font-semibold uppercase tracking-wider text-[#7a8982]">{item.funding_source}</span></div><div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]"><div><h3 className="text-lg font-bold leading-6 text-[#17362d] sm:text-xl">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#667970]">{item.summary || "Open the record for verified details and the official source."}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#61736a]"><span className="font-semibold">{item.buyer_name || "Buyer not yet normalised"}</span>{item.region && <span className="inline-flex items-center gap-1"><MapPin size={13}/>{item.region}</span>}{item.deadline_at && <span className="inline-flex items-center gap-1"><CalendarClock size={13}/>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(item.deadline_at))}</span>}</div></div><span className="inline-flex items-center self-end text-sm font-bold text-[#116149]">Review <ArrowRight className="ml-2 transition group-hover:translate-x-1" size={16}/></span></div></a>)}{!loading && !result.data.length && !error && <div className="rounded-[22px] border border-dashed border-[#17362d]/20 p-12 text-center text-sm text-[#667970]">No verified opportunities match these filters yet.</div>}</div></section></>;
}
