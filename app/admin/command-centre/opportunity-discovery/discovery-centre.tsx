"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/customer/data";

type Source = { id: string; name: string; base_url: string; discovery_enabled: boolean; crawl_robots_allowed: boolean; crawl_terms_reviewed: boolean; crawl_last_success_at: string | null; crawl_consecutive_failures: number; crawl_next_at: string | null; crawl_max_pages: number };
type Discovery = { id: string; source_id: string; raw_title: string | null; raw_text: string; canonical_url: string; extracted_data: { title?: string; buyer?: string; reference?: string; deadline?: string; description?: string }; processing_status: string; duplicate_status: string; matched_tender_id: string | null; confidence_score: number; duplicate_score: number; error_message: string | null; first_seen_at: string };
type Job = { id: string; status: string; source_id: string; pages_examined: number; discoveries_found: number; started_at: string; error_message: string | null };
type Settings = { enabled: boolean; auto_publish: boolean; max_crawls_per_day: number };
type Snapshot = { discoveries: Discovery[]; sources: Source[]; jobs: Job[]; settings: Settings | null };

export function DiscoveryCentre() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState("needs_review");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const result = await api<{ data: Snapshot }>(`/api/admin/discovery?status=${encodeURIComponent(status)}`);
    setData(result.data);
  }
  useEffect(() => {
    void api<{ data: Snapshot }>(`/api/admin/discovery?status=${encodeURIComponent(status)}`)
      .then(result => setData(result.data))
      .catch(() => setMessage("Discovery data is unavailable. Check whether the migration has been applied."));
  }, [status]);
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try { await api("/api/admin/discovery", body, "POST"); await load(); setMessage("Action saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Action failed."); }
    finally { setBusy(false); }
  }
  const chosen = data?.discoveries.find(item => item.id === selected);
  const sourceName = (id: string) => data?.sources.find(source => source.id === id)?.name || "Unknown source";
  return <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-[#17362d] sm:px-7">
    <header className="rounded-[28px] bg-gradient-to-r from-[#0b372c] via-[#12644e] to-[#214c3e] p-7 text-white shadow-xl">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[#d9c786]">Procurement intelligence</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Opportunity discovery</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Private crawler staging, source health and human review. Nothing enters the customer feed until it passes publication checks.</p>
    </header>
    {message && <p role="status" className="rounded-xl border border-[#c5d8cc] bg-white p-3 text-sm">{message}</p>}
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-1"><h2 className="font-bold">Controls</h2><p className="mt-2 text-xs text-[#61736a]">Global crawl access is off until sources and permissions are reviewed.</p><div className="mt-4 space-y-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(data?.settings?.enabled)} disabled={busy} onChange={event => void act({ action: "settings", enabled: event.target.checked })}/> Scheduled discovery</label><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(data?.settings?.auto_publish)} disabled={busy} onChange={event => void act({ action: "settings", autoPublish: event.target.checked })}/> Automatic publication</label><p>Daily crawl cap: {data?.settings?.max_crawls_per_day ?? "—"}</p><button type="button" disabled={busy} onClick={() => void act({ action: "run" })} className="rounded-full bg-[#116149] px-4 py-2 font-bold text-white disabled:opacity-50">Run next due source</button><button type="button" disabled={busy} onClick={() => void act({ action: "poll" })} className="ml-2 rounded-full border border-[#116149] px-4 py-2 font-bold text-[#116149] disabled:opacity-50">Check jobs</button></div></section>
      <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-2"><h2 className="font-bold">Source health</h2><div className="mt-3 max-h-72 space-y-2 overflow-auto">{data?.sources.map(source => <div key={source.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dce6df] p-3 text-sm"><div><b>{source.name}</b><p className="text-xs text-[#61736a]">{source.crawl_consecutive_failures ? `Failing · ${source.crawl_consecutive_failures} errors` : source.crawl_last_success_at ? "Healthy" : "Not tested"} · max {source.crawl_max_pages} pages</p></div><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void act({ action: "source", id: source.id, enabled: !source.discovery_enabled })} className="rounded-full border px-3 py-1.5">{source.discovery_enabled ? "Pause" : "Enable"}</button><button disabled={busy || !source.discovery_enabled} onClick={() => void act({ action: "run", sourceId: source.id })} className="rounded-full bg-[#e7f4ed] px-3 py-1.5 font-semibold">Run now</button></div><p className="w-full text-xs text-[#61736a]">Robots: {source.crawl_robots_allowed ? "reviewed" : "not approved"} · Terms: {source.crawl_terms_reviewed ? "reviewed" : "not approved"}</p></div>)}</div></section>
    </div>
    <section className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Review queue</h2><select aria-label="Discovery status" value={status} onChange={event => { setStatus(event.target.value); setSelected(null); }} className="rounded-xl border border-[#d0ded5] px-3 py-2 text-sm">{["needs_review", "published", "rejected", "expired", "error"].map(value => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select></div><div className="mt-4 grid gap-3 md:grid-cols-2">{data?.discoveries.map(item => <button type="button" key={item.id} onClick={() => setSelected(item.id)} className={`rounded-xl border p-4 text-left hover:border-[#116149] ${selected === item.id ? "border-[#116149] bg-[#f1faf5]" : "border-[#dce6df]"}`}><p className="text-xs uppercase tracking-wide text-[#64756a]">{sourceName(item.source_id)} · {item.duplicate_status.replaceAll("_", " ")}</p><h3 className="mt-1 font-bold">{item.extracted_data.title || item.raw_title || "Untitled page"}</h3><p className="mt-1 text-xs text-[#61736a]">{item.extracted_data.buyer || "Buyer unknown"} · {item.extracted_data.deadline?.slice(0, 10) || "No deadline"}</p><p className="mt-2 text-xs">Extraction {Math.round(Number(item.confidence_score) * 100)}% · Duplicate {Math.round(Number(item.duplicate_score) * 100)}%</p></button>)}{data?.discoveries.length === 0 && <p className="text-sm text-[#61736a]">No records in this queue.</p>}</div></section>
    {chosen && <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">{chosen.extracted_data.title || chosen.raw_title}</h2><p className="mt-2 text-sm text-[#5b6e62]">{chosen.extracted_data.buyer} · {chosen.extracted_data.reference || "No reference"} · Deadline {chosen.extracted_data.deadline || "not found"}</p><a className="mt-2 inline-block text-sm font-semibold text-[#116149] underline" href={chosen.canonical_url} target="_blank" rel="noopener noreferrer">Open original source</a><p className="mt-3 text-sm text-[#965f32]">{chosen.error_message}</p><pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#f5f8f5] p-4 text-xs leading-5">{chosen.raw_text.slice(0, 10000)}</pre><div className="mt-4 flex flex-wrap gap-2">{chosen.processing_status !== "published" && <><button disabled={busy} onClick={() => void act({ action: "approve", id: chosen.id })} className="rounded-full bg-[#116149] px-4 py-2 text-sm font-bold text-white">Approve & publish</button><button disabled={busy} onClick={() => void act({ action: "mark_unique", id: chosen.id })} className="rounded-full border px-4 py-2 text-sm">Mark unique</button><button disabled={busy || !chosen.matched_tender_id} onClick={() => void act({ action: "merge", id: chosen.id })} className="rounded-full border px-4 py-2 text-sm">Merge with matched tender</button><button disabled={busy} onClick={() => void act({ action: "reextract", id: chosen.id })} className="rounded-full border px-4 py-2 text-sm">Re-extract</button><button disabled={busy} onClick={() => void act({ action: "reject", id: chosen.id })} className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700">Reject</button></>}</div></section>}
    <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Recent crawl jobs</h2><div className="mt-3 space-y-2 text-sm">{data?.jobs.map(job => <p key={job.id} className="border-b border-[#e3ebe5] py-2">{sourceName(job.source_id)} · {job.status} · {job.pages_examined} pages · {job.discoveries_found} new/changed{job.error_message ? ` · ${job.error_message}` : ""}</p>)}</div></section>
  </section>;
}
