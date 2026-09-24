"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Database, Pause, Play, RefreshCw } from "lucide-react";
import {api} from "@/components/customer/data";

type Run = { id:string; status:string; started_at:string; completed_at:string|null; records_fetched:number; ghana_opportunity_count?:number; project_count?:number; award_count?:number; inserted_count:number; updated_count:number; duplicate_count:number; failed_count:number; error_summary:string|null };
type Source = { id:string; name:string; slug:string; organisation:string; base_url:string; integration_type:string; implementation_status:string; api_enabled:boolean; api_key_required:boolean; environment_key_name:string|null; sync_enabled:boolean; sync_frequency:string; last_sync_at:string|null; last_success_at:string|null; last_error:string|null; status:string; trust_level:string; reuse_status?:string|null; content_reuse_allowed?:boolean; commercial_reuse_allowed?:boolean; metadata_reuse_allowed?:boolean; license_name?:string|null; license_url?:string|null; permission_evidence?:string|null; permission_date?:string|null; permission_expiry?:string|null; runs?:Run[] };

function formatDate(value:string|null) { return value ? new Intl.DateTimeFormat("en-GB", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value)) : "Never"; }
function friendly(value:string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function rightsApproved(source:Source) {
  if (!["explicitly_licensed", "written_permission", "official_api"].includes(source.reuse_status || "")) return false;
  if (!source.content_reuse_allowed || !source.commercial_reuse_allowed || !source.metadata_reuse_allowed) return false;
  if (source.permission_expiry && source.permission_expiry < new Date().toISOString().slice(0, 10)) return false;
  if (source.reuse_status === "explicitly_licensed") return Boolean(source.license_name && source.license_url);
  if (source.reuse_status === "written_permission") return Boolean(source.permission_evidence && source.permission_date);
  return Boolean(source.permission_evidence || source.license_url);
}

export function SourceCommandCentre() {
  const [sources, setSources] = useState<Source[]>([]);
  const [message, setMessage] = useState("Loading source registry…");
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const body=await api<{data:Source[]}>("/api/admin/procurement-sources");
      setSources(body.data);
      setMessage("");
    } catch { setMessage("Source registry is unavailable until the database migration is applied."); }
  }

  useEffect(() => {
    void api<{data:Source[]}>("/api/admin/procurement-sources").then(body=>{setSources(body.data);setMessage("");}).catch(()=>setMessage("Source registry is unavailable until the database migration is applied."));
  }, []);

  async function action(source:Source, kind:"test"|"sync"|"toggle") {
    setBusy(`${source.slug}:${kind}`);
    try {
      const endpoint = kind === "test" ? `/api/admin/procurement-sources/${source.slug}/test` : kind === "sync" ? `/api/admin/procurement-sources/${source.slug}/sync` : `/api/admin/procurement-sources/${source.slug}`;
      const body=await api<{data?:{message?:string}}>(endpoint,kind === "toggle"?{status:source.status === "PAUSED" ? "ACTIVE" : "PAUSED",syncEnabled:source.status === "PAUSED"}:undefined,kind === "toggle"?"PATCH":"POST");
      setMessage(kind === "test" ? body.data?.message || "Connection checked." : `${source.name}: ${kind} completed.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action failed."); }
    finally { setBusy(""); }
  }

  return <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#116149]">Command Centre · Procurement Data</p><h1 className="serif mt-3 text-4xl text-[#17362d] sm:text-5xl">Source integrations</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#61736a]">Connection states are explicit. Credentials remain server-side and are never returned here.</p></div><a href="/api/procurement-sources" className="text-xs font-bold text-[#116149]">View registry JSON</a></div>
    {message && <div aria-live="polite" className="mt-6 rounded-2xl border border-[#17362d]/10 bg-white p-4 text-sm text-[#4f685e]">{message}</div>}
    <div className="mt-7 grid gap-4 lg:grid-cols-2">{sources.map((source) => {
      const run = source.runs?.[0]; const live = source.implementation_status === "LIVE"; const approved = rightsApproved(source); const connected = source.slug === "world-bank" && source.status === "ACTIVE" && approved;
      const statistics = [["Fetched",run?.records_fetched || 0],["Ghana",run?.ghana_opportunity_count || 0],["New",run?.inserted_count || 0],["Updated",run?.updated_count || 0],["Projects",run?.project_count || 0],["Awards",run?.award_count || 0],["Errors",run?.failed_count || 0]];
      return <article key={source.id} className="rounded-[24px] border border-[#17362d]/10 bg-[#fffdf8] p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-[#17362d]">{source.name}</h2><span className={`rounded-full px-2 py-1 text-[9px] font-extrabold tracking-wider ${source.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : source.status === "ERROR" ? "bg-red-100 text-red-800" : "bg-stone-100 text-stone-700"}`}>{connected ? "CONNECTED" : source.status}</span></div><p className="mt-1 text-xs text-[#6d7c75]">{source.organisation}</p></div>{live ? <CheckCircle2 className="text-[#16825f]"/> : <AlertTriangle className="text-[#a37325]"/>}</div>
        <p className={`mt-4 rounded-xl p-3 text-xs ${approved ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}><strong>Source rights: {friendly(source.reuse_status || "permission_unknown")}.</strong> {approved ? "Commercial content ingestion permitted within recorded scope." : source.reuse_status === "official_open_data" ? "Use only the approved structured-data importer; this legacy sync is unavailable." : "Legacy sync is blocked until commercial content reuse rights are verified."} {source.sync_enabled && !approved ? "The legacy enabled flag does not override this safeguard." : ""}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">{[["Integration",friendly(source.integration_type)],["Authentication",source.api_key_required ? "Environment credential" : "Not required"],["Classification",friendly(source.implementation_status)],["Last sync",formatDate(source.last_sync_at)],["Last success",formatDate(source.last_success_at)],["Frequency",source.sync_frequency]].map(([label,value]) => <div key={label} className="rounded-xl bg-[#f3f2e9] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[#7b8983]">{label}</p><p className="mt-1 break-words font-semibold text-[#344f45]">{value}</p></div>)}</div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center sm:grid-cols-7">{statistics.map(([label,value]) => <div key={label} className="rounded-lg border border-[#17362d]/8 p-2"><strong className="block text-sm text-[#17362d]">{value}</strong><span className="text-[8px] uppercase text-[#7b8983]">{label}</span></div>)}</div>
        {source.last_error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-800">{source.last_error}</p>}
        <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy !== "" || !approved} onClick={() => action(source,"test")} className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-bold disabled:opacity-40"><Activity size={13}/>Test Connection</button><button disabled={busy !== "" || !live || !approved || source.status === "PAUSED"} onClick={() => action(source,"sync")} className="inline-flex items-center gap-1 rounded-full bg-[#116149] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><RefreshCw size={13}/>Sync Now</button><button disabled={busy !== "" || (source.status === "PAUSED" && !approved)} onClick={() => action(source,"toggle")} className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-bold disabled:opacity-40">{source.status === "PAUSED" ? <Play size={13}/> : <Pause size={13}/>} {source.status === "PAUSED" ? "Resume" : "Pause"}</button></div>
        <details className="mt-4 rounded-xl border border-[#17362d]/10"><summary className="cursor-pointer px-4 py-3 text-xs font-bold text-[#315b4e]">View Logs</summary><div className="space-y-2 border-t p-3">{source.runs?.length ? source.runs.map((item) => <div key={item.id} className="rounded-lg bg-[#f3f2e9] p-3 text-[11px]"><strong>{item.status}</strong> · {formatDate(item.started_at)} · {item.records_fetched} fetched · {item.failed_count} errors{item.error_summary ? <p className="mt-1 text-red-800">{item.error_summary}</p> : null}</div>) : <p className="text-xs text-[#6d7c75]">No sync runs recorded.</p>}</div></details>
        <div className="mt-4 flex items-center gap-2 text-[10px] text-[#74837c]"><Database size={12}/>{source.api_key_required ? `${source.environment_key_name || "API credential"} required; value hidden.` : "No API credential required."}</div>
      </article>;
    })}</div>
  </section>;
}
