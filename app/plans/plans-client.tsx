"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Minus, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type BillingCycle = "monthly" | "annual";
type LivePlan = { code: string; enabled: boolean; activation_status: string; amount_minor: number | null };

const packages = [
  {
    id: "pro", name: "Pro", eyebrow: "Discover & monitor", image: "/images/ghana-supplier.webp",
    summary: "For businesses that need reliable opportunity discovery and daily monitoring.",
    monthly: 150, annual: 1500, monthlyCode: "pro_launch_monthly", annualCode: "pro_launch_annual", featured: false,
    features: [
      "Live Ghana and eligible international opportunities",
      "Unlimited website access and keyword search",
      "Official tender details, links, awards and archive",
      "Personalised opportunity matching and Best Match",
      "Daily email alerts and immediate in-app alerts",
      "Tender amendment monitoring and deadline reminders",
      "10 Tender Watches, 25 buyer follows and 100 saved opportunities",
      "30 AI checks per month",
      "Mobile Money option available as non-renewing 30-day or annual access",
    ],
  },
  {
    id: "premium", name: "Premium Team", eyebrow: "Qualify & collaborate", image: "/images/bidscope-hero.webp",
    summary: "For small bidding teams that need deeper intelligence and shared decision-making.",
    monthly: 350, annual: 3500, monthlyCode: "premium_launch_monthly", annualCode: "premium_launch_annual", featured: true,
    features: [
      "Everything in Pro, for up to 3 users",
      "Bid / No-Bid and eligibility analysis",
      "Buyer, award and market intelligence",
      "Readiness scoring and tender intelligence reports",
      "Multi-recipient alerts and shared tender decision notes",
      "Shared workspace with 50 Tender Watches, 100 buyer follows and 500 saved opportunities",
      "300 AI analyses per month",
      "Mobile Money option available as non-renewing 30-day or annual access",
    ],
  },
  {
    id: "platinum", name: "Platinum Team", eyebrow: "Prepare & scale", image: "/images/contract-win.webp",
    summary: "For established procurement teams running a repeatable bidding operation.",
    monthly: 750, annual: 7500, monthlyCode: "platinum_launch_monthly", annualCode: "platinum_launch_annual", featured: false,
    features: [
      "Everything in Premium Team, for up to 5 users",
      "Full bid workspace, pipeline, documents and deadlines",
      "Advanced change monitoring and procurement radar",
      "Up to 5 workspace seats, 5 alert recipients and role-based collaboration",
      "200 Tender Watches, 500 buyer follows and 2,000 saved opportunities",
      "1,200 AI analyses per month",
      "Mobile Money option available as non-renewing 30-day or annual access",
    ],
  },
] as const;

const comparison = [
  ["Live opportunities and official links", "Included", "Included", "Included"],
  ["Keyword and buyer search", "Unlimited", "Unlimited", "Unlimited"],
  ["Daily email and in-app alerts", "Included", "Included", "Included"],
  ["Tender Watches", "10", "50", "200"],
  ["Saved opportunities", "100", "500", "2,000"],
  ["Best Match and advanced matching", "Included", "Included", "Included"],
  ["Awards and buyer intelligence", "Archive", "Full intelligence", "Full intelligence"],
  ["Bid / No-Bid and readiness", "—", "Included", "Included"],
  ["Multiple alert recipients", "—", "Included", "Included"],
  ["Team seats", "1", "3", "5"],
  ["AI analysis allowance", "30 / month", "300 / month", "1,200 / month"],
  ["Full bid workspace", "—", "—", "Included"],
] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 }).format(value);
}

export function PlansClient() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [livePlans, setLivePlans] = useState<LivePlan[]>([]);

  useEffect(() => {
    void fetch("/api/billing/plans")
      .then(async (response) => await response.json() as { data?: LivePlan[] })
      .then((body) => setLivePlans(body.data || []))
      .catch(() => setLivePlans([]));
  }, []);

  const liveCodes = useMemo(
    () => new Set(livePlans.filter((plan) => plan.enabled && plan.activation_status === "LIVE").map((plan) => plan.code)),
    [livePlans],
  );

  return (
    <main className="bg-[#f4f7f3] text-[#17362d]">
      <section className="border-b border-white/10 bg-[#103f32] px-5 py-14 text-white sm:py-18">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8ce0bd]">Clear plans for every bidding stage</p>
          <h1 className="serif mx-auto mt-4 max-w-4xl text-4xl leading-[1.02] tracking-[-.04em] sm:text-6xl">Start with opportunities. Upgrade for intelligence.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/72">Browse opportunity previews, then create an account to review the details. Paid plans help your business monitor, qualify and prepare for the opportunities worth pursuing.</p>
          <div className="mx-auto mt-8 inline-flex rounded-full border border-white/15 bg-white/8 p-1" aria-label="Billing period" role="group">
            <button aria-pressed={cycle === "monthly"} className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${cycle === "monthly" ? "bg-white text-[#17362d]" : "text-white/75"}`} onClick={() => setCycle("monthly")}>Monthly</button>
            <button aria-pressed={cycle === "annual"} className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${cycle === "annual" ? "bg-[#d0a344] text-[#17362d]" : "text-white/75"}`} onClick={() => setCycle("annual")}>Annual · 2 months included</button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 pt-8 text-center"><p className="leading-7">Need a company profile, tender review, research brief or tailored preparation support?</p><Link href="/services" className="mt-3 inline-block font-bold text-[#116149] underline">Explore separately priced custom services</Link><p className="mt-3 text-sm text-[#61736a]">New-customer offers. Existing subscriptions retain their agreed renewal price. Custom services are not included in any subscription.</p></div>
      <section className="mx-auto max-w-7xl px-5 pt-10">
        <div className="mb-5 flex items-center gap-4 rounded-[22px] border border-[#17362d]/10 bg-white p-5 shadow-sm">
          <div className="hidden h-16 w-24 overflow-hidden rounded-xl sm:block"><Image src="/images/contract-win.webp" alt="Secure card payment for a contract intelligence subscription" width={192} height={128} className="h-full w-full object-cover" /></div>
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#16805e]">Recurring card subscriptions</p><h2 className="serif mt-1 text-2xl text-[#17362d]">Automatic renewal, continuous intelligence.</h2><p className="mt-1 text-sm text-[#63766d]">Pay securely by Visa, Mastercard or another supported card. Your access renews monthly or annually until you cancel.</p></div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-10 md:grid-cols-3">
        {packages.map((plan) => {
          const code = cycle === "annual" ? plan.annualCode : plan.monthlyCode;
          const configured = livePlans.find(item => item.code === code);
          const price = configured?.amount_minor != null ? configured.amount_minor / 100 : cycle === "annual" ? plan.annual : plan.monthly;
          const ready = liveCodes.has(code);
          return (
            <article key={plan.id} className={`relative flex min-h-full flex-col overflow-hidden rounded-[26px] border p-6 ${plan.featured ? "border-[#185e46] bg-white shadow-[0_24px_70px_rgba(20,65,51,.15)]" : "border-[#17362d]/10 bg-white"}`} style={{ backgroundImage: `linear-gradient(120deg, rgba(255,255,255,.97) 10%, rgba(255,255,255,.88) 62%, rgba(239,247,242,.72)), url(${plan.image})`, backgroundSize: "cover", backgroundPosition: "center" }}>
              {plan.featured && <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-[#e3f3eb] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#116149]"><Sparkles size={12}/>Best value</span>}
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#5e766d]">{plan.eyebrow}</p>
              <h2 className="serif mt-3 text-3xl">{plan.name}</h2>
              <p className="mt-3 min-h-16 text-sm leading-6 text-[#63766d]">{plan.summary}</p>
              <div className="mt-6 border-y border-[#17362d]/10 py-5">
                <strong className="text-3xl tracking-[-.04em]">{money(price)}</strong>
                <span className="ml-1 text-sm text-[#6c7c74]">/{cycle === "annual" ? "year" : "month"}</span>
                {cycle === "annual" && price > 0 && <p className="mt-1 text-xs text-[#6c7c74]">Equivalent to {money(Math.round(price / 12))} per month</p>}
              </div>
              <div className="mt-6 rounded-2xl bg-[#f0f7f1] p-4"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#116149]">What you get</p><ul className="mt-3 space-y-3">
                {plan.features.map((feature) => <li className="flex gap-2.5 text-sm leading-5 text-[#38594e]" key={feature}><Check className="mt-0.5 shrink-0 text-[#16805e]" size={16}/><span>{feature}</span></li>)}
              </ul></div>
              <Link className={`mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold ${plan.featured ? "bg-[#185e46] text-white" : "border border-[#17362d]/18 text-[#17362d]"}`} href="/customer/billing">
                {ready ? `Choose ${plan.name}` : "Preview package"}<ArrowRight size={16}/>
              </Link>
              {!ready && <p className="mt-3 text-center text-[11px] font-semibold text-[#8a6a2d]">Checkout activates after package approval</p>}
            </article>
          );
        })}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-12">
        <div className="mb-5 flex items-center gap-4 rounded-[22px] border border-[#d0a344]/35 bg-[#fffaf0] p-5 shadow-sm">
          <div className="hidden h-16 w-24 overflow-hidden rounded-xl sm:block"><Image src="/images/ghana-supplier.webp" alt="Ghanaian business team using mobile money" width={192} height={128} className="h-full w-full object-cover" /></div>
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#9a7420]">Mobile Money · one-time access</p><h2 className="serif mt-1 text-2xl text-[#17362d]">Flexible access without auto-renewal.</h2><p className="mt-1 text-sm text-[#63766d]">Pay once with MTN MoMo, Telecel Cash or AirtelTigo Money where supported. Renew manually whenever you choose.</p></div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {packages.map((plan) => <article key={`${plan.id}-momo`} className="relative flex flex-col overflow-hidden rounded-[26px] border border-[#d0a344]/35 bg-[#fffdf7] p-6 shadow-[0_16px_45px_rgba(120,90,30,.08)]" style={{ backgroundImage: `linear-gradient(120deg, rgba(255,253,247,.97) 12%, rgba(255,253,247,.88) 58%, rgba(255,244,216,.72)), url(${plan.image})`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#9a7420]">Mobile Money</p><h2 className="serif mt-2 text-3xl">{plan.name}</h2></div><span className="rounded-full bg-[#f5e9c7] px-3 py-1 text-[11px] font-bold text-[#765816]">No auto-renewal</span></div>
            <p className="mt-3 text-sm leading-6 text-[#63766d]">{plan.summary}</p>
            <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-[#d0a344]/30 bg-white p-3"><p className="text-[11px] font-bold uppercase text-[#8b6d28]">30 days</p><strong className="mt-1 block text-xl">{money(plan.monthly)}</strong></div><div className="rounded-xl border border-[#d0a344]/30 bg-white p-3"><p className="text-[11px] font-bold uppercase text-[#8b6d28]">365 days</p><strong className="mt-1 block text-xl">{money(plan.annual)}</strong></div></div>
            <div className="mt-5 flex-1 rounded-2xl bg-[#fff4d8] p-4"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#765816]">Included benefits</p><ul className="mt-3 space-y-2">{plan.features.slice(0, 5).map((feature) => <li className="flex gap-2 text-sm leading-5 text-[#5d512f]" key={feature}><Check className="mt-0.5 shrink-0 text-[#b48829]" size={16}/><span>{feature}</span></li>)}</ul></div>
            <Link className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#d0a344] px-5 text-sm font-bold text-[#17362d]" href="/customer/billing">Choose Mobile Money <ArrowRight size={16}/></Link>
          </article>)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-12">
        <div className="overflow-hidden rounded-[26px] border border-[#17362d]/10 bg-white">
          <div className="border-b border-[#17362d]/10 p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#16805e]">Compare packages</p>
            <h2 className="serif mt-2 text-3xl sm:text-4xl">Pay for the intelligence you will use.</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead><tr className="bg-[#f7f9f6]"><th className="p-4 font-semibold">Capability</th>{packages.map((plan) => <th className="p-4 font-semibold" key={plan.id}>{plan.name}</th>)}</tr></thead>
              <tbody>{comparison.map((row) => <tr className="border-t border-[#17362d]/8" key={row[0]}>{row.map((cell, index) => <td className={`p-4 ${index === 0 ? "font-medium text-[#2c5144]" : "text-[#65776f]"}`} key={`${row[0]}-${index}`}>{cell === "Included" ? <span className="inline-flex items-center gap-1.5 font-semibold text-[#116149]"><Check size={15}/>Included</span> : cell === "—" ? <Minus size={16} className="text-[#a6b0ab]"/> : cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="grid gap-5 rounded-[26px] bg-[#17362d] p-7 text-white md:grid-cols-[1fr_auto] md:items-center md:p-9">
          <div><div className="flex items-center gap-2 text-[#8ce0bd]"><ShieldCheck size={19}/><span className="text-xs font-bold uppercase tracking-[.15em]">Truthful packaging</span></div><h2 className="serif mt-3 text-3xl">Clear features. Verifiable sources.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/68">Every package is governed by server-side feature permissions and usage limits. Formal submissions still take place through the issuing authority’s official procurement system.</p></div>
          <Link href="/opportunities" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#17362d]">Explore opportunities<ArrowRight size={16}/></Link>
        </div>
      </section>
    </main>
  );
}
