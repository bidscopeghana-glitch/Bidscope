"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Flame,
  Globe2,
  Mail,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { api, invalidate, useData } from "@/components/customer/data";
import { getValidAccessToken } from "@/lib/client/session";

const nav = [
  [/^\/admin\/outreach$/, "Overview", "/admin/outreach"],
  [/\/import/, "Imports", "/admin/outreach/import"],
  [/\/prospects/, "Prospects", "/admin/outreach/prospects"],
  [/\/campaigns/, "Campaigns", "/admin/outreach/campaigns"],
  [/\/settings/, "Settings", "/admin/outreach/settings"],
] as const;
function Header({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#16805e]">
            BidScope Outreach
          </p>
          <h1 className="serif mt-2 text-4xl text-[#17362d] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#64766e]">
            {description}
          </p>
        </div>
        {action}
      </div>
      <nav className="mt-7 flex gap-1 overflow-x-auto rounded-2xl border border-[#17362d]/10 bg-white p-1.5 shadow-sm">
        {nav.map(([, label, href]) => (
          <Link
            key={href}
            href={href}
            className="whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold text-[#52675e] hover:bg-[#e9f1e8] hover:text-[#0d4939]"
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-[1500px] px-5 py-9 lg:px-8">
      {children}
    </section>
  );
}
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[24px] border border-[#17362d]/10 bg-[#fffdf8] p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}
function Status({ value }: { value: string }) {
  const safe = value.replaceAll("_", " ");
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${["complete", "approved", "sending", "eligible"].includes(value) ? "bg-emerald-100 text-emerald-800" : ["failed", "cancelled"].includes(value) ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}
    >
      {safe}
    </span>
  );
}

type Overview = {
  metrics: Record<string, number>;
  countries: Array<{ name: string; value: number }>;
  industries: Array<{ name: string; value: number }>;
};
export function OutreachDashboard() {
  const result = useData<{ data: Overview }>("/api/admin/outreach/overview"),
    data = result.data?.data;
  const metrics = [
    ["total", "Total prospects", UsersRound],
    ["emails", "With email", Mail],
    ["countries", "Countries", Globe2],
    ["hot", "Hot prospects", Flame],
    ["campaigns", "Campaigns active", PlayCircle],
    ["delivered", "Delivered", CheckCircle2],
    ["clicks", "Clicked", ArrowRight],
    ["unsubscribes", "Unsubscribed", ShieldCheck],
  ] as const;
  return (
    <Shell>
      <Header
        title="Outreach intelligence"
        description="Turn verified business datasets into controlled, relevant campaigns—with human approval at every sending boundary."
        action={
          <Link
            href="/admin/outreach/import"
            className="inline-flex items-center gap-2 rounded-full bg-[#0d4939] px-5 py-3 text-sm font-bold text-white"
          >
            <UploadCloud size={17} />
            Import prospect file
          </Link>
        }
      />
      {result.error ? (
        <Card className="mt-6 text-red-700">{result.error}</Card>
      ) : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([key, label, Icon]) => (
          <Card key={key}>
            <div className="flex items-center justify-between">
              <Icon size={18} className="text-[#16805e]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#7b8983]">
                Live
              </span>
            </div>
            <strong className="mt-4 block text-3xl">
              {data?.metrics[key] ?? "—"}
            </strong>
            <span className="mt-1 block text-xs text-[#6d7c75]">{label}</span>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Bar title="Prospects by industry" data={data?.industries || []} />
        <Bar title="Prospects by country" data={data?.countries || []} />
      </div>
      <Card className="mt-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Conversion funnel</h2>
            <p className="mt-1 text-xs text-[#6d7c75]">
              Prospects → contacted → clicked → registered → paid
            </p>
          </div>
          <BarChart3 className="text-[#16805e]" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Prospects", data?.metrics.total],
            ["Contacted", data?.metrics.sent],
            ["Clicked", data?.metrics.clicks],
            ["Registered", 0],
            ["Paid", 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-[#edf3ed] p-4">
              <strong className="text-2xl">{value ?? 0}</strong>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#708078]">
                {label}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </Shell>
  );
}
function Bar({
  title,
  data,
}: {
  title: string;
  data: Array<{ name: string; value: number }>;
}) {
  const max = Math.max(...data.map((x) => x.value), 1);
  return (
    <Card>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-5 space-y-3">
        {data.length ? (
          data.slice(0, 8).map((item) => (
            <div key={item.name}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{item.name}</span>
                <strong>{item.value}</strong>
              </div>
              <div className="h-2 rounded-full bg-[#e3e9e3]">
                <div
                  className="h-full rounded-full bg-[#16805e]"
                  style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[#708078]">
            Data will appear after your first approved import.
          </p>
        )}
      </div>
    </Card>
  );
}

type ImportJob = {
  id: string;
  original_filename: string;
  file_size_bytes: number;
  status: string;
  stage: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  duplicate_rows: number;
  warning_message?: string;
  created_at: string;
  summary?: Record<string, unknown>;
};
export function OutreachImportCentre() {
  const imports = useData<{ data: ImportJob[] }>("/api/admin/outreach/imports"),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage("Uploading securely…");
    try {
      const token = await getValidAccessToken();
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/outreach/imports", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Upload failed");
      setMessage("Uploaded. Starting server-side analysis…");
      await api("/api/admin/outreach/process", {}, "POST");
      setMessage(
        "Analysis complete. Review the detected mapping before approval.",
      );
      invalidate();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  async function approve(id: string) {
    setBusy(true);
    try {
      await api(
        `/api/admin/outreach/imports/${id}`,
        { action: "approve" },
        "PATCH",
      );
      setMessage(
        "Import approved. Writing clean prospects and suggested segments…",
      );
      await api("/api/admin/outreach/process", {}, "POST");
      setMessage("Import completed.");
      invalidate();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import approval failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <Header
        title="Import centre"
        description="Upload CSV, XLSX or XLS files. BidScope stages and analyses every row before anything reaches the production prospect database."
      />
      <div className="mt-6 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Card>
          <label className="grid min-h-64 cursor-pointer place-items-center rounded-[20px] border-2 border-dashed border-[#16805e]/35 bg-[#eef5ef] p-8 text-center">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <span>
              <UploadCloud className="mx-auto text-[#16805e]" size={38} />
              <strong className="mt-4 block text-lg">
                {file ? file.name : "Drop a prospect file here"}
              </strong>
              <small className="mt-2 block text-[#687a71]">
                CSV, XLSX or XLS · up to 50 MB
              </small>
            </span>
          </label>
          <button
            disabled={!file || busy}
            onClick={upload}
            className="mt-4 w-full rounded-xl bg-[#0d4939] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {busy ? "Processing…" : "Upload and analyse"}
          </button>
          {message ? (
            <p className="mt-3 text-xs leading-5 text-[#536b60]">{message}</p>
          ) : null}
          <div className="mt-5 rounded-2xl border border-amber-700/15 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            <strong>Safe staging:</strong> uploads never become prospects until
            you review the mapping and approve the import.
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Recent imports</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b text-[#73817b]">
                  <th className="py-3">File</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Accepted</th>
                  <th>Rejected</th>
                  <th>Duplicates</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {imports.data?.data.map((item) => (
                  <tr key={item.id} className="border-b border-[#17362d]/7">
                    <td className="py-4">
                      <strong>{item.original_filename}</strong>
                      {item.warning_message ? (
                        <span className="mt-1 flex items-center gap-1 text-amber-700">
                          <AlertTriangle size={12} />
                          {item.warning_message}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <Status value={item.status} />
                    </td>
                    <td>{item.total_rows}</td>
                    <td>{item.accepted_rows}</td>
                    <td>{item.rejected_rows}</td>
                    <td>{item.duplicate_rows}</td>
                    <td>
                      {item.status === "mapping_required" ? (
                        <button
                          disabled={busy}
                          onClick={() => approve(item.id)}
                          className="rounded-lg bg-[#16805e] px-3 py-2 font-bold text-white"
                        >
                          Approve mapping & import
                        </button>
                      ) : (
                        new Date(item.created_at).toLocaleDateString("en-GB")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!imports.data?.data.length ? (
              <p className="py-8 text-center text-sm text-[#708078]">
                No prospect files imported yet.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </Shell>
  );
}

type Prospect = {
  id: string;
  company_name: string;
  email: string | null;
  country_code: string | null;
  industry: string | null;
  priority: string;
  bidscope_fit_score: number;
  lifecycle_stage: string;
  tender_activity_count: number;
  award_count: number;
};
export function OutreachProspects() {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    url = useMemo(
      () =>
        `/api/admin/outreach/prospects?pageSize=50${search ? `&q=${encodeURIComponent(search)}` : ""}`,
      [search],
    ),
    result = useData<{ data: Prospect[]; meta: { total: number } }>(url);
  return (
    <Shell>
      <Header
        title="Prospect CRM"
        description="Search, qualify and segment procurement-active businesses without exposing this intelligence to customer accounts."
      />
      <Card className="mt-6">
        <div className="flex flex-wrap justify-between gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q);
            }}
            className="flex min-w-72 flex-1 gap-2"
          >
            <label className="flex flex-1 items-center gap-2 rounded-xl border bg-white px-3">
              <Search size={16} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Company or email"
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
            </label>
            <button className="rounded-xl bg-[#0d4939] px-5 text-sm font-bold text-white">
              Search
            </button>
          </form>
          <span className="rounded-xl bg-[#e9f1e8] px-4 py-3 text-xs font-bold">
            {result.data?.meta.total || 0} prospects
          </span>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead>
              <tr className="border-b text-[#718078]">
                <th className="py-3">Company</th>
                <th>Industry</th>
                <th>Country</th>
                <th>Score</th>
                <th>Priority</th>
                <th>Tenders</th>
                <th>Awards</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {result.data?.data.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[#17362d]/7 hover:bg-[#f4f7f2]"
                >
                  <td className="py-4">
<Link href={`/admin/outreach/prospects/${p.id}`} className="block text-sm font-bold text-[#0d4939] hover:underline">{p.company_name}</Link>
                    <span className="text-[#718078]">
                      {p.email || "No email"}
                    </span>
                  </td>
                  <td>{p.industry || "Other"}</td>
                  <td>{p.country_code || "—"}</td>
                  <td>
                    <strong>{p.bidscope_fit_score}</strong>/100
                  </td>
                  <td>
                    <Status value={p.priority} />
                  </td>
                  <td>{p.tender_activity_count}</td>
                  <td>{p.award_count}</td>
                  <td>{p.lifecycle_stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Shell>
  );
}

type Campaign = {
  id: string;
  name: string;
  state: string;
  recipient_limit: number | null;
  campaign_recipients: Array<{ status: string }>;
  campaign_steps: Array<unknown>;
};
export function OutreachCampaigns() {
  const result = useData<{ data: Campaign[] }>("/api/admin/outreach/campaigns"),
    segments = useData<{ data: Array<{ id: string; name: string }> }>(
      "/api/admin/outreach/segments",
    ),
    [show, setShow] = useState(false),
    [message, setMessage] = useState("");
  async function create(form: FormData) {
    const name = String(form.get("name") || ""),
      segmentId = String(form.get("segment") || "") || null,
      recipientLimit = Number(form.get("limit") || 50);
    const base = `<p>Hi {{first_name}},</p><p>Businesses in {{industry}} often spend significant time finding and assessing relevant procurement opportunities.</p><p>BidScope helps {{company_name}} discover public-sector opportunities and make better-informed bidding decisions.</p><p><a href="{{cta_url}}">Explore relevant opportunities</a></p>`;
    await api(
      "/api/admin/outreach/campaigns",
      {
        name,
        targetSegmentId: segmentId,
        recipientLimit,
        objective: "Qualified registrations",
        ctaLabel: "Explore opportunities",
        ctaUrl: "https://www.bidscopeghana.com/opportunities",
        subjectA: "Procurement opportunities for {{company_name}}",
        subjectB: "Find relevant {{industry}} opportunities sooner",
        abTestPercent: 20,
        steps: [
          {
            delayDays: 0,
            subject: "Procurement opportunities for {{company_name}}",
            htmlBody: base,
          },
          {
            delayDays: 4,
            subject: "A faster way to assess procurement opportunities",
            htmlBody: base,
          },
          {
            delayDays: 9,
            subject: "Should we keep you updated?",
            htmlBody: base,
          },
        ],
      },
      "POST",
    );
    setShow(false);
    setMessage(
      "Draft campaign created. It cannot send until review, approval and a separate start action.",
    );
    invalidate();
  }
  async function action(id: string, value: string) {
    try {
      await api(
        `/api/admin/outreach/campaigns/${id}`,
        { action: value },
        "PATCH",
      );
      setMessage(`Campaign ${value.replaceAll("_", " ")} completed.`);
      invalidate();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed");
    }
  }
  return (
    <Shell>
      <Header
        title="Campaign studio"
        description="Build sector-specific sequences, review eligibility and retain a deliberate two-step approve-and-start workflow."
        action={
          <button
            onClick={() => setShow(!show)}
            className="inline-flex items-center gap-2 rounded-full bg-[#0d4939] px-5 py-3 text-sm font-bold text-white"
          >
            <Plus size={17} />
            New campaign
          </button>
        }
      />
      {message ? (
        <div className="mt-5 rounded-2xl border bg-white p-4 text-sm">
          {message}
        </div>
      ) : null}
      {show ? (
        <Card className="mt-5">
          <form action={create} className="grid gap-4 md:grid-cols-3">
            <label className="text-xs font-bold">
              Campaign name
              <input
                name="name"
                required
                defaultValue="Ghana Construction Pilot"
                className="mt-2 w-full rounded-xl border bg-white px-3 py-3 font-normal"
              />
            </label>
            <label className="text-xs font-bold">
              Audience segment
              <select
                name="segment"
                className="mt-2 w-full rounded-xl border bg-white px-3 py-3 font-normal"
              >
                <option value="">All eligible prospects</option>
                {segments.data?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold">
              Recipient limit
              <input
                name="limit"
                type="number"
                min="1"
                defaultValue="50"
                className="mt-2 w-full rounded-xl border bg-white px-3 py-3 font-normal"
              />
            </label>
            <button className="rounded-xl bg-[#16805e] px-5 py-3 text-sm font-bold text-white md:col-span-3">
              Create safe 3-email draft
            </button>
          </form>
        </Card>
      ) : null}
      <div className="mt-6 grid gap-4">
        {result.data?.data.map((c) => {
          const counts = c.campaign_recipients.reduce<Record<string, number>>(
            (a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a),
            {},
          );
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Status value={c.state} />
                  <h2 className="mt-3 text-xl font-bold">{c.name}</h2>
                  <p className="mt-1 text-xs text-[#718078]">
                    {c.campaign_steps.length} steps ·{" "}
                    {counts.eligible || counts.active || 0} eligible ·{" "}
                    {counts.suppressed || 0} suppressed · limit{" "}
                    {c.recipient_limit || "none"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.state === "draft" ? (
                    <button
                      onClick={() => action(c.id, "submit_review")}
                      className="rounded-xl border px-4 py-2 text-xs font-bold"
                    >
                      Submit for review
                    </button>
                  ) : null}
                  {c.state === "needs_review" ? (
                    <button
                      onClick={() => action(c.id, "approve")}
                      className="rounded-xl bg-[#16805e] px-4 py-2 text-xs font-bold text-white"
                    >
                      Approve campaign
                    </button>
                  ) : null}
                  {c.state === "approved" ? (
                    <button
                      onClick={() => action(c.id, "start")}
                      className="rounded-xl bg-[#0d4939] px-4 py-2 text-xs font-bold text-white"
                    >
                      Start campaign
                    </button>
                  ) : null}
                  {c.state === "sending" ? (
                    <button
                      onClick={() => action(c.id, "pause")}
                      className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-xs font-bold"
                    >
                      <PauseCircle size={14} />
                      Pause
                    </button>
                  ) : null}
                  {c.state === "paused" ? (
                    <button
                      onClick={() => action(c.id, "resume")}
                      className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-xs font-bold"
                    >
                      <PlayCircle size={14} />
                      Resume
                    </button>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Shell>
  );
}

export function OutreachSettings() {
  const result = useData<{
      data: { settings: Record<string, unknown>; senders: unknown[] };
    }>("/api/admin/outreach/settings"),
    [message, setMessage] = useState("");
  const settings = result.data?.data.settings;
  async function save(form: FormData) {
    const payload = {
      hourly_limit: Number(form.get("hourly")),
      daily_limit: Number(form.get("daily")),
      batch_size: Number(form.get("batch")),
      batch_delay_minutes: Number(form.get("delay")),
      minimum_campaign_gap_days: Number(form.get("gap")),
      sending_enabled: form.get("sending") === "on",
      emergency_stop: form.get("stop") === "on",
    };
    await api("/api/admin/outreach/settings", payload, "PATCH");
    setMessage("Outreach safety settings updated and audited.");
    invalidate();
  }
  return (
    <Shell>
      <Header
        title="Outreach settings"
        description="Control provider-independent sending limits, frequency protection and the platform-wide emergency stop."
      />
      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_.7fr]">
        <Card>
          <form action={save} className="grid gap-5 sm:grid-cols-2">
            {[
              ["hourly", "Maximum per hour", settings?.hourly_limit || 50],
              ["daily", "Maximum per day", settings?.daily_limit || 300],
              ["batch", "Batch size", settings?.batch_size || 25],
              [
                "delay",
                "Delay between batches (minutes)",
                settings?.batch_delay_minutes || 10,
              ],
              [
                "gap",
                "Minimum campaign gap (days)",
                settings?.minimum_campaign_gap_days || 14,
              ],
            ].map(([name, label, value]) => (
              <label key={String(name)} className="text-xs font-bold">
                {String(label)}
                <input
                  name={String(name)}
                  type="number"
                  min="1"
                  defaultValue={Number(value)}
                  className="mt-2 w-full rounded-xl border bg-white px-3 py-3 font-normal"
                />
              </label>
            ))}
            <label className="flex items-center justify-between rounded-2xl border p-4 text-sm font-bold">
              <span>
                Enable controlled sending
                <small className="mt-1 block font-normal text-[#718078]">
                  Campaigns still require approve + start.
                </small>
              </span>
              <input
                name="sending"
                type="checkbox"
                defaultChecked={Boolean(settings?.sending_enabled)}
                className="size-5"
              />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-red-700/20 bg-red-50 p-4 text-sm font-bold text-red-900">
              <span>
                Emergency stop
                <small className="mt-1 block font-normal">
                  Immediately blocks queue claims.
                </small>
              </span>
              <input
                name="stop"
                type="checkbox"
                defaultChecked={settings?.emergency_stop !== false}
                className="size-5"
              />
            </label>
            <button className="rounded-xl bg-[#0d4939] px-5 py-3 text-sm font-bold text-white sm:col-span-2">
              Save safety settings
            </button>
            {message ? (
              <p className="text-sm text-emerald-800 sm:col-span-2">
                {message}
              </p>
            ) : null}
          </form>
        </Card>
        <Card>
          <Settings2 className="text-[#16805e]" />
          <h2 className="mt-4 text-xl font-bold">Provider status</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between border-b pb-3">
              <dt>Provider</dt>
              <dd className="font-bold">Resend</dd>
            </div>
            <div className="flex justify-between border-b pb-3">
              <dt>Sender identities</dt>
              <dd className="font-bold">
                {result.data?.data.senders.length || 0}
              </dd>
            </div>
            <div className="flex justify-between border-b pb-3">
              <dt>Emergency stop</dt>
              <dd className="font-bold">
                {settings?.emergency_stop !== false ? "Active" : "Released"}
              </dd>
            </div>
          </dl>
          <p className="mt-5 rounded-2xl bg-[#eef5ef] p-4 text-xs leading-5 text-[#536b60]">
            Domain verification and a signed Resend webhook are required before
            production sending should be enabled.
          </p>
        </Card>
      </div>
    </Shell>
  );
}
