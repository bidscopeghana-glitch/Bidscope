"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/customer/data";

type Run = { id: string; started_at: string; status: string; mode: string; dataset_hash: string | null; no_change: boolean; records_fetched: number; unique_ocids: number; active_count: number; closed_count: number; awarded_count: number; inserted_count: number; updated_count: number; unchanged_count: number; duplicate_count: number; failed_count: number; error_summary: string | null };
type IntelligenceItem = { name: string; processes: number; awards?: number; contracts?: number; categories?: number; buyers?: number };
type Status = { source: { name: string; registryUrl: string; rights: string; metadataReuse: boolean; commercialReuse: boolean; paused: boolean; limitedPassed: boolean; importCursor: number; lastSync: string | null; etag: string | null; lastModified: string | null; configuration: { ocds?: { publisher?: string; ocid_prefix?: string; coverage_start?: string; coverage_end?: string; last_registry_retrieval_date?: string; license_url?: string; publication_policy_url?: string } } }; runs: Run[]; stats: { processes: number; awards: number; contracts: number; current_open: number } | null; insights: { buyers: IntelligenceItem[]; categories: IntelligenceItem[]; suppliers: IntelligenceItem[] } };
type Result = { mode: string; recordsRead?: number; uniqueOcids?: number; active?: number; closed?: number; awarded?: number; contracts?: number; malformed?: number; inserted?: number; updated?: number; unchanged?: number; duplicates?: number; nextCursor?: number | null; errors?: number; changed?: boolean; lastModified?: string; etag?: string; contentLength?: number; possibleDuplicates?: number };

export function GhanepsOcdsCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() { const next = await api<{ data: Status }>("/api/admin/discovery/ghaneps-ocds"); setStatus(next.data); }
  useEffect(() => { void api<{ data: Status }>("/api/admin/discovery/ghaneps-ocds").then(next => setStatus(next.data)).catch(() => setMessage("OCDS source metadata is not available. Check the database migration.")); }, []);
  async function run(action: "check" | "dry_run" | "limited" | "full" | "pause", paused?: boolean) {
    if (action === "full" && !window.confirm("Import or resume the next 500 GHANEPS historical processes? The live feed receives only genuinely open tenders.")) return;
    setBusy(true); setMessage("");
    try {
      const response = await api<{ data: Result }>("/api/admin/discovery/ghaneps-ocds", { action, ...(paused === undefined ? {} : { paused }) }, "POST");
      setResult(response.data); await load(); setMessage(action === "dry_run" ? "Dry run complete; no tenders published." : "Action completed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "OCDS action failed."); }
    finally { setBusy(false); }
  }
  const source = status?.source;
  const meta = source?.configuration?.ocds;
  const canImport = Boolean(source && source.rights === "official_open_data" && source.metadataReuse && source.commercialReuse && !source.paused);
  return <section className="rounded-2xl border border-[#cbded4] bg-white p-5 shadow-sm" aria-labelledby="ocds-heading">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#137154]">Structured open data · separate from Cloudflare discovery</p><h2 id="ocds-heading" className="mt-1 text-xl font-bold">GHANEPS OCDS / Ghana PPA</h2><p className="mt-1 text-sm text-[#53695e]">Source: GHANEPS / Public Procurement Authority Ghana. Official open-data rights and source provenance remain recorded; documents are linked, not mirrored.</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${canImport ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{canImport ? "ACTIVE" : "Publication blocked"}</span></div>
    {message && <p role="status" className="mt-3 rounded-lg bg-[#f3f8f4] p-3 text-sm">{message}</p>}
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <p><b>Publisher</b><br/>{meta?.publisher || "Ghana Public Procurement Authority"}</p><p><b>OCID prefix</b><br/>{meta?.ocid_prefix || "—"}</p><p><b>Dataset coverage</b><br/>{meta?.coverage_start || "—"} – {meta?.coverage_end || "—"}</p><p><b>Last registry retrieval</b><br/>{meta?.last_registry_retrieval_date || "—"}</p>
      <p><b>Rights status</b><br/>{source?.rights?.replaceAll("_", " ") || "—"}</p><p><b>Last successful sync</b><br/>{source?.lastSync ? new Date(source.lastSync).toLocaleString() : "Never"}</p><p><b>Import progress</b><br/>{source?.importCursor ?? 0} / 7,058 candidate processes</p><p><b>Scheduled sync</b><br/>{source?.paused ? "Paused" : "ACTIVE · monthly check"}</p>
      <p><b>Historical processes</b><br/>{status?.stats?.processes?.toLocaleString() ?? "—"}</p><p><b>Current open tenders</b><br/>{status?.stats?.current_open?.toLocaleString() ?? "—"}</p><p><b>Awards / contracts</b><br/>{status?.stats ? `${status.stats.awards.toLocaleString()} / ${status.stats.contracts.toLocaleString()}` : "—"}</p><p><b>Dataset ETag / update</b><br/>{source?.etag || "—"}<br/>{source?.lastModified || "—"}</p>
      <p className="sm:col-span-2"><b>Dataset SHA-256</b><br/><span className="break-all font-mono text-xs">{status?.runs.find(run => run.dataset_hash)?.dataset_hash || "Not yet recorded"}</span></p>
    </div>
    <div className="mt-3 flex flex-wrap gap-3 text-sm"><a className="font-semibold text-[#116149] underline" href={source?.registryUrl || "https://data.open-contracting.org/en/publication/85"} target="_blank" rel="noopener noreferrer">Registry record</a>{meta?.license_url && <a className="font-semibold text-[#116149] underline" href={meta.license_url} target="_blank" rel="noopener noreferrer">Licence page</a>}{meta?.publication_policy_url && <a className="font-semibold text-[#116149] underline" href={meta.publication_policy_url} target="_blank" rel="noopener noreferrer">Publication policy</a>}</div>
    <div className="mt-4 grid gap-3 md:grid-cols-3">{([ ["Most active buyers", status?.insights?.buyers], ["Leading categories", status?.insights?.categories], ["Historical awardees", status?.insights?.suppliers] ] as const).map(([heading, items]) => <div key={heading} className="rounded-xl bg-[#f3f8f4] p-3"><h3 className="text-sm font-bold">{heading}</h3><ol className="mt-2 space-y-1 text-xs">{items?.map(item => <li key={item.name} className="flex justify-between gap-2"><span className="truncate" title={item.name}>{item.name}</span><b>{item.processes.toLocaleString()}</b></li>)}{!items?.length && <li className="text-[#53695e]">No history imported yet.</li>}</ol></div>)}</div>
    <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void run("check")} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">Check dataset</button><button disabled={busy} onClick={() => void run("dry_run")} className="rounded-full bg-[#0f5b43] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Dry run</button><button disabled={busy || !canImport} onClick={() => void run("limited")} className="rounded-full border border-[#0f5b43] px-4 py-2 text-sm font-bold text-[#0f5b43] disabled:opacity-40">Validate first 20</button><button disabled={busy || !canImport} onClick={() => void run("full")} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">Import / resume next 500</button><button disabled={busy || !source} onClick={() => void run("pause", !source?.paused)} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">{source?.paused ? "Unpause" : "Pause"} source</button></div>
    {result && <p className="mt-4 rounded-xl bg-[#f3f8f4] p-4 text-sm">{result.mode === "check" ? <>Registry file: {result.changed ? "new or not yet imported" : "unchanged since last import"} · last modified {result.lastModified || "unknown"} · {result.contentLength?.toLocaleString() || "unknown"} compressed bytes · ETag {result.etag || "unavailable"}</> : <>{result.mode}: {result.recordsRead ?? 0} records · {result.uniqueOcids ?? 0} OCIDs · {result.active ?? 0} current active · {result.closed ?? 0} other/closed · {result.awarded ?? 0} awarded/contracted · {result.inserted ?? 0} inserted · {result.updated ?? 0} updated · {result.unchanged ?? 0} unchanged · {result.nextCursor === null ? "batch complete" : `next cursor ${result.nextCursor ?? "—"}`} · {result.malformed ?? 0} malformed · {result.errors ?? 0} errors</>}</p>}
    <OcdsHistorySearch />
    <details className="mt-5"><summary className="cursor-pointer text-sm font-bold">View sync log</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead><tr>{["Started", "Mode", "Status", "Records", "OCIDs", "Active", "New", "Updated", "Unchanged", "Duplicate links", "Errors"].map(label => <th key={label} className="border-b p-2">{label}</th>)}</tr></thead><tbody>{status?.runs.map(run => <tr key={run.id}><td className="border-b p-2">{new Date(run.started_at).toLocaleString()}</td><td className="border-b p-2">{run.mode}</td><td className="border-b p-2" title={run.error_summary || ""}>{run.no_change ? "NO CHANGE" : run.status}</td>{[run.records_fetched,run.unique_ocids,run.active_count,run.inserted_count,run.updated_count,run.unchanged_count,run.duplicate_count,run.failed_count].map((value,i) => <td key={i} className="border-b p-2">{value}</td>)}</tr>)}</tbody></table></div></details>
  </section>;
}

type HistoryRow = { ocid: string; title: string; buyer_name: string | null; category: string | null; procurement_method: string | null; latest_release_date: string | null; tender_end_at: string | null; stage: string; value: number | null; currency: string | null; contract_value: number | null; contract_currency: string | null; award_value: number | null; award_currency: string | null; award_count: number; contract_count: number; supplier_names: string[]; original_source_url: string | null; source_attribution: string };
function OcdsHistorySearch() {
  const [filters, setFilters] = useState({ query: "", buyer: "", supplier: "", category: "", year: "", method: "", awarded: "", minValue: "", maxValue: "", currency: "" });
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function search(nextOffset = 0) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      params.set("offset", String(nextOffset));
      const response = await api<{ data: HistoryRow[] }>(`/api/admin/discovery/ghaneps-ocds/history?${params}`);
      setRows(response.data); setOffset(nextOffset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "History search failed."); }
    finally { setLoading(false); }
  }
  return <div className="mt-6 border-t border-[#dbe9df] pt-5">
    <h3 className="text-lg font-bold">Procurement intelligence & history</h3>
    <p className="mt-1 text-sm text-[#53695e]">Search historical public procurement processes separately from current open tenders. These records do not verify a supplier or predict an award.</p>
    <form onSubmit={event => { event.preventDefault(); void search(); }} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {([ ["Search title or OCID", "query"], ["Buyer", "buyer"], ["Supplier / awardee", "supplier"], ["Category", "category"], ["Year", "year"], ["Method", "method"], ["Min contract value", "minValue"], ["Max contract value", "maxValue"], ["Currency", "currency"] ] as const).map(([label, key]) => <label key={key} className="text-xs font-semibold">{label}<input value={filters[key]} onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))} type={key === "year" || key === "minValue" || key === "maxValue" ? "number" : "text"} min={key === "year" ? 2010 : 0} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>)}
      <label className="text-xs font-semibold">Award status<select value={filters.awarded} onChange={event => setFilters(current => ({ ...current, awarded: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="">Any</option><option value="true">Awarded</option><option value="false">Not awarded</option></select></label>
      <button disabled={loading} className="rounded-lg bg-[#0f5b43] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Search history</button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-4 space-y-2">{rows.map(row => <article key={row.ocid} className="rounded-xl border border-[#dbe9df] p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><div><b>{row.title}</b><p className="text-xs text-[#53695e]">{row.ocid} · {row.buyer_name || "Buyer not stated"} · {row.category || "Category not stated"} · {row.stage}</p></div><p className="text-xs">{row.contract_value != null ? `Contract value ${row.contract_currency} ${Number(row.contract_value).toLocaleString()}` : row.award_value != null ? `Award value ${row.award_currency} ${Number(row.award_value).toLocaleString()}` : row.value != null ? `Tender estimate ${row.currency || ""} ${Number(row.value).toLocaleString()}` : "Value not stated"} · {row.award_count} awards · {row.contract_count} contracts</p></div><p className="mt-1 text-xs text-[#53695e]">{row.procurement_method || "Method not stated"} · {row.latest_release_date?.slice(0, 10) || "Date not stated"} · Suppliers: {row.supplier_names?.join(", ") || "not stated"}</p><p className="mt-1 text-xs">Source: {row.source_attribution}{row.original_source_url && <> · <a href={row.original_source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#116149] underline">Original record</a></>}</p></article>)}</div>
    {rows.length > 0 && <div className="mt-3 flex gap-2"><button disabled={loading || offset === 0} onClick={() => void search(Math.max(0, offset - 25))} className="rounded-full border px-3 py-1 text-sm disabled:opacity-40">Previous</button><button disabled={loading || rows.length < 25} onClick={() => void search(offset + 25)} className="rounded-full border px-3 py-1 text-sm disabled:opacity-40">Next</button></div>}
  </div>;
}
