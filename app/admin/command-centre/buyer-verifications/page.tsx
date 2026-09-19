"use client";
import { useState } from "react";
import { BadgeCheck, Building2, FileCheck2, ShieldAlert } from "lucide-react";
import { api, invalidate, useData } from "@/components/customer/data";

type Verification = {
  id: string;
  organization_id: string;
  organization_name: string;
  registration_number: string;
  official_company_email: string;
  contact_person: string;
  organization_type: string | null;
  document_paths: string[];
  status: string;
  submitted_at: string | null;
  verification_notes: string | null;
};
export default function BuyerVerificationPage() {
  const [status, setStatus] = useState("pending"),
    [busy, setBusy] = useState<string | null>(null),
    [message, setMessage] = useState("");
  const result = useData<{ data: Verification[] }>(
    `/api/admin/buyer-verifications?status=${status}`,
  );
  async function decide(
    item: Verification,
    decision: "verified" | "rejected" | "suspended",
  ) {
    const notes =
      decision === "verified"
        ? "Identity and organisation evidence reviewed."
        : window.prompt(`Reason for ${decision}`) || "";
    if (decision !== "verified" && !notes) return;
    setBusy(item.id);
    setMessage("");
    try {
      await api("/api/admin/buyer-verifications", {
        id: item.id,
        decision,
        notes,
      });
      invalidate();
      setMessage(`${item.organization_name} marked ${decision}.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="p-5 sm:p-8">
      <div className="flex flex-col gap-5 rounded-[28px] bg-[#0b4434] p-7 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#e5c862]">
            Buyer trust & safety
          </p>
          <h1 className="mt-2 text-3xl font-bold">Buyer verification</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
            Approve real procuring organisations before they can publish
            BidScope-hosted tenders.
          </p>
        </div>
        <BadgeCheck size={46} />
      </div>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {["pending", "verified", "rejected", "suspended"].map((value) => (
          <button
            className={`rounded-full px-4 py-2 text-sm font-bold ${status === value ? "bg-[#116149] text-white" : "border border-[#17362d]/12 bg-white text-[#315b4e]"}`}
            key={value}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {value.replace("_", " ")}
          </button>
        ))}
      </div>
      {message && (
        <p className="mt-5 rounded-xl bg-white p-4 text-sm font-semibold">
          {message}
        </p>
      )}
      {result.loading ? (
        <div className="mt-6 rounded-2xl bg-white p-7">
          Loading verification queue…
        </div>
      ) : result.error ? (
        <div className="mt-6 rounded-2xl bg-red-50 p-7 text-red-700">
          {result.error}
        </div>
      ) : !result.data?.data.length ? (
        <div className="mt-6 grid place-items-center rounded-[24px] bg-white p-12 text-center">
          <FileCheck2 size={34} />
          <h2 className="mt-3 text-xl font-bold">
            No {status} verification requests
          </h2>
          <p className="mt-2 text-sm text-[#64766e]">
            Requests will appear here when buyers submit their organisation
            evidence.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {result.data.data.map((item) => (
            <article
              className="rounded-[24px] border border-[#17362d]/10 bg-white p-6 shadow-sm"
              key={item.id}
            >
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-[#e7f0ea] p-2 text-[#116149]">
                  <Building2 size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold">
                    {item.organization_name}
                  </h2>
                  <span className="text-xs text-[#687a72]">
                    {item.organization_type ||
                      "Organisation type not specified"}
                  </span>
                </div>
                <strong className="rounded-full bg-[#e8f2eb] px-3 py-1 text-[10px] uppercase text-[#116149]">
                  {item.status}
                </strong>
              </div>
              <dl className="mt-5 grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-[#718078]">Registration</dt>
                <dd className="font-semibold">{item.registration_number}</dd>
                <dt className="text-[#718078]">Official email</dt>
                <dd className="break-all font-semibold">
                  {item.official_company_email}
                </dd>
                <dt className="text-[#718078]">Contact</dt>
                <dd>{item.contact_person}</dd>
                <dt className="text-[#718078]">Documents</dt>
                <dd>{item.document_paths.length}</dd>
                <dt className="text-[#718078]">Submitted</dt>
                <dd>
                  {item.submitted_at
                    ? new Date(item.submitted_at).toLocaleString("en-GB")
                    : "Not submitted"}
                </dd>
              </dl>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-[#116149] px-4 py-2 text-sm font-bold text-white"
                  disabled={busy === item.id}
                  onClick={() => void decide(item, "verified")}
                >
                  <BadgeCheck size={15} />
                  Verify
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700"
                  disabled={busy === item.id}
                  onClick={() => void decide(item, "rejected")}
                >
                  <ShieldAlert size={15} />
                  Reject
                </button>
                <button
                  className="rounded-xl border border-[#17362d]/15 px-4 py-2 text-sm font-bold"
                  disabled={busy === item.id}
                  onClick={() => void decide(item, "suspended")}
                >
                  Suspend
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
