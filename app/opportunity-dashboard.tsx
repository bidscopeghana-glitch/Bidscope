"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, Building2, CalendarDays, Check, ChevronRight, CircleCheck, Clock3, FileSearch, Landmark, MapPin, Search, ShieldCheck, Sparkles, Target } from "lucide-react";

type Opportunity = { id: number; title: string; buyer: string; category: string; region: string; deadline: string; days: number; fit: number; type: string };

const opportunities: Opportunity[] = [
  { id: 1, title: "Supply of office equipment and consumables", buyer: "Illustrative public institution", category: "Goods", region: "Greater Accra", deadline: "18 Oct 2026", days: 36, fit: 94, type: "National Competitive Tender" },
  { id: 2, title: "Routine maintenance of feeder roads", buyer: "Illustrative district assembly", category: "Works", region: "Ashanti", deadline: "11 Oct 2026", days: 29, fit: 88, type: "Request for Tenders" },
  { id: 3, title: "Digital records consultancy services", buyer: "Illustrative government agency", category: "Services", region: "Greater Accra", deadline: "3 Oct 2026", days: 21, fit: 81, type: "Expression of Interest" },
  { id: 4, title: "Supply and installation of solar streetlights", buyer: "Illustrative municipal assembly", category: "Works", region: "Northern", deadline: "28 Sep 2026", days: 16, fit: 76, type: "National Competitive Tender" },
];
const sectors = ["All sectors", "Goods", "Works", "Services"];

declare global { interface Document { modelContext?: { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> } } }

export function OpportunityDashboard() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All sectors");
  const [formOpen, setFormOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return opportunities.filter((item) => (sector === "All sectors" || item.category === sector) && (!needle || `${item.title} ${item.buyer} ${item.region}`.toLowerCase().includes(needle)));
  }, [query, sector]);

  async function submitFoundingMember(payload: Record<string, string>) {
    const response = await fetch("/api/founding-members", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = (await response.json()) as { message?: string; error?: string };
    if (!response.ok) throw new Error(result.error || "We could not save your registration.");
    return result;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending"); setMessage("");
    const formElement = event.currentTarget;
    const payload = Object.fromEntries(new FormData(formElement).entries()) as Record<string, string>;
    try { const result = await submitFoundingMember(payload); setStatus("success"); setMessage(result.message || "You are on the founding-member list."); formElement.reset(); }
    catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Please try again."); }
  }

  useEffect(() => {
    const context = document.modelContext; if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try { void Promise.resolve(context.registerTool({
      name: "register_founding_business", title: "Register founding business",
      description: "Register a Ghanaian business for the BidScope Ghana three-month founding-member trial.",
      inputSchema: { type: "object", properties: { businessName: { type: "string" }, contactName: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, sector: { type: "string" }, consent: { type: "boolean" } }, required: ["businessName", "contactName", "email", "sector", "consent"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input: unknown) => submitFoundingMember(input as Record<string, string>),
    }, { signal: lifecycle.signal })).catch(() => undefined); } catch { /* optional capability */ }
    return () => lifecycle.abort();
  }, []);

  return <main className="min-h-screen bg-[#f5f2e9] text-[#132b24]">
    <nav className="sticky top-0 z-40 border-b border-[#173e33]/10 bg-[#f5f2e9]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="BidScope Ghana home"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0c6b4f] text-white shadow-[0_6px_20px_rgba(12,107,79,.22)]"><Target size={21} /></span><span><strong className="block font-[var(--font-display)] text-xl leading-none">BidScope</strong><span className="text-[10px] font-bold uppercase tracking-[.24em] text-[#d08924]">Ghana</span></span></a>
        <div className="hidden items-center gap-8 text-sm font-semibold md:flex"><a href="#opportunities" className="hover:text-[#0c6b4f]">Opportunities</a><a href="#how" className="hover:text-[#0c6b4f]">How it works</a><a href="#trust" className="hover:text-[#0c6b4f]">Our standards</a></div>
        <button onClick={() => setFormOpen(true)} className="rounded-xl bg-[#173e33] px-4 py-2.5 text-sm font-bold text-white hover:-translate-y-0.5 hover:bg-[#0c6b4f]">Get 3 months free</button>
      </div>
    </nav>

    <section id="top" className="relative overflow-hidden border-b border-[#173e33]/10"><div className="grain absolute inset-0 opacity-30" />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-14 pt-14 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:pb-20 lg:pt-20">
        <div className="relative z-10 flex flex-col justify-center">
          <div className="mb-6 flex w-fit items-center gap-2 rounded-full border border-[#d08924]/30 bg-[#fffaf0] px-3 py-1.5 text-xs font-bold text-[#8c5b16]"><Sparkles size={14} /> Founding-business access is open</div>
          <h1 className="max-w-xl font-[var(--font-display)] text-5xl font-semibold leading-[.98] tracking-[-.045em] sm:text-6xl">Find the right public opportunities <em className="font-normal text-[#0c6b4f]">before time runs out.</em></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#48635b]">BidScope Ghana turns scattered public procurement notices into a focused daily shortlist—matched to your sector, region and business profile.</p>
          <div className="mt-8 flex flex-wrap gap-3"><button onClick={() => setFormOpen(true)} className="group flex items-center gap-2 rounded-xl bg-[#0c6b4f] px-5 py-3.5 font-bold text-white shadow-[0_10px_30px_rgba(12,107,79,.22)] hover:-translate-y-0.5">Claim your free 3 months <ArrowRight className="group-hover:translate-x-1" size={18} /></button><a href="#opportunities" className="flex items-center gap-2 rounded-xl border border-[#173e33]/20 bg-white/60 px-5 py-3.5 font-bold">Explore the demo <ChevronRight size={18} /></a></div>
          <p className="mt-4 flex items-center gap-2 text-xs text-[#60776f]"><ShieldCheck size={15} /> No card required. No commission on contracts.</p>
        </div>
        <div className="relative z-10 lg:pl-6"><div className="rounded-[28px] border border-[#173e33]/10 bg-[#fffdf8] p-3 shadow-[0_30px_80px_rgba(23,62,51,.16)] sm:p-5">
          <div className="flex items-center justify-between border-b border-[#173e33]/10 px-2 pb-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#d08924]">Today&apos;s watchlist</p><p className="mt-1 font-[var(--font-display)] text-2xl font-semibold">Matched opportunities</p></div><span className="rounded-full bg-[#e3f2e9] px-3 py-1.5 text-xs font-bold text-[#0c6b4f]">4 new</span></div>
          <div className="grid gap-3 pt-4">{opportunities.slice(0, 3).map((item, index) => <article key={item.id} className="rounded-2xl border border-[#173e33]/10 bg-white p-4 hover:border-[#0c6b4f]/30 hover:shadow-md"><div className="flex items-start gap-3"><span className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${index === 0 ? "bg-[#0c6b4f] text-white" : "bg-[#edf0e8] text-[#173e33]"}`}>{index === 1 ? <Building2 size={17} /> : index === 2 ? <FileSearch size={17} /> : <Landmark size={17} />}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h2 className="font-bold leading-5">{item.title}</h2><span className="shrink-0 text-xs font-black text-[#0c6b4f]">{item.fit}% fit</span></div><p className="mt-1 truncate text-xs text-[#60776f]">{item.buyer}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#48635b]"><span className="flex items-center gap-1"><MapPin size={13} />{item.region}</span><span className="flex items-center gap-1"><Clock3 size={13} />{item.days} days</span></div></div></div></article>)}</div>
          <p className="px-2 pt-4 text-[11px] text-[#71837d]">Illustrative data for product demonstration—not live procurement notices.</p>
        </div></div>
      </div>
    </section>

    <section id="opportunities" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="eyebrow">Opportunity finder</p><h2 className="mt-2 font-[var(--font-display)] text-4xl font-semibold tracking-tight">A calmer way to scan the market</h2></div><p className="max-w-md text-sm leading-6 text-[#60776f]">This interactive demo shows how members will search, filter and assess public notices.</p></div>
      <div className="overflow-hidden rounded-[28px] border border-[#173e33]/10 bg-[#fffdf8] shadow-[0_20px_60px_rgba(23,62,51,.09)]">
        <div className="grid gap-3 border-b border-[#173e33]/10 bg-white/70 p-4 md:grid-cols-[1fr_220px]"><label className="flex items-center gap-3 rounded-xl border border-[#173e33]/15 bg-white px-4 py-3"><Search size={18} className="text-[#71837d]" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search opportunity, buyer or region" /></label><select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-xl border border-[#173e33]/15 bg-white px-4 py-3 text-sm font-semibold outline-none">{sectors.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="divide-y divide-[#173e33]/10">{filtered.map((item) => <article key={item.id} className="grid gap-5 p-5 hover:bg-[#f8f6ef] md:grid-cols-[1fr_auto] md:items-center lg:p-6"><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-md bg-[#e3f2e9] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#0c6b4f]">{item.category}</span><span className="text-xs font-semibold text-[#71837d]">{item.type}</span></div><h3 className="font-[var(--font-display)] text-xl font-semibold">{item.title}</h3><p className="mt-1 text-sm text-[#60776f]">{item.buyer}</p><div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-[#48635b]"><span className="flex items-center gap-1.5"><MapPin size={14} /> {item.region}</span><span className="flex items-center gap-1.5"><CalendarDays size={14} /> Closes {item.deadline}</span></div></div><div className="flex items-center justify-between gap-5 md:block md:text-right"><div><strong className="text-2xl text-[#0c6b4f]">{item.fit}%</strong><span className="block text-[10px] font-bold uppercase tracking-wider text-[#71837d]">profile fit</span></div><a href="https://www.ghaneps.gov.gh/" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#173e33]">Check official portal <ArrowRight size={15} /></a></div></article>)}
          {filtered.length === 0 && <div className="p-12 text-center"><FileSearch className="mx-auto text-[#8aa098]" /><p className="mt-3 font-bold">No demo opportunities match that search.</p><button onClick={() => { setQuery(""); setSector("All sectors"); }} className="mt-2 text-sm font-bold text-[#0c6b4f]">Clear filters</button></div>}
        </div>
      </div>
    </section>

    <section id="how" className="bg-[#173e33] text-[#f8f3e7]"><div className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><p className="eyebrow text-[#e4ae5f]">Built for small teams</p><div className="mt-3 grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><h2 className="font-[var(--font-display)] text-4xl font-semibold leading-tight">From notice to decision in three simple moves.</h2><div className="grid gap-4 sm:grid-cols-3">{[[BellRing,"One daily shortlist","Relevant notices reach you without hours of portal checking."],[Target,"Fit before effort","See why an opportunity matches your sector, region and profile."],[CircleCheck,"Verify and apply","Open the original notice, confirm every detail, then prepare your bid."]].map(([Icon,title,copy],i) => { const C = Icon as typeof BellRing; return <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/[.05] p-5"><span className="text-xs font-black text-[#e4ae5f]">0{i+1}</span><C className="mt-8" /><h3 className="mt-4 font-bold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[#bdd0c8]">{String(copy)}</p></div> })}</div></div></div></section>

    <section id="trust" className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-2 lg:px-8"><div><p className="eyebrow">Trust by design</p><h2 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">We help you find information. Government buyers award contracts.</h2><p className="mt-5 max-w-xl leading-7 text-[#60776f]">BidScope Ghana is planned as an independent information and workflow service. We do not sell contracts, influence awards, or guarantee that a subscriber will win.</p></div><div className="grid gap-3">{["Every listing links to its original public source.","Corrections and expired notices are clearly marked.","No success fees and no payment to access an award.","Subscriber data is used to deliver the requested service."].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-[#173e33]/10 bg-white/60 p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e3f2e9] text-[#0c6b4f]"><Check size={16} /></span><span className="font-semibold">{item}</span></div>)}</div></section>

    <section className="px-5 pb-20 lg:px-8"><div className="mx-auto max-w-7xl overflow-hidden rounded-[30px] bg-[#d08924] p-8 text-[#20170b] sm:p-12"><div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[.18em]">Founding-business programme</p><h2 className="mt-3 max-w-3xl font-[var(--font-display)] text-4xl font-semibold leading-tight sm:text-5xl">Use every core feature free for your first three months.</h2><p className="mt-4 max-w-2xl text-[#4e3614]">Help shape the product with feedback. We will tell you the paid price before the trial ends, and you can leave without charge.</p></div><button onClick={() => setFormOpen(true)} className="flex items-center justify-center gap-2 rounded-xl bg-[#173e33] px-6 py-4 font-bold text-white">Register your business <ArrowRight size={18} /></button></div></div></section>
    <footer className="border-t border-[#173e33]/10 px-5 py-10 text-sm text-[#60776f] lg:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 md:flex-row"><p><strong className="text-[#173e33]">BidScope Ghana</strong> — working brand, pending clearance.</p><p>Independent service · Not affiliated with Ghana&apos;s Public Procurement Authority or GHANEPS</p></div></footer>

    {formOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-[#10231d]/70 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setFormOpen(false) }}><div role="dialog" aria-modal="true" aria-labelledby="trial-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[26px] bg-[#fffdf8] p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Founding-business access</p><h2 id="trial-title" className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Claim three months free</h2><p className="mt-2 text-sm leading-6 text-[#60776f]">No card. We will contact you before launch to confirm your business profile.</p></div><button onClick={() => setFormOpen(false)} className="rounded-full border border-[#173e33]/15 px-3 py-1 text-xl" aria-label="Close">×</button></div>
      {status === "success" ? <div className="mt-7 rounded-2xl bg-[#e3f2e9] p-6 text-center"><CircleCheck className="mx-auto text-[#0c6b4f]" size={36} /><h3 className="mt-3 text-xl font-bold">Registration received</h3><p className="mt-2 text-sm text-[#48635b]">{message}</p><button onClick={() => { setFormOpen(false); setStatus("idle") }} className="mt-5 rounded-xl bg-[#173e33] px-5 py-3 font-bold text-white">Done</button></div> : <form onSubmit={handleSubmit} className="mt-7 grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Business name" name="businessName" required /><Field label="Your name" name="contactName" required /></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Work email" name="email" type="email" required /><Field label="Phone / WhatsApp" name="phone" type="tel" /></div><label className="grid gap-1.5 text-sm font-bold">Main sector<select name="sector" required className="rounded-xl border border-[#173e33]/15 bg-white px-4 py-3 font-normal outline-none focus:border-[#0c6b4f]"><option value="">Select a sector</option><option>Goods and supplies</option><option>Construction and works</option><option>Professional services</option><option>ICT and technology</option><option>Healthcare</option><option>Other</option></select></label><label className="flex items-start gap-3 text-xs leading-5 text-[#60776f]"><input type="checkbox" name="consent" value="yes" required className="mt-1" /> I agree to be contacted about the founding-member trial and understand this does not guarantee any government contract.</label>{status === "error" && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}<button disabled={status === "sending"} className="mt-2 rounded-xl bg-[#0c6b4f] px-5 py-3.5 font-bold text-white disabled:opacity-60">{status === "sending" ? "Saving your place…" : "Join the founding programme"}</button></form>}
    </div></div>}
  </main>;
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return <label className="grid gap-1.5 text-sm font-bold">{label}<input name={name} type={type} required={required} className="rounded-xl border border-[#173e33]/15 bg-white px-4 py-3 font-normal outline-none focus:border-[#0c6b4f]" /></label>;
}
