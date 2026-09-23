"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/customer/data";

type Run = { id: string; started_at: string; status: string; mode: string; records_fetched: number; unique_ocids: number; active_count: number; closed_count: number; awarded_count: number; inserted_count: number; updated_count: number; duplicate_count: number; failed_count: number; error_summary: string | null };
type Status = { source: { name: string; registryUrl: string; rights: string; metadataReuse: boolean; commercialReuse: boolean; paused: boolean; limitedPassed: boolean; lastSync: string | null; etag: string | null; configuration: { ocds?: { publisher?: string; ocid_prefix?: string; coverage_start?: string; coverage_end?: string; last_registry_retrieval_date?: string; license_url?: string; publication_policy_url?: string } } }; runs: Run[] };
type Result = { mode: string; recordsRead?: number; uniqueOcids?: number; active?: number; closed?: number; awarded?: number; malformed?: number; inserted?: number; updated?: number; duplicates?: number; rejected?: number; errors?: number; changed?: boolean; lastModified?: string; etag?: string; contentLength?: number; possibleDuplicates?: number };

export function GhanepsOcdsCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() { const next = await api<{ data: Status }>("/api/admin/discovery/ghaneps-ocds"); setStatus(next.data); }
  useEffect(() => { void api<{ data: Status }>("/api/admin/discovery/ghaneps-ocds").then(next => setStatus(next.data)).catch(() => setMessage("OCDS source metadata is not available. Check the database migration.")); }, []);
  async function run(action: "check" | "dry_run" | "limited" | "full" | "pause", paused?: boolean) {
    if (action === "full" && !window.confirm("Run a full GHANEPS OCDS import? Only proceed after validating the limited import and source rights.")) return;
    setBusy(true); setMessage("");
    try {
      const response = await api<{ data: Result }>("/api/admin/discovery/ghaneps-ocds", { action, ...(paused === undefined ? {} : { paused }) }, "POST");
      setResult(response.data); await load(); setMessage(action === "dry_run" ? "Dry run complete; no tenders published." : "Action completed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "OCDS action failed."); }
    finally { setBusy(false); }
  }
  const source = status?.source;
  const meta = source?.configuration?.ocds;
  const canImport = Boolean(source && source.rights !== "permission_unknown" && source.rights !== "prohibited" && source.metadataReuse && source.commercialReuse && !source.paused);
  return <section className="rounded-2xl border border-[#cbded4] bg-white p-5 shadow-sm" aria-labelledby="ocds-heading">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#137154]">Structured open data · separate from Cloudflare discovery</p><h2 id="ocds-heading" className="mt-1 text-xl font-bold">GHANEPS OCDS / Ghana PPA</h2><p className="mt-1 text-sm text-[#53695e]">Monthly registry snapshot. An official listing is not, by itself, a content-reuse licence.</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${canImport ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{canImport ? "Import eligible" : "Publication blocked"}</span></div>
    {message && <p role="status" className="mt-3 rounded-lg bg-[#f3f8f4] p-3 text-sm">{message}</p>}
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <p><b>Publisher</b><br/>{meta?.publisher || "Ghana Public Procurement Authority"}</p><p><b>OCID prefix</b><br/>{meta?.ocid_prefix || "—"}</p><p><b>Dataset coverage</b><br/>{meta?.coverage_start || "—"} – {meta?.coverage_end || "—"}</p><p><b>Last registry retrieval</b><br/>{meta?.last_registry_retrieval_date || "—"}</p>
      <p><b>Rights status</b><br/>{source?.rights?.replaceAll("_", " ") || "—"}</p><p><b>Last BidScope sync</b><br/>{source?.lastSync ? new Date(source.lastSync).toLocaleString() : "Never"}</p><p><b>Limited test</b><br/>{source?.limitedPassed ? "Passed" : "Pending"}</p><p><b>Scheduled sync</b><br/>{source?.paused ? "Paused" : "Monthly check enabled"}</p>
    </div>
    <div className="mt-3 flex flex-wrap gap-3 text-sm"><a className="font-semibold text-[#116149] underline" href={source?.registryUrl || "https://data.open-contracting.org/en/publication/85"} target="_blank" rel="noopener noreferrer">Registry record</a>{meta?.license_url && <a className="font-semibold text-[#116149] underline" href={meta.license_url} target="_blank" rel="noopener noreferrer">Licence page</a>}{meta?.publication_policy_url && <a className="font-semibold text-[#116149] underline" href={meta.publication_policy_url} target="_blank" rel="noopener noreferrer">Publication policy</a>}</div>
    <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void run("check")} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">Check dataset</button><button disabled={busy} onClick={() => void run("dry_run")} className="rounded-full bg-[#0f5b43] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Dry run</button><button disabled={busy || !canImport} onClick={() => void run("limited")} className="rounded-full border border-[#0f5b43] px-4 py-2 text-sm font-bold text-[#0f5b43] disabled:opacity-40">Limited sync · max 20</button><button disabled={busy || !canImport || !source?.limitedPassed} onClick={() => void run("full")} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">Full sync</button><button disabled={busy || !source} onClick={() => void run("pause", !source?.paused)} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">{source?.paused ? "Unpause" : "Pause"} source</button></div>
    {result && <p className="mt-4 rounded-xl bg-[#f3f8f4] p-4 text-sm">{result.mode === "check" ? <>Registry file: {result.changed ? "new or not yet imported" : "unchanged since last import"} · last modified {result.lastModified || "unknown"} · {result.contentLength?.toLocaleString() || "unknown"} compressed bytes · ETag {result.etag || "unavailable"}</> : <>{result.mode}: {result.recordsRead ?? 0} records · {result.uniqueOcids ?? 0} OCIDs · {result.active ?? 0} current active · {result.closed ?? 0} other/closed · {result.awarded ?? 0} awarded/contracted · {result.possibleDuplicates ?? 0} existing OCID links · {result.inserted ?? 0} inserted · {result.updated ?? 0} updated · {result.duplicates ?? 0} duplicate links · {result.malformed ?? 0} malformed · {result.errors ?? 0} errors</>}</p>}
    <details className="mt-5"><summary className="cursor-pointer text-sm font-bold">View sync log</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead><tr>{["Started", "Mode", "Status", "Records", "OCIDs", "Active", "Inserted", "Updated", "Duplicates", "Failed"].map(label => <th key={label} className="border-b p-2">{label}</th>)}</tr></thead><tbody>{status?.runs.map(run => <tr key={run.id}><td className="border-b p-2">{new Date(run.started_at).toLocaleString()}</td><td className="border-b p-2">{run.mode}</td><td className="border-b p-2" title={run.error_summary || ""}>{run.status}</td>{[run.records_fetched,run.unique_ocids,run.active_count,run.inserted_count,run.updated_count,run.duplicate_count,run.failed_count].map((value,i) => <td key={i} className="border-b p-2">{value}</td>)}</tr>)}</tbody></table></div></details>
  </section>;
}
