"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  MessageSquareText,
  Scale,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { api, invalidate, useData } from "@/components/customer/data";

type Tender = {
  id: string;
  title: string;
  currency: string;
  award_structure: string;
  approval_required: boolean;
  status: string;
  submission_deadline: string;
  lots?: Array<{ id: string; lot_number: string; title: string }>;
};
type Bid = {
  id: string;
  tender_id: string;
  supplier_organization_id: string;
  status: string;
  bid_price: number | null;
  currency: string;
  delivery_period: string | null;
  bid_validity_days: number | null;
  submitted_at: string | null;
  technical_response?: string;
  methodology_response?: string;
  experience_response?: string;
  supplier?: { id: string; name: string } | null;
};
type Award = {
  id: string;
  approval_status: string;
  contract_value: number;
  currency: string;
  award_date: string;
  award_notes: string;
  supplier?: { name: string } | null;
};
type LotModel = {
  tenderId: string;
  currency: string;
  lots: Array<{ id: string; lot_number: string; title: string }>;
  excludedOffers: number;
  scenarios: Array<{
    name: string;
    method: string;
    total: number;
    supplierCount: number;
    allocations: Array<{ lotId: string; supplierName: string; price: number }>;
  }>;
};

export function ProcurementBidInbox() {
  const params = useSearchParams(),
    router = useRouter(),
    tenderId = params.get("tender") || "",
    tenders = useData<{ data: Tender[] }>("/api/procurement?resource=tenders"),
    detail = useData<{ data: Tender }>(
      tenderId ? `/api/procurement?resource=tender&id=${tenderId}` : null,
    ),
    result = useData<{
      data: Bid[];
      meta: { sealed: boolean; deadline: string };
    }>(tenderId ? `/api/procurement?resource=bids&tenderId=${tenderId}` : null),
    awards = useData<{ data: Award[] }>(
      tenderId ? `/api/procurement?resource=awards&tenderId=${tenderId}` : null,
    ),
    [selected, setSelected] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [statusFilter, setStatusFilter] = useState("all"),
    [sort, setSort] = useState("submitted"),
    [showCompare, setShowCompare] = useState(false),
    [maxLotsPerSupplier, setMaxLotsPerSupplier] = useState(30),
    [minSuppliers, setMinSuppliers] = useState(1),
    [budgetCap, setBudgetCap] = useState(""),
    [lotModel, setLotModel] = useState<LotModel | null>(null),
    [modelling, setModelling] = useState(false),
    [message, setMessage] = useState("");
  const tender = detail.data?.data;
  const visibleBids = [...(result.data?.data || [])]
    .filter((bid) => statusFilter === "all" || bid.status === statusFilter)
    .filter((bid) => (bid.supplier?.name || "").toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sort === "price") return (a.bid_price ?? Number.MAX_SAFE_INTEGER) - (b.bid_price ?? Number.MAX_SAFE_INTEGER);
      if (sort === "supplier") return (a.supplier?.name || "").localeCompare(b.supplier?.name || "");
      return Date.parse(b.submitted_at || "") - Date.parse(a.submitted_at || "");
    });
  async function decide(
    bid: Bid,
    decision:
      | "shortlist"
      | "clarification"
      | "interview"
      | "unsuccessful"
      | "under_review",
  ) {
    try {
      await api("/api/procurement", {
        action: "shortlist",
        tenderId: bid.tender_id,
        bidId: bid.id,
        lotId: null,
        decision,
        note: "",
      });
      setMessage(`Supplier marked ${decision.replaceAll("_", " ")}.`);
      invalidate();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function award(bid: Bid) {
    const value = window.prompt("Contract value", String(bid.bid_price || ""));
    if (value == null || Number.isNaN(Number(value))) return;
    let lotIds: string[] = [];
    if (tender?.award_structure === "lots") {
      const available = (tender.lots || []).map((lot) => lot.lot_number).join(", ");
      const chosen = window.prompt(
        `Enter the lot number(s) to award, separated by commas. Available: ${available}`,
      );
      if (!chosen) return;
      const numbers = chosen.split(",").map((item) => item.trim()).filter(Boolean);
      lotIds = (tender.lots || [])
        .filter((lot) => numbers.includes(lot.lot_number))
        .map((lot) => lot.id);
      if (lotIds.length !== new Set(numbers).size) {
        setMessage("Choose only valid lot numbers from this tender.");
        return;
      }
    }
    try {
      await api("/api/procurement", {
        action: "award",
        tenderId: bid.tender_id,
        bidId: bid.id,
        supplierOrganizationId: bid.supplier_organization_id,
        lotIds,
        contractValue: Number(value),
        currency: bid.currency,
        awardDate: new Date().toISOString().slice(0, 10),
        expectedStartDate: null,
        expectedEndDate: null,
        awardNotes: "",
        submitForApproval: Boolean(tender?.approval_required),
      });
      setMessage(
        tender?.approval_required
          ? "Award recommendation sent for approval."
          : "Award recommendation approved and ready for finalisation.",
      );
      invalidate();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function requestClarification(bid: Bid) {
    const subject = window.prompt("Clarification subject");
    if (!subject) return;
    const clarification = window.prompt("What must the supplier clarify?");
    if (!clarification) return;
    try {
      await api("/api/procurement", {
        action: "clarification",
        tenderId: bid.tender_id,
        bidId: bid.id,
        recipientOrganizationId: bid.supplier_organization_id,
        subject,
        message: clarification,
        responseDeadline: null,
      });
      setMessage("Clarification request sent securely to the supplier.");
      invalidate();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function approveAward(awardId: string, approve: boolean) {
    const note = window.prompt(
      approve ? "Optional approval note" : "Reason for rejecting this award",
    );
    if (!approve && !note) return;
    try {
      await api("/api/procurement", {
        action: "approve_award",
        awardId,
        approve,
        note: note || undefined,
      });
      setMessage(approve ? "Award approved and ready for finalisation." : "Award rejected.");
      invalidate();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function finalizeAwards() {
    if (!tender || !window.confirm("Finalise all approved awards and notify every bidder? This closes the tender.")) return;
    try {
      await api("/api/procurement", {
        action: "finalize_awards",
        tenderId: tender.id,
      });
      setMessage("Awards finalised. Winning and unsuccessful suppliers were notified.");
      invalidate();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function compareLots() {
    if (!tender) return;
    setModelling(true);
    setLotModel(null);
    try {
      const response = await api<{ data: Omit<LotModel, "tenderId"> }>("/api/procurement", {
        action: "model_lot_awards",
        tenderId: tender.id,
        maxLotsPerSupplier,
        minSuppliers,
        budgetCap: budgetCap.trim() ? Number(budgetCap) : null,
      });
      setLotModel({ ...response.data, tenderId: tender.id });
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setModelling(false);
    }
  }
  return (
    <>
      <div className="pw-hero pw-hero-tenders">
        <p className="pw-eyebrow">SECURE BID INBOX</p>
        <h1>Bids received</h1>
        <p>
          Compare submitted evidence, shortlist suppliers, schedule interviews
          and prepare a human-approved award.
        </p>
      </div>
      <section className="pw-card mt-5">
        <label className="block text-sm font-bold">
          Tender
          <select
            className="mt-2 w-full rounded-xl border bg-white p-3"
            value={tenderId}
            onChange={(e) =>
              router.push(`/procurement/bids?tender=${e.target.value}`)
            }
          >
            <option value="">Choose a tender</option>
            {tenders.data?.data.map((t) => (
              <option value={t.id} key={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      </section>
      {message && (
        <p
          className={
            /marked|created|approval/.test(message) ? "pw-notice" : "pw-error"
          }
        >
          {message}
        </p>
      )}
      {!!awards.data?.data.length && (
        <section className="pw-card mt-5">
          <h2>Award recommendations</h2>
          <p>
            Approval and finalisation are separate human decisions. BidScope records
            the approver, timestamp and outcome for the audit trail.
          </p>
          {awards.data.data.map((award) => (
            <div className="pw-row" key={award.id}>
              <span>
                <strong>{award.supplier?.name || "Supplier"}</strong>
                <small>
                  {award.currency}{" "}
                  {Number(award.contract_value).toLocaleString()}
                  {" · "}
                  {award.approval_status.replaceAll("_", " ")}
                </small>
              </span>
              {award.approval_status === "pending" && (
                <span className="pw-actions">
                  <button
                    className="pw-button primary"
                    onClick={() => void approveAward(award.id, true)}
                  >
                    Approve recommendation
                  </button>
                  <button
                    className="pw-button"
                    onClick={() => void approveAward(award.id, false)}
                  >
                    Reject
                  </button>
                </span>
              )}
            </div>
          ))}
          {awards.data.data.some((award) => award.approval_status === "approved") &&
            !awards.data.data.some((award) => award.approval_status === "pending") &&
            tender?.status !== "awarded" && (
              <button className="pw-button gold mt-5" onClick={() => void finalizeAwards()}>
                <Trophy size={14} />
                Finalise approved awards
              </button>
            )}
        </section>
      )}
      {!tenderId ? (
        <section className="pw-empty">
          <Scale size={34} />
          <h2>Choose a tender</h2>
          <p>Select a tender to open its secure bid inbox.</p>
        </section>
      ) : result.loading ? (
        <div className="pw-card" aria-busy="true">
          Loading submitted bids…
        </div>
      ) : result.error ? (
        <p className="pw-error">{result.error}</p>
      ) : result.data?.meta.sealed ? (
        <section className="pw-empty">
          <ShieldCheck size={35} />
          <h2>Bids remain sealed</h2>
          <p>
            Protected content stays inaccessible until{" "}
            {new Date(result.data.meta.deadline).toLocaleString("en-GB")}.
          </p>
        </section>
      ) : !result.data?.data.length ? (
        <section className="pw-empty">
          <Scale size={34} />
          <h2>No bids have been received yet</h2>
          <p>Submitted supplier bids will appear here.</p>
        </section>
      ) : (
        <>
          {tender?.award_structure === "lots" && (
            <section className="pw-card mt-5">
              <h2>Compare lot allocations</h2>
              <p>Explore listed lot prices after bid opening. This is not an eligibility check, a compliant-bid ranking, or an award decision.</p>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm font-bold">Maximum lots per supplier
                  <input className="mt-2 w-full rounded-xl border bg-white p-3" type="number" min="1" max="30" value={maxLotsPerSupplier} onChange={(event) => setMaxLotsPerSupplier(Number(event.target.value))} />
                </label>
                <label className="text-sm font-bold">Minimum suppliers
                  <input className="mt-2 w-full rounded-xl border bg-white p-3" type="number" min="1" max="30" value={minSuppliers} onChange={(event) => setMinSuppliers(Number(event.target.value))} />
                </label>
                <label className="text-sm font-bold">Budget cap ({tender.currency}, optional)
                  <input className="mt-2 w-full rounded-xl border bg-white p-3" type="number" min="0" step="0.01" value={budgetCap} onChange={(event) => setBudgetCap(event.target.value)} placeholder="No cap" />
                </label>
              </div>
              <button className="pw-button primary mt-4" disabled={modelling || maxLotsPerSupplier < 1 || minSuppliers < 1} onClick={() => void compareLots()}>
                {modelling ? "Comparing…" : "Show allocation comparisons"}
              </button>
              {lotModel?.tenderId === tender.id && (
                <div className="mt-5">
                  <p>{lotModel.excludedOffers} offer(s) omitted for missing price or different currency. Technical compliance, supplier capacity, local/SME status and regional requirements must be checked by the buyer.</p>
                  {!lotModel.scenarios.length && <p>No comparison was found by these limited methods. A feasible allocation may still exist; review the bids and constraints manually.</p>}
                  {lotModel.scenarios.map((scenario) => (
                    <article className="pw-card mt-3" key={scenario.name}>
                      <h3>{scenario.name}</h3>
                      <p>{scenario.method} · {scenario.supplierCount} supplier(s) · {lotModel.currency} {scenario.total.toLocaleString()}</p>
                      <ul className="list-disc pl-5">
                        {scenario.allocations.map((offer) => {
                          const lot = lotModel.lots.find((item) => item.id === offer.lotId);
                          return <li key={offer.lotId}>{lot?.lot_number || "Lot"}: {lot?.title || "Untitled"} — {offer.supplierName} ({lotModel.currency} {offer.price.toLocaleString()})</li>;
                        })}
                      </ul>
                    </article>
                  ))}
                  <p className="mt-3">A buyer must assess all mandatory evidence and approve any award through the separate award workflow.</p>
                </div>
              )}
            </section>
          )}
          <section className="pw-card mt-5">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-sm font-bold">
                Search supplier
                <input
                  className="mt-2 w-full rounded-xl border bg-white p-3"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Supplier name"
                />
              </label>
              <label className="text-sm font-bold">
                Status
                <select className="mt-2 w-full rounded-xl border bg-white p-3" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  {[...new Set((result.data?.data || []).map((bid) => bid.status))].map((status) => (
                    <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Sort by
                <select className="mt-2 w-full rounded-xl border bg-white p-3" value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="submitted">Newest submitted</option>
                  <option value="price">Lowest price</option>
                  <option value="supplier">Supplier name</option>
                </select>
              </label>
              <button
                className="pw-button primary self-end"
                disabled={selected.length < 2}
                onClick={() => setShowCompare(true)}
              >
                Compare selected ({selected.length})
              </button>
            </div>
          </section>
          <section className="pw-card mt-5">
            <table className="pw-table">
              <thead>
                <tr>
                  <th />
                  <th>Supplier</th>
                  <th>Price</th>
                  <th>Delivery</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleBids.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <input
                        aria-label={`Compare ${b.supplier?.name || "supplier"}`}
                        type="checkbox"
                        checked={selected.includes(b.id)}
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked
                              ? [...s, b.id]
                              : s.filter((id) => id !== b.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <strong>{b.supplier?.name || "Supplier"}</strong>
                    </td>
                    <td>
                      {b.bid_price == null
                        ? "Not stated"
                        : `${b.currency} ${Number(b.bid_price).toLocaleString()}`}
                    </td>
                    <td>{b.delivery_period || "Not stated"}</td>
                    <td>
                      {b.submitted_at
                        ? new Date(b.submitted_at).toLocaleString("en-GB")
                        : "—"}
                    </td>
                    <td>
                      <span className="pw-badge">
                        {b.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div className="pw-actions">
                        <button
                          className="pw-button"
                          onClick={() => void decide(b, "shortlist")}
                        >
                          Shortlist
                        </button>
                        <button
                          className="pw-button"
                          onClick={() => void requestClarification(b)}
                        >
                          Clarify
                        </button>
                        <button
                          className="pw-button"
                          onClick={() => void decide(b, "unsuccessful")}
                        >
                          Unsuccessful
                        </button>
                        <Link
                          className="pw-button"
                          href={`/procurement/meetings?tender=${b.tender_id}&bid=${b.id}&supplier=${b.supplier_organization_id}`}
                        >
                          <CalendarDays size={14} />
                          Interview
                        </Link>
                        <Link
                          className="pw-button"
                          href={`/procurement/messages?bid=${b.id}`}
                        >
                          <MessageSquareText size={14} />
                          Message supplier
                        </Link>
                        {[
                          "shortlisted",
                          "interview_requested",
                          "interview_scheduled",
                          "under_review",
                        ].includes(b.status) && (
                          <button
                            className="pw-button gold"
                            onClick={() => void award(b)}
                          >
                            <Trophy size={14} />
                            Award
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {selected.length > 1 && showCompare && (
            <section className="pw-card pw-compare mt-5">
              <h2>Compare selected bids</h2>
              <p>
                Differences are presented for human evaluation; BidScope does
                not choose a winner.
              </p>
              <div className="pw-compare-grid">
                {result.data.data
                  .filter((b) => selected.includes(b.id))
                  .map((b) => (
                    <article key={b.id}>
                      <h3>{b.supplier?.name || "Supplier"}</h3>
                      <p>
                        <strong>Price</strong>
                        <br />
                        {b.bid_price == null
                          ? "Not stated"
                          : `${b.currency} ${Number(b.bid_price).toLocaleString()}`}
                      </p>
                      <p>
                        <strong>Delivery</strong>
                        <br />
                        {b.delivery_period || "Not stated"}
                      </p>
                      <p>
                        <strong>Validity</strong>
                        <br />
                        {b.bid_validity_days
                          ? `${b.bid_validity_days} days`
                          : "Not stated"}
                      </p>
                      <p>
                        <strong>Technical response</strong>
                        <br />
                        {b.technical_response || "Not supplied"}
                      </p>
                      <p>
                        <strong>Methodology</strong>
                        <br />
                        {b.methodology_response || "Not supplied"}
                      </p>
                      <button
                        className="pw-button primary"
                        onClick={() => void decide(b, "shortlist")}
                      >
                        <CheckCircle2 size={14} />
                        Shortlist
                      </button>
                    </article>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
