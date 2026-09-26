"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/customer/data";

type Performance = {
  counts: {
    started: number; drafts: number; submitted: number; currentlyShortlisted: number;
    awarded: number; unsuccessful: number; completionRate: number;
    averagePreparationDays: number | null;
  };
  awardValueByCurrency: Array<{ currency: string; amount: number }>;
  categories: Array<{ name: string; started: number; submitted: number; awarded: number }>;
  monthlyBids: Array<{ month: string; started: number; submitted: number }>;
};

export function SupplierPerformance() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "" });
  const query = new URLSearchParams({ resource: "supplier_reports" });
  if (applied.from) query.set("from", applied.from);
  if (applied.to) query.set("to", applied.to);
  const result = useData<{ data: Performance }>(`/api/procurement?${query.toString()}`);
  const data = result.data?.data;
  return <>
    <div className="cc-page-heading">
      <div><p className="cc-eyebrow">BID WORKSPACE</p><h1>Managed tender performance</h1>
        <p>Follow your organisation&apos;s bids on BidScope-managed tenders. External opportunities and unrecorded outcomes are not counted.</p>
      </div>
      <Link className="cc-button primary" href="/customer/bidscope-tenders">Find managed tenders</Link>
    </div>
    <section className="cc-editor mt-5">
      <h2>Bid creation dates</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">From<input className="mt-2 w-full rounded-xl border p-3" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="text-sm font-semibold">Through<input className="mt-2 w-full rounded-xl border p-3" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="cc-button primary" disabled={Boolean(from && to && from > to)} onClick={() => setApplied({ from, to })}>Apply dates</button>
        <button className="cc-button" onClick={() => { setFrom(""); setTo(""); setApplied({ from: "", to: "" }); }}>Clear</button>
      </div>
    </section>
    {result.loading ? <p className="cc-quiet mt-5" aria-busy="true">Calculating recorded bid activity…</p> : result.error ? <p className="cc-error mt-5" role="alert">{result.error}</p> : data && <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["Bids started", data.counts.started], ["Drafts", data.counts.drafts],
          ["Submitted", data.counts.submitted], ["Currently shortlisted / interviewing", data.counts.currentlyShortlisted],
          ["Confirmed awards", data.counts.awarded], ["Unsuccessful", data.counts.unsuccessful],
          ["Submission completion", `${data.counts.completionRate}%`],
          ["Average preparation", data.counts.averagePreparationDays == null ? "—" : `${data.counts.averagePreparationDays} days`],
        ] as const).map(([label, value]) => <div className="rounded-[22px] border border-[#17362d]/10 bg-white p-5 shadow-sm" key={label}>
          <strong className="block text-2xl text-[#17362d]">{value}</strong><span className="mt-2 block text-sm text-[#526a61]">{label}</span>
        </div>)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="cc-editor"><h2>Confirmed award value</h2><p className="cc-quiet">Finalised awards only; currencies are never combined.</p>
          {data.awardValueByCurrency.length ? data.awardValueByCurrency.map((row) => <div className="cc-document-row" key={row.currency}><strong>{row.currency}</strong><span>{row.amount.toLocaleString()}</span></div>) : <p className="cc-quiet">No finalised awards in this selection.</p>}
        </section>
        <section className="cc-editor"><h2>Bid categories</h2>
          {data.categories.length ? data.categories.map((row) => <div className="cc-document-row" key={row.name}><strong>{row.name}</strong><span>{row.started} started · {row.submitted} submitted · {row.awarded} awarded</span></div>) : <p className="cc-quiet">No managed-tender bids yet.</p>}
        </section>
        <section className="cc-editor lg:col-span-2"><h2>Recent monthly activity</h2>
          {data.monthlyBids.length ? data.monthlyBids.slice(-12).map((row) => <div className="cc-document-row" key={row.month}><strong>{row.month}</strong><span>{row.started} started · {row.submitted} submitted</span></div>) : <p className="cc-quiet">No bid activity in this selection.</p>}
          {data.monthlyBids.length > 12 && <p className="cc-quiet">Showing the latest 12 active months.</p>}
        </section>
      </div>
      <p className="cc-quiet mt-5">These figures cover only your organisation&apos;s recorded managed-tender bids. A confirmed award requires a finalised buyer decision. Views, matches and external bid outcomes are not included because they are not consistently recorded here.</p>
    </>}
  </>;
}
