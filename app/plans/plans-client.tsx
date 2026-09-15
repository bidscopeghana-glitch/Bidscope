"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Minus, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

type BillingCycle = "monthly" | "annual";
type LivePlan = { code: string; enabled: boolean; activation_status: string; amount_minor: number | null };

const packages = [
  {
    id: "free", name: "Free", eyebrow: "Explore",
    summary: "Verify the quality of BidScope opportunities before you pay.",
    monthly: 0, annual: 0, monthlyCode: "free", annualCode: "free", featured: false,
    features: [
      "Live Ghana and international opportunity listings",
      "Unlimited keyword and buyer search",
      "Official source links and core tender details",
      "Published award and archive browsing",
      "5 saved opportunities and 1 Tender Watch",
      "3 basic AI checks each month",
    ],
  },
  {
    id: "professional", name: "Professional", eyebrow: "Monitor",
    summary: "For a business that wants relevant opportunities delivered and tracked.",
    monthly: 295, annual: 2950, monthlyCode: "professional_monthly", annualCode: "professional_annual", featured: false,
    features: [
      "Everything in Free",
      "Personalised opportunity matching and Best Match",
      "Daily email alerts and immediate in-app alerts",
      "Deadline, buyer and tender-change monitoring",
      "10 Tender Watches, 25 buyer follows and 100 saves",
      "30 AI checks per month",
    ],
  },
  {
    id: "intelligence", name: "Intelligence", eyebrow: "Decide",
    summary: "For serious bidders who need evidence before committing time and money.",
    monthly: 450, annual: 4500, monthlyCode: "intelligence_monthly", annualCode: "intelligence_annual", featured: true,
    features: [
      "Everything in Professional",
      "Bid / No-Bid and eligibility analysis",
      "Buyer, award and market intelligence",
      "Readiness scoring and tender intelligence reports",
      "50 Tender Watches, 100 buyer follows and 500 saves",
      "300 AI analyses per month",
    ],
  },
  {
    id: "business", name: "Business", eyebrow: "Prepare",
    summary: "For organisations running a larger, repeatable bidding operation.",
    monthly: 600, annual: 6000, monthlyCode: "business_monthly", annualCode: "business_annual", featured: false,
    features: [
      "Everything in Intelligence",
      "Full bid workspace, pipeline, documents and deadlines",
      "Expanded opportunity and change monitoring",
      "Highest save, watch and buyer-follow limits",
      "2,000 saves, 200 Tender Watches and 500 buyer follows",
      "1,200 AI analyses per month",
    ],
  },
] as const;

const comparison = [
  ["Live opportunities and official links", "Included", "Included", "Included", "Included"],
  ["Keyword and buyer search", "Unlimited", "Unlimited", "Unlimited", "Unlimited"],
  ["Daily email alerts", "—", "Included", "Included", "Included"],
  ["Tender Watches", "1", "10", "50", "200"],
  ["Saved opportunities", "5", "100", "500", "2,000"],
  ["Best Match and advanced matching", "—", "Included", "Included", "Included"],
  ["Awards and buyer intelligence", "Archive", "Archive", "Full intelligence", "Full intelligence"],
  ["Bid / No-Bid and readiness", "—", "—", "Included", "Included"],
  ["AI analysis allowance", "3 / month", "30 / month", "300 / month", "1,200 / month"],
  ["Full bid workspace", "—", "—", "—", "Included"],
] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 }).format(value);
}

export function PlansClient() {
  const [cycle, setCycle] = useState<BillingCycle>("annual");
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
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/72">Public notices stay accessible. Paid plans help your business monitor, qualify and prepare for the opportunities worth pursuing.</p>
          <div className="mx-auto mt-8 inline-flex rounded-full border border-white/15 bg-white/8 p-1" aria-label="Billing period" role="group">
            <button aria-pressed={cycle === "monthly"} className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${cycle === "monthly" ? "bg-white text-[#17362d]" : "text-white/75"}`} onClick={() => setCycle("monthly")}>Monthly</button>
            <button aria-pressed={cycle === "annual"} className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${cycle === "annual" ? "bg-[#d0a344] text-[#17362d]" : "text-white/75"}`} onClick={() => setCycle("annual")}>Annual · 2 months included</button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-10 md:grid-cols-2 xl:grid-cols-4">
        {packages.map((plan) => {
          const code = cycle === "annual" ? plan.annualCode : plan.monthlyCode;
          const price = cycle === "annual" ? plan.annual : plan.monthly;
          const ready = plan.id === "free" || liveCodes.has(code);
          return (
            <article key={plan.id} className={`relative flex min-h-full flex-col rounded-[26px] border p-6 ${plan.featured ? "border-[#185e46] bg-white shadow-[0_24px_70px_rgba(20,65,51,.15)]" : "border-[#17362d]/10 bg-white"}`}>
              {plan.featured && <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-[#e3f3eb] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#116149]"><Sparkles size={12}/>Best value</span>}
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#5e766d]">{plan.eyebrow}</p>
              <h2 className="serif mt-3 text-3xl">{plan.name}</h2>
              <p className="mt-3 min-h-16 text-sm leading-6 text-[#63766d]">{plan.summary}</p>
              <div className="mt-6 border-y border-[#17362d]/10 py-5">
                <strong className="text-3xl tracking-[-.04em]">{money(price)}</strong>
                <span className="ml-1 text-sm text-[#6c7c74]">/{cycle === "annual" ? "year" : "month"}</span>
                {cycle === "annual" && price > 0 && <p className="mt-1 text-xs text-[#6c7c74]">Equivalent to {money(Math.round(price / 12))} per month</p>}
                {price === 0 && <p className="mt-1 text-xs text-[#6c7c74]">No card required</p>}
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => <li className="flex gap-2.5 text-sm leading-5 text-[#38594e]" key={feature}><Check className="mt-0.5 shrink-0 text-[#16805e]" size={16}/><span>{feature}</span></li>)}
              </ul>
              <Link className={`mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold ${plan.featured ? "bg-[#185e46] text-white" : "border border-[#17362d]/18 text-[#17362d]"}`} href={plan.id === "free" ? "/sign-in" : "/customer/billing"}>
                {plan.id === "free" ? "Create free account" : ready ? `Choose ${plan.name}` : "Preview package"}<ArrowRight size={16}/>
              </Link>
              {!ready && <p className="mt-3 text-center text-[11px] font-semibold text-[#8a6a2d]">Checkout activates after package approval</p>}
            </article>
          );
        })}
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
          <div><div className="flex items-center gap-2 text-[#8ce0bd]"><ShieldCheck size={19}/><span className="text-xs font-bold uppercase tracking-[.15em]">Truthful packaging</span></div><h2 className="serif mt-3 text-3xl">No invented service promises.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/68">BidScope currently sells one business account per package. Five-seat administration, hosted document downloads, 24/7 support and dedicated account management will only appear after those services are operational.</p></div>
          <Link href="/opportunities" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#17362d]">Explore opportunities<ArrowRight size={16}/></Link>
        </div>
      </section>
    </main>
  );
}
