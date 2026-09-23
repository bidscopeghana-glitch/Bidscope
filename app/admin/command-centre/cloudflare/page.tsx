"use client";

import Link from "next/link";
import { useData } from "@/components/customer/data";

type AIMetrics={data:{byProvider:Array<{name:string;value:number}>;metrics:{providerFailures:number;fallbackEvents:number}}};

const rows=[
  {name:"DNS and edge",status:"Vercel direct",detail:"A Cloudflare zone was added for review but remains pending. BidScope's nameservers were not changed, and the website continues to use Vercel directly. Bot Preference Sync is off."},
  {name:"WAF and edge rate limits",status:"Not active",detail:"Cloudflare edge rules cannot protect the main site while its traffic goes directly to Vercel. Keep using the existing application and Vercel safeguards; do not assume Cloudflare WAF is enforcing rules."},
  {name:"Cloudflare Access",status:"Not enforced",detail:"No Zero Trust application protects the main site. BidScope's own administrator authorization remains mandatory. A separate internal hostname could be evaluated without proxying the public site."},
  {name:"R2 object storage",status:"Not enabled",detail:"R2 was left inactive at the owner's request. No bucket or file migration was created; private files remain in Supabase Storage."},
  {name:"Workers AI",status:"Staged",detail:"The provider adapter and health test exist. Customer-facing assistance and tender interpretation remain with existing providers; no new classification workload is automatically published."},
] as const;

export default function CloudflareInfrastructurePage(){
  const ai=useData<AIMetrics>("/api/admin/ai");
  const workerRequests=ai.data?.data.byProvider.find(item=>item.name==="cloudflare")?.value;
  return <div className="mx-auto max-w-6xl px-5 py-9 text-[#17362d] lg:px-9">
    <p className="text-xs font-black uppercase tracking-[.2em] text-[#16805e]">BidScope operations</p>
    <h1 className="mt-2 text-4xl font-bold">Cloudflare infrastructure</h1>
    <p className="mt-3 max-w-3xl text-sm leading-7 text-[#64766e]">An honest view of the Cloudflare account reviewed on 23 September 2026. Edge and storage states are audit snapshots, not live telemetry. No secrets are displayed.</p>
    <div className="mt-8 grid gap-4 md:grid-cols-2">{rows.map(row=><section key={row.name} className="rounded-3xl border border-[#17362d]/10 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{row.name}</h2><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{row.status}</span></div><p className="mt-4 text-sm leading-6 text-[#526960]">{row.detail}</p></section>)}</div>
    <section className="mt-5 rounded-3xl border border-[#17362d]/10 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">AI operations</h2>{ai.error?<p className="mt-3 text-sm text-red-700">Live AI metrics are unavailable: {ai.error}</p>:ai.loading?<p className="mt-3 text-sm">Loading live AI metrics…</p>:<p className="mt-3 text-sm text-[#526960]">Workers AI requests in the current AI log window: <strong>{workerRequests??0}</strong>. All-provider failures: <strong>{ai.data?.data.metrics.providerFailures??0}</strong>. All-provider fallback events: <strong>{ai.data?.data.metrics.fallbackEvents??0}</strong>. These metrics are not WAF or Access traffic.</p>}<Link href="/admin/ai/providers" className="mt-5 inline-flex rounded-full bg-[#0d4939] px-5 py-2.5 text-sm font-bold text-white">Review AI providers</Link></section>
    <p className="mt-6 text-xs leading-5 text-[#64766e]">The owner chose to keep Vercel as the direct public edge. Cloudflare WAF and Access on the main domain are therefore not active. Any future change needs a separate DNS, security and rollback review.</p>
  </div>;
}
