/* eslint-disable react-hooks/preserve-manual-memoization */
"use client";

import { FormEvent, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { api, invalidate, useData } from "@/components/customer/data";

type EvaluationData = {
  tenders: Array<{ id: string; title: string; status: string }>;
  bids: Array<{
    id: string;
    tender_id: string;
    status: string;
    bid_price: number | null;
    currency: string;
    delivery_period: string | null;
    supplier?: { name: string } | null;
  }>;
  criteria: Array<{
    id: string;
    tender_id: string;
    name: string;
    description: string;
    criterion_type: "scored" | "pass_fail" | "text";
    weight: number | null;
    score_min: number;
    score_max: number;
    guidance: string;
  }>;
  evaluations: Array<{
    id: string;
    tender_id: string;
    bid_id: string;
    evaluator_user_id: string;
    status: string;
    recommendation: string | null;
  }>;
  scores: Array<{
    evaluation_id: string;
    criterion_id: string;
    numeric_score: number | null;
    pass: boolean | null;
    assessment: string;
    private_note: string;
  }>;
};

export function EvaluationsWorkspace() {
  const result = useData<{ data: EvaluationData }>(
      "/api/procurement?resource=evaluations",
    ),
    [tenderId, setTenderId] = useState(""),
    [bidId, setBidId] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const data = result.data?.data;
  const bids = useMemo(
      () =>
        data?.bids.filter((b) => !tenderId || b.tender_id === tenderId) || [],
      [data, tenderId],
    ),
    criteria = useMemo(
      () =>
        data?.criteria.filter(
          (c) =>
            c.tender_id ===
            (tenderId || bids.find((b) => b.id === bidId)?.tender_id),
        ) || [],
      [data, tenderId, bidId, bids],
    );
  if (result.loading)
    return (
      <div className="pw-card" aria-busy="true">
        Loading assigned evaluations…
      </div>
    );
  if (result.error) return <div className="pw-error">{result.error}</div>;
  if (!data?.tenders.length)
    return (
      <section className="pw-empty">
        <ClipboardCheck size={35} />
        <h2>No evaluations awaiting your action</h2>
        <p>Closed tenders and evaluator assignments will appear here.</p>
      </section>
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bidId) return;
    setBusy(true);
    setMessage("");
    const f = new FormData(event.currentTarget);
    try {
      await api("/api/procurement", {
        action: "evaluate",
        tenderId: tenderId || bids.find((b) => b.id === bidId)?.tender_id,
        bidId,
        lotId: null,
        overallNote: f.get("overallNote") || "",
        recommendation: f.get("recommendation") || null,
        submit: f.get("finalise") === "true",
        scores: criteria.map((c) => ({
          criterionId: c.id,
          numericScore:
            c.criterion_type === "scored"
              ? Number(f.get(`score-${c.id}`))
              : null,
          pass:
            c.criterion_type === "pass_fail"
              ? f.get(`pass-${c.id}`) === "pass"
              : null,
          assessment: f.get(`assessment-${c.id}`) || "",
          privateNote: f.get(`note-${c.id}`) || "",
        })),
      });
      setMessage(
        f.get("finalise") === "true"
          ? "Evaluation submitted."
          : "Evaluation draft saved.",
      );
      invalidate();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="pw-hero">
        <p className="pw-eyebrow">PRIVATE EVALUATION WORKSPACE</p>
        <h1>Evaluations</h1>
        <p>
          Score only assigned procurement records. Your assessment is stored
          independently and private notes are never shown to suppliers.
        </p>
      </div>
      <section className="pw-card mt-5">
        <div className="pw-fields">
          <label>
            Tender
            <select
              value={tenderId}
              onChange={(e) => {
                setTenderId(e.target.value);
                setBidId("");
              }}
            >
              <option value="">Choose tender</option>
              {data.tenders.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Supplier bid
            <select value={bidId} onChange={(e) => setBidId(e.target.value)}>
              <option value="">Choose bid</option>
              {bids.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.supplier?.name || "Supplier"} · {b.currency}{" "}
                  {Number(b.bid_price || 0).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {bidId && (
        <form className="pw-form mt-5" onSubmit={submit}>
          {criteria.map((c) => (
            <section className="pw-form-section" key={c.id}>
              <div className="flex justify-between gap-4">
                <h2>{c.name}</h2>
                {c.weight != null && (
                  <span className="pw-badge gold">{c.weight}%</span>
                )}
              </div>
              <p>
                {c.description ||
                  c.guidance ||
                  "Record a procurement evidence-based assessment."}
              </p>
              <div className="pw-fields">
                {c.criterion_type === "scored" && (
                  <label>
                    Score ({c.score_min}–{c.score_max})
                    <input
                      required
                      type="number"
                      min={c.score_min}
                      max={c.score_max}
                      step="0.1"
                      name={`score-${c.id}`}
                    />
                  </label>
                )}
                {c.criterion_type === "pass_fail" && (
                  <label>
                    Result
                    <select required name={`pass-${c.id}`}>
                      <option value="">Choose</option>
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                    </select>
                  </label>
                )}
                <label className="wide">
                  Assessment
                  <textarea required rows={3} name={`assessment-${c.id}`} />
                </label>
                <label className="wide">
                  Private evaluator note
                  <textarea rows={3} name={`note-${c.id}`} />
                </label>
              </div>
            </section>
          ))}
          <section className="pw-form-section">
            <label>
              Overall assessment
              <textarea rows={5} name="overallNote" />
            </label>
            <label>
              Recommendation
              <select name="recommendation">
                <option value="">No recommendation</option>
                <option value="proceed">Proceed</option>
                <option value="clarify">Seek clarification</option>
                <option value="shortlist">Shortlist</option>
                <option value="unsuccessful">Unsuccessful</option>
              </select>
            </label>
            {message && (
              <p
                className={
                  /saved|submitted/.test(message) ? "pw-notice" : "pw-error"
                }
              >
                {message}
              </p>
            )}
            <div className="pw-actions">
              <button
                disabled={busy}
                name="finalise"
                value="false"
                className="pw-button"
              >
                Save draft
              </button>
              <button
                disabled={busy}
                name="finalise"
                value="true"
                className="pw-button primary"
              >
                Submit evaluation
              </button>
            </div>
          </section>
        </form>
      )}
    </>
  );
}
