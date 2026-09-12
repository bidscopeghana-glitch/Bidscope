"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Database, Pause, Play, RefreshCw } from "lucide-react";

type Run = { id:string; status:string; started_at:string; completed_at:string|null; records_fetched:number; ghana_opportunity_count?:number; project_count?:number; award_count?:number; inserted_count:number; updated_count:number; duplicate_count:number; failed_count:number; error_summary:string|null };
type Source = { id:string; name:string; slug:string; organisation:string; base_url:string; integration_type:string; implementation_status:string; api_enabled:boolean; api_key_required:boolean; environment_key_name:string|null; sync_enabled:boolean; sync_frequency:string; last_sync_at:string|null; last_success_at:string|null; last_error:string|null; status:string; trust_level:string; runs?:Run[] };

function formatDate(value:string|null) { return value ? new Intl.DateTimeFormat("en-GB", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value)) : "Never"; }
function friendly(value:string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function SourceCommandCentre() {
  const [sources, setSources] = useState<Source[]>([]);
  const [message, setMessage] = useState("Loading source registry…");
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const token = localStorage.getItem("bidscope_access_token");
      const endpoint = token ? "/api/admin/procurement-sources" : "/api/procurement-sources";
      const response = await fetch(endpoint, { headers: token ? { Authorization:`Bearer ${token}` } : {} });
      const body = await response.json() as { data:Source[]; error?:string };
      if (!response.ok) throw new Error(body.error);
      setSources(body.data);
      setMessage(token ? "" : "Read-only view. Sign in as Super Admin to use controls and view logs.");
    } catch { setMessage("Source registry is unavailable until the database migration is applied."); }
  }

  useEffect(() => {
    const token = localStorage.getItem("bidscope_access_token");
    const endpoint = token ? "/api/admin/procurement-sources" : "/api/procurement-sources";
    void fetch(endpoint, { headers:token ? { Authorization:`Bearer ${token}` } : {} }).then(async (response) => {
      const body = await response.json() as { data:Source[]; error?:string };
      if (!response.ok) throw new Error(body.error);
      setSources(body.data); setMessage(token ? "" : "Read-only view. Sign in as Super Admin to use controls and view logs.");
    }).catch(() => setMessage("Source registry is unavailable until the database migration is applied."));
  }, []);

  async function action(source:Source, kind:"test"|"sync"|"toggle") {
    const token = localStorage.getItem("bidscope_access_token");
    if (!token) { setMessage("Super Admin sign-in is required for source controls."); return; }
    setBusy(`${source.slug}:${kind}`);
    try {
      const endpoint = kind === "test" ? `/api/admin/procurement-sources/${source.slug}/test` : kind === "sync" ? `/api/admin/procurement-sources/${source.slug}/sync` : `/api/admin/procurement-sources/${source.slug}`;
      const response = await fetch(endpoint, { method:kind === "toggle" ? "PATCH" : "POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:kind === "toggle" ? JSON.stringify({ status:source.status === "PAUSED" ? "ACTIVE" : "PAUSED", syncEnabled:source.status === "PAUSED" }) : undefined });
      const body = await response.json() as { data?:{message?:string}; error?:string };
      if (!response.ok) throw new Error(body.error || "Action failed");
      setMessage(kind === "test" ? body.data?.message || "Connection checked." : `${source.name}: ${kind} completed.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action failed."); }
    finally { setBusy(""); }
  }

  return <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#116149]">Command Centre · Procurement Data</p><h1 className="serif mt-3 text-4xl text-[#17362d] sm:text-5xl">Source integrations</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#61736a]">Connection states are explicit. Credentials remain server-side and are never returned here.</p></div><a href="/api/procurement-sources" className="text-xs font-bold text-[#116149]">View registry JSON</a></div>
    {message && <div aria-live="polite" className="mt-6 rounded-2xl border border-[#17362d]/10 bg-white p-4 text-sm text-[#4f685e]">{message}</div>}
    <div className="mt-7 grid gap-4 lg:grid-cols-2">{sources.map((source) => {
      const run = source.runs?.[0]; const live = source.implementation_status === "LIVE"; const connected = source.slug === "world-bank" && source.status === "ACTIVE";
      const statistics = [["Fetched",run?.records_fetched || 0],["Ghana",run?.ghana_opportunity_count || 0],["New",run?.inserted_count || 0],["Updated",run?.updated_count || 0],["Projects",run?.project_count || 0],["Awards",run?.award_count || 0],["Errors",run?.failed_count || 0]];
      return <article key={source.id} className="rounded-[24px] border border-[#17362d]/10 bg-[#fffdf8] p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-[#17362d]">{source.name}</h2><span className={`rounded-full px-2 py-1 text-[9px] font-extrabold tracking-wider ${source.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : source.status === "ERROR" ? "bg-red-100 text-red-800" : "bg-stone-100 text-stone-700"}`}>{connected ? "CONNECTED" : source.status}</span></div><p className="mt-1 text-xs text-[#6d7c75]">{source.organisation}</p></div>{live ? <CheckCircle2 className="text-[#16825f]"/> : <AlertTriangle className="text-[#a37325]"/>}</div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">{[["Integration",friendly(source.integration_type)],["Authentication",source.api_key_required ? "Environment credential" : "Not required"],["Classification",friendly(source.implementation_status)],["Last sync",formatDate(source.last_sync_at)],["Last success",formatDate(source.last_success_at)],["Frequency",source.sync_frequency]].map(([label,value]) => <div key={label} className="rounded-xl bg-[#f3f2e9] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[#7b8983]">{label}</p><p className="mt-1 break-words font-semibold text-[#344f45]">{value}</p></div>)}</div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center sm:grid-cols-7">{statistics.map(([label,value]) => <div key={label} className="rounded-lg border border-[#17362d]/8 p-2"><strong className="block text-sm text-[#17362d]">{value}</strong><span className="text-[8px] uppercase text-[#7b8983]">{label}</span></div>)}</div>
        {source.last_error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-800">{source.last_error}</p>}
        <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy !== ""} onClick={() => action(source,"test")} className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-bold"><Activity size={13}/>Test Connection</button><button disabled={busy !== "" || !live || source.status === "PAUSED"} onClick={() => action(source,"sync")} className="inline-flex items-center gap-1 rounded-full bg-[#116149] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><RefreshCw size={13}/>Sync Now</button><button disabled={busy !== ""} onClick={() => action(source,"toggle")} className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-bold">{source.status === "PAUSED" ? <Play size={13}/> : <Pause size={13}/>} {source.status === "PAUSED" ? "Resume" : "Pause"}</button></div>
        <details className="mt-4 rounded-xl border border-[#17362d]/10"><summary className="cursor-pointer px-4 py-3 text-xs font-bold text-[#315b4e]">View Logs</summary><div className="space-y-2 border-t p-3">{source.runs?.length ? source.runs.map((item) => <div key={item.id} className="rounded-lg bg-[#f3f2e9] p-3 text-[11px]"><strong>{item.status}</strong> · {formatDate(item.started_at)} · {item.records_fetched} fetched · {item.failed_count} errors{item.error_summary ? <p className="mt-1 text-red-800">{item.error_summary}</p> : null}</div>) : <p className="text-xs text-[#6d7c75]">No sync runs recorded.</p>}</div></details>
        <div className="mt-4 flex items-center gap-2 text-[10px] text-[#74837c]"><Database size={12}/>{source.api_key_required ? `${source.environment_key_name || "API credential"} required; value hidden.` : "No API credential required."}</div>
      </article>;
    })}</div>
  </section>;
}
