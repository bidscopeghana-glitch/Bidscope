"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BarChart3, Bell, Bookmark, BriefcaseBusiness, Building2, CalendarClock,
  ChartNoAxesCombined, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, FileCheck2,
  FileSearch2, Filter, Gavel, LayoutDashboard, LockKeyhole, Menu, MoreHorizontal, Search,
  Settings, ShieldCheck, Sparkles, Target, TrendingUp, Users, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Opportunity = {
  id: string; title: string; buyer: string; category: "Goods" | "Works" | "Services";
  region: string; deadline: string; days: number; fit: number; procedure: string; published: string;
};

const opportunities: Opportunity[] = [
  { id: "GH-2026-01942", title: "Supply of office equipment and consumables", buyer: "Illustrative public institution", category: "Goods", region: "Greater Accra", deadline: "18 Oct 2026", days: 36, fit: 94, procedure: "NCT", published: "10 Sep" },
  { id: "GH-2026-01887", title: "Routine maintenance of feeder roads", buyer: "Illustrative district assembly", category: "Works", region: "Ashanti", deadline: "11 Oct 2026", days: 29, fit: 88, procedure: "RFT", published: "09 Sep" },
  { id: "GH-2026-01830", title: "Digital records consultancy services", buyer: "Illustrative government agency", category: "Services", region: "Greater Accra", deadline: "03 Oct 2026", days: 21, fit: 81, procedure: "EOI", published: "08 Sep" },
  { id: "GH-2026-01799", title: "Supply and installation of solar streetlights", buyer: "Illustrative municipal assembly", category: "Works", region: "Northern", deadline: "28 Sep 2026", days: 16, fit: 76, procedure: "NCT", published: "07 Sep" },
  { id: "GH-2026-01754", title: "Framework agreement for vehicle servicing", buyer: "Illustrative public authority", category: "Services", region: "Western", deadline: "25 Sep 2026", days: 13, fit: 71, procedure: "RFP", published: "06 Sep" },
];

const navItems = [
  [LayoutDashboard, "Overview"], [FileSearch2, "Opportunities", "24"], [Bookmark, "Saved searches"],
  [Building2, "Buyer intelligence"], [Gavel, "Awards tracker"],
] as const;

declare global { interface Document { modelContext?: { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> } } }

export function OpportunityDashboard() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All categories");
  const [trialOpen, setTrialOpen] = useState(false);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return opportunities.filter((item) => (sector === "All categories" || item.category === sector) && (!needle || `${item.title} ${item.buyer} ${item.region} ${item.id}`.toLowerCase().includes(needle)));
  }, [query, sector]);

  async function submitFoundingMember(payload: Record<string, unknown>) {
    const response = await fetch("/api/founding-members", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = (await response.json()) as { message?: string; error?: string };
    if (!response.ok) throw new Error(result.error || "We could not save your registration.");
    return result;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending"); setMessage("");
    const formElement = event.currentTarget;
    const payload = Object.fromEntries(new FormData(formElement).entries());
    try { const result = await submitFoundingMember(payload); setStatus("success"); setMessage(result.message || "Registration received."); formElement.reset(); }
    catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Please try again."); }
  }

  useEffect(() => {
    const context = document.modelContext; if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try { void Promise.resolve(context.registerTool({
      name: "register_founding_business", title: "Register founding business",
      description: "Register a Ghanaian business for the BidScope Ghana three-month founding-member trial.",
      inputSchema: { type: "object", properties: { businessName: { type: "string" }, contactName: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, sector: { type: "string" }, consent: { type: "boolean" } }, required: ["businessName", "contactName", "email", "sector", "consent"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input: unknown) => submitFoundingMember(input as Record<string, unknown>),
    }, { signal: lifecycle.signal })).catch(() => undefined); } catch { /* optional capability */ }
    return () => lifecycle.abort();
  }, []);

  return <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_1fr]">
    <aside className="fine-grid fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-white/[.07] bg-[#0b1712] text-white lg:flex">
      <Brand />
      <div className="px-3 pt-7">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">Workspace</p>
        <nav className="mt-3 space-y-1">{navItems.map(([Icon, label, count], index) => <button key={label} className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm ${index === 0 ? "bg-white/[.10] font-semibold text-white shadow-inner" : "text-white/58 hover:bg-white/[.06] hover:text-white"}`}><Icon className={index === 0 ? "text-[#46bb8d]" : ""} size={17} /><span>{label}</span>{count && <span className="ml-auto rounded-full bg-[#204e3c] px-2 py-0.5 font-mono text-[10px] text-[#71d3ad]">{count}</span>}</button>)}</nav>
      </div>
      <div className="mt-7 px-3"><p className="px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">Manage</p><nav className="mt-3 space-y-1"><SideLink icon={Users} label="Team" /><SideLink icon={Settings} label="Settings" /><SideLink icon={CircleHelp} label="Help centre" /></nav></div>
      <div className="mt-auto p-3">
        <div className="rounded-xl border border-[#d3a33f]/20 bg-[#d3a33f]/[.08] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-[#e1be70]"><Sparkles size={14} /> Founding access</div><p className="mt-2 text-xs leading-5 text-white/50">Three months of core intelligence at no cost.</p><Button onClick={() => setTrialOpen(true)} size="sm" className="mt-4 w-full bg-[#d5a33f] text-[#172119] hover:bg-[#e4b657]">Activate trial</Button></div>
        <div className="mt-3 flex items-center gap-3 rounded-xl px-2 py-3"><span className="grid size-9 place-items-center rounded-full bg-[#1e3d31] text-xs font-bold text-[#76d7b1]">BA</span><div className="min-w-0"><p className="truncate text-sm font-semibold">Founding workspace</p><p className="truncate text-xs text-white/35">Ghana market</p></div><MoreHorizontal className="ml-auto text-white/35" size={17} /></div>
      </div>
    </aside>

    {mobileNav && <div className="fixed inset-0 z-50 bg-[#0b1712] p-5 text-white lg:hidden"><div className="flex items-center justify-between"><Brand compact /><Button variant="ghost" size="icon" onClick={() => setMobileNav(false)} className="text-white"><X /></Button></div><nav className="mt-10 space-y-2">{navItems.map(([Icon, label, count], index) => <button key={label} className={`flex h-12 w-full items-center gap-3 rounded-lg px-4 text-sm ${index === 0 ? "bg-white/10 font-semibold" : "text-white/60"}`}><Icon size={18} />{label}{count && <span className="ml-auto">{count}</span>}</button>)}</nav></div>}

    <section className="min-w-0 lg:col-start-2">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-white/95 px-4 backdrop-blur md:px-7">
        <Button variant="ghost" size="icon" onClick={() => setMobileNav(true)} className="lg:hidden"><Menu /></Button><span className="text-sm font-semibold tracking-[-.02em] sm:hidden">BidScope <span className="font-mono text-[8px] uppercase tracking-wider text-[#b1812e]">GH</span></span>
        <div className="relative hidden w-full max-w-md sm:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search opportunities, buyers or reference…" className="h-9 bg-[#f7f8f6] pl-9 shadow-none" /><kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border bg-white px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">⌘ K</kbd></div>
        <div className="ml-auto flex items-center gap-2"><Badge variant="outline" className="hidden h-8 gap-1.5 rounded-md border-[#cfd8d3] px-3 text-xs text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-emerald-500" /> Sources monitored</Badge><Button variant="outline" size="icon" className="relative"><Bell /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-amber-500 ring-2 ring-white" /></Button><Button onClick={() => setTrialOpen(true)} className="bg-[#0f6b50] shadow-sm hover:bg-[#0b5942]">Start free trial <ArrowRight /></Button></div>
      </header>

      <main className="mx-auto max-w-[1540px] p-4 md:p-7">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-[-.025em] md:text-[28px]">Procurement overview</h1><Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Demo workspace</Badge></div><p className="mt-1.5 text-sm text-muted-foreground">Good morning. Here is what changed across your Ghana watchlist.</p></div><div className="flex items-center gap-2"><Button variant="outline"><CalendarClock /> Last 30 days <ChevronDown /></Button><Button variant="outline"><FileCheck2 /> Export brief</Button></div></div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={FileSearch2} label="Matched opportunities" value="24" delta="+6 this week" chart={[18,21,19,25,26,31,34]} />
          <Metric icon={Clock3} label="Closing in 14 days" value="7" delta="2 high-fit" tone="amber" chart={[31,29,28,24,22,18,16]} />
          <Metric icon={Bookmark} label="Saved for review" value="11" delta="46% reviewed" chart={[8,10,9,12,14,13,16]} />
          <Metric icon={Building2} label="Active buyers" value="38" delta="+12% vs last month" chart={[17,18,21,20,24,27,30]} />
        </div>

        <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="gap-0 overflow-hidden py-0 shadow-[0_1px_2px_rgba(18,40,30,.04)]">
            <CardHeader className="gap-0 border-b px-5 py-4 sm:grid-cols-[1fr_auto]"><div><CardTitle className="text-[15px]">Priority opportunities</CardTitle><p className="mt-1 text-xs text-muted-foreground">Ranked against your saved business profile</p></div><div className="mt-3 flex gap-2 sm:mt-0"><NativeSelect value={sector} onChange={(event) => setSector(event.target.value)} className="w-[148px]"><NativeSelectOption>All categories</NativeSelectOption><NativeSelectOption>Goods</NativeSelectOption><NativeSelectOption>Works</NativeSelectOption><NativeSelectOption>Services</NativeSelectOption></NativeSelect><Button variant="outline" size="icon"><Filter /></Button></div></CardHeader>
            <CardContent className="p-0"><Table><TableHeader><TableRow className="bg-[#f8faf8] hover:bg-[#f8faf8]"><TableHead className="w-[44%] pl-5 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Opportunity</TableHead><TableHead className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Category</TableHead><TableHead className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Deadline</TableHead><TableHead className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Fit</TableHead><TableHead className="pr-5" /></TableRow></TableHeader><TableBody>
              {filtered.map((item) => <TableRow key={item.id} className="group cursor-pointer" onClick={() => setSelected(item)}><TableCell className="max-w-[380px] py-4 pl-5"><div className="truncate font-medium text-[#17221d]">{item.title}</div><div className="mt-1 flex items-center gap-2 truncate text-xs text-muted-foreground"><span className="font-mono text-[10px]">{item.id}</span><span>·</span><span className="truncate">{item.buyer}</span></div></TableCell><TableCell><CategoryBadge category={item.category} /><div className="mt-1 font-mono text-[10px] text-muted-foreground">{item.procedure}</div></TableCell><TableCell><div className="text-sm font-medium">{item.deadline}</div><div className={`mt-1 text-xs ${item.days <= 14 ? "text-red-600" : item.days <= 21 ? "text-amber-600" : "text-muted-foreground"}`}>{item.days} days left</div></TableCell><TableCell><div className="flex items-center gap-2"><span className="font-mono text-sm font-semibold text-[#0f6b50]">{item.fit}%</span><span className="h-1.5 w-12 overflow-hidden rounded-full bg-[#e4eae6]"><span className="block h-full rounded-full bg-[#2b9b77]" style={{ width: `${item.fit}%` }} /></span></div></TableCell><TableCell className="pr-5 text-right"><Button variant="ghost" size="icon-sm" aria-label={`Open ${item.title}`}><ChevronRight /></Button></TableCell></TableRow>)}
            </TableBody></Table></CardContent><div className="flex items-center justify-between border-t bg-[#fbfcfb] px-5 py-3"><p className="text-[11px] text-muted-foreground">Illustrative records only · Always verify at the official source</p><Button variant="ghost" size="sm" className="text-[#0f6b50]">View all 24 <ArrowRight /></Button></div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
            <Card className="gap-0 py-0"><CardHeader className="border-b px-5 py-4"><div className="flex items-center justify-between"><CardTitle className="text-[15px]">Upcoming deadlines</CardTitle><Button variant="ghost" size="icon-sm"><MoreHorizontal /></Button></div></CardHeader><CardContent className="p-5"><div className="space-y-5">{opportunities.slice(2,5).map((item, index) => <div key={item.id} className="relative flex gap-3 before:absolute before:left-[15px] before:top-9 before:h-[calc(100%+4px)] before:w-px before:bg-border last:before:hidden"><span className={`z-10 grid size-8 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-semibold ${index === 2 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>{item.days}d</span><div className="min-w-0 pb-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.region} · {item.deadline}</p></div></div>)}</div></CardContent></Card>
            <Card className="data-grid relative gap-0 overflow-hidden border-[#164c3a] bg-[#103326] py-0 text-white"><div className="absolute -right-10 -top-10 size-36 rounded-full bg-[#45a681]/10 blur-2xl" /><CardContent className="relative p-5"><div className="flex items-center justify-between"><Badge className="border border-[#d9ad56]/25 bg-[#d9ad56]/10 text-[#edc977] hover:bg-[#d9ad56]/10"><Sparkles /> Founding programme</Badge><ShieldCheck className="text-[#67c9a3]" size={20} /></div><p className="mt-6 text-xl font-semibold leading-snug">Unlock the full Ghana intelligence workspace.</p><p className="mt-2 text-sm leading-6 text-white/55">Three months free. No card and no automatic paid renewal.</p><Button onClick={() => setTrialOpen(true)} className="mt-5 w-full bg-white text-[#103326] hover:bg-[#eef4f1]">Activate free access <ArrowRight /></Button></CardContent></Card>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <Card className="gap-0 py-0"><CardHeader className="border-b px-5 py-4"><div className="flex items-center justify-between"><div><CardTitle className="text-[15px]">Opportunity flow</CardTitle><p className="mt-1 text-xs text-muted-foreground">New matched notices across the last 8 weeks</p></div><Badge variant="outline" className="font-mono">84 total</Badge></div></CardHeader><CardContent className="p-5"><div className="flex h-48 items-end gap-2 border-b border-l px-3 pb-3">{[38,52,47,68,55,74,64,86,59,91,72,100].map((height,index) => <div key={index} className="group relative flex-1"><span className="block rounded-t-sm bg-[#b8d9cc] transition group-hover:bg-[#2b9b77]" style={{ height: `${height * 1.42}px` }} /><span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-[#10251d] px-1.5 py-1 font-mono text-[9px] text-white group-hover:block">{Math.round(height/6)}</span></div>)}</div><div className="mt-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-wide text-muted-foreground"><span>23 Jun</span><span>21 Jul</span><span>18 Aug</span><span>12 Sep</span></div></CardContent></Card>
          <Card className="gap-0 py-0"><CardHeader className="border-b px-5 py-4"><div className="flex items-center justify-between"><div><CardTitle className="text-[15px]">Buyer activity</CardTitle><p className="mt-1 text-xs text-muted-foreground">Most active in your categories</p></div><ChartNoAxesCombined className="text-muted-foreground" size={18} /></div></CardHeader><CardContent className="p-0">{[["Illustrative ministry","12 notices","+18%"],["Illustrative roads agency","9 notices","+7%"],["Illustrative assembly","7 notices","+4%"]].map(([name,count,change],index) => <div key={name} className="flex items-center gap-3 border-b px-5 py-3.5 last:border-0"><span className="grid size-9 place-items-center rounded-lg border bg-[#f6f8f6] text-xs font-semibold text-muted-foreground">{index+1}</span><div><p className="text-sm font-medium">{name}</p><p className="text-xs text-muted-foreground">{count}</p></div><span className="ml-auto flex items-center gap-1 font-mono text-xs font-medium text-[#0f7a59]"><TrendingUp size={12} />{change}</span></div>)}</CardContent></Card>
        </div>

        <div className="mt-5 flex flex-col items-start justify-between gap-2 border-t pt-4 text-[11px] text-muted-foreground sm:flex-row"><p>BidScope Ghana is an independent information service and is not affiliated with PPA or GHANEPS.</p><p className="flex items-center gap-1.5"><LockKeyhole size={12} /> Working brand pending clearance</p></div>
      </main>
    </section>

    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-2xl gap-0 overflow-hidden p-0"><DialogHeader className="border-b bg-[#f8faf8] p-6 pr-12"><div className="mb-2 flex items-center gap-2">{selected && <CategoryBadge category={selected.category} />}<Badge variant="outline" className="font-mono text-[10px]">{selected?.id}</Badge></div><DialogTitle className="text-xl leading-7">{selected?.title}</DialogTitle><DialogDescription>{selected?.buyer}</DialogDescription></DialogHeader>{selected && <div className="p-6"><div className="grid grid-cols-2 gap-5 rounded-lg border bg-[#fbfcfb] p-4 sm:grid-cols-4"><Detail label="Region" value={selected.region} /><Detail label="Procedure" value={selected.procedure} /><Detail label="Deadline" value={selected.deadline} /><Detail label="Profile fit" value={`${selected.fit}%`} /></div><div className="mt-6"><h3 className="text-sm font-semibold">Why this matched</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{["Sector matches your profile","Region is within your coverage","Procedure is in your saved preferences","Deadline allows preparation time"].map((item) => <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground"><span className="grid size-5 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check size={12} /></span>{item}</div>)}</div></div><div className="mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-between"><Button variant="outline"><Bookmark /> Save for review</Button><Button asChild><a href="https://www.ghaneps.gov.gh/" target="_blank" rel="noreferrer">Verify on official portal <ArrowRight /></a></Button></div></div>}</DialogContent></Dialog>

    <Dialog open={trialOpen} onOpenChange={(open) => { setTrialOpen(open); if (!open) setStatus("idle") }}><DialogContent className="max-w-xl"><DialogHeader><Badge className="mb-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Founding-business access</Badge><DialogTitle className="text-2xl">Activate three months free</DialogTitle><DialogDescription>No card. We will confirm your business profile before launch.</DialogDescription></DialogHeader>
      {status === "success" ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center"><span className="mx-auto grid size-11 place-items-center rounded-full bg-emerald-600 text-white"><Check /></span><h3 className="mt-4 font-semibold">Registration received</h3><p className="mt-1 text-sm text-emerald-800">{message}</p><Button onClick={() => setTrialOpen(false)} className="mt-5">Done</Button></div> : <form onSubmit={handleSubmit} className="grid gap-4 pt-2"><div className="grid gap-4 sm:grid-cols-2"><FormField label="Business name" name="businessName" required /><FormField label="Contact name" name="contactName" required /></div><div className="grid gap-4 sm:grid-cols-2"><FormField label="Work email" name="email" type="email" required /><FormField label="Phone / WhatsApp" name="phone" /></div><label className="grid gap-1.5 text-xs font-semibold">Main sector<NativeSelect name="sector" required className="w-full"><NativeSelectOption value="">Select a sector</NativeSelectOption><NativeSelectOption>Goods and supplies</NativeSelectOption><NativeSelectOption>Construction and works</NativeSelectOption><NativeSelectOption>Professional services</NativeSelectOption><NativeSelectOption>ICT and technology</NativeSelectOption><NativeSelectOption>Other</NativeSelectOption></NativeSelect></label><label className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground"><input type="checkbox" name="consent" value="yes" required className="mt-1 accent-[#0f6b50]" />I agree to be contacted about the trial and understand that BidScope does not guarantee government contracts.</label>{status === "error" && <p className="rounded-md bg-red-50 p-3 text-xs font-medium text-red-700">{message}</p>}<Button disabled={status === "sending"} size="lg">{status === "sending" ? "Saving your place…" : "Join the founding programme"}</Button></form>}
    </DialogContent></Dialog>
  </div>;
}

function Brand({ compact = false }: { compact?: boolean }) { return <div className={`flex h-[72px] items-center gap-3 ${compact ? "px-0" : "border-b border-white/[.07] px-5"}`}><span className="relative grid size-9 place-items-center rounded-lg bg-[#23a879] text-white shadow-[0_8px_24px_rgba(35,168,121,.18)]"><Target size={18} /><span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-[#0b1712] bg-[#e6b653]" /></span><span><strong className="block text-[17px] leading-none tracking-[-.02em]">BidScope</strong><span className="mt-1 block font-mono text-[8px] uppercase tracking-[.22em] text-[#e1b45c]">Ghana intelligence</span></span></div> }
function SideLink({ icon: Icon, label }: { icon: typeof Settings; label: string }) { return <button className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/58 hover:bg-white/[.06] hover:text-white"><Icon size={17} />{label}</button> }
function Metric({ icon: Icon, label, value, delta, chart, tone = "green" }: { icon: typeof BarChart3; label: string; value: string; delta: string; chart: number[]; tone?: "green" | "amber" }) { const accent = tone === "amber" ? "#d39a35" : "#218963"; return <Card className="gap-0 py-0"><CardContent className="p-5"><div className="flex items-start justify-between"><span className="grid size-9 place-items-center rounded-lg bg-[#f0f4f1] text-[#50635a]"><Icon size={17} /></span><MiniChart values={chart} color={accent} /></div><p className="mt-5 text-xs font-medium text-muted-foreground">{label}</p><div className="mt-1 flex items-end justify-between gap-2"><strong className="font-mono text-[27px] font-semibold tracking-[-.05em]">{value}</strong><span className={`mb-1 text-[11px] font-medium ${tone === "amber" ? "text-amber-700" : "text-emerald-700"}`}>{delta}</span></div></CardContent></Card> }
function MiniChart({ values, color }: { values: number[]; color: string }) { const points = values.map((v,i) => `${i*10},${28-v*.65}`).join(" "); return <svg viewBox="0 0 60 30" className="h-8 w-16" aria-hidden="true"><polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} /><circle cx="60" cy={28-values.at(-1)!*.65} r="2.5" fill={color} /></svg> }
function CategoryBadge({ category }: { category: Opportunity["category"] }) { const style = category === "Works" ? "border-amber-200 bg-amber-50 text-amber-700" : category === "Services" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"; return <Badge variant="outline" className={style}>{category}</Badge> }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div> }
function FormField({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) { return <label className="grid gap-1.5 text-xs font-semibold">{label}<Input name={name} type={type} required={required} /></label> }
