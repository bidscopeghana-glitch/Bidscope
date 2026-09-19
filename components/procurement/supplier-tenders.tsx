"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Gavel,
  LockKeyhole,
  MessageCircleQuestion,
  Send,
  UploadCloud,
} from "lucide-react";
import { api, downloadAuthenticatedFile, invalidate, uploadAuthenticatedFile, useData } from "@/components/customer/data";

type Tender = {
  id: string;
  title: string;
  description: string;
  tender_type: string;
  procurement_category: string;
  classification: string;
  location: string | null;
  currency: string;
  estimated_budget: number | null;
  submission_deadline: string;
  clarification_deadline: string | null;
  award_structure: string;
  bid_opening_model: string;
  visibility: string;
  questions_allowed: boolean;
  eligibility_requirements: string;
  technical_requirements: string;
  commercial_requirements: string;
  delivery_requirements: string;
  terms_and_conditions: string;
  buyerVerified: boolean;
  buyer: {
    id: string;
    name: string;
    organization_type?: string | null;
    region?: string | null;
    created_at?: string;
  } | null;
  currentBid?: {
    id: string;
    status: string;
    documents: Array<{
      id: string;
      required_document_id: string | null;
      original_filename: string;
      size_bytes: number;
    }>;
  };
  tenderDocuments: Array<{
    id: string;
    original_filename: string;
    size_bytes: number;
  }>;
  lots: Array<{
    id: string;
    lot_number: string;
    title: string;
    description: string;
  }>;
  requirements: Array<{
    id: string;
    section: string;
    title: string;
    description: string;
    mandatory: boolean;
  }>;
  requiredDocuments: Array<{
    id: string;
    name: string;
    description: string;
    mandatory: boolean;
  }>;
  criteria: Array<{
    id: string;
    name: string;
    criterion_type: string;
    weight: number | null;
    guidance: string;
  }>;
};

function Heading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="cc-page-heading">
      <div>
        <p className="cc-eyebrow">BIDSCOPE-HOSTED PROCUREMENT</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function Loading() {
  return (
    <div className="cc-editor" aria-busy="true">
      Loading live BidScope tenders…
    </div>
  );
}
function ErrorBox({ message }: { message: string }) {
  return (
    <p className="cc-error" role="alert">
      {message}
    </p>
  );
}

export function SupplierTenders({ identifier }: { identifier?: string }) {
  return identifier ? (
    <SupplierTenderDetail id={identifier} />
  ) : (
    <SupplierTenderMarketplace />
  );
}

function SupplierTenderMarketplace() {
  const result = useData<{ data: Tender[] }>(
    "/api/procurement?resource=marketplace",
  );
  return (
    <>
      <Heading
        title="BidScope Tenders"
        description="Tender opportunities created by verified organisations and submitted securely inside BidScope."
      />
      <div className="cc-tabs">
        <Link href="/customer/discover">External Tenders</Link>
        <Link aria-current="page" href="/customer/bidscope-tenders">
          BidScope Tenders
        </Link>
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorBox message={result.error} />
      ) : result.data?.data?.length ? (
        <section className="cc-editor">
          <div className="cc-document-list">
            {result.data.data.map((t) => (
              <Link
                className="cc-document-row"
                key={t.id}
                href={`/customer/bidscope-tenders/${t.id}`}
              >
                <span>
                  <strong>{t.title}</strong>
                  <small>
                    {t.buyer?.name || "Verified buyer"} ·{" "}
                    {t.procurement_category} ·{" "}
                    {t.location || "Location not specified"}
                  </small>
                </span>
                <span>
                  <b>BidScope Tender</b>
                  <small>
                    Closes{" "}
                    {new Date(t.submission_deadline).toLocaleString("en-GB")}
                  </small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="cc-empty">
          <FileText size={30} />
          <h2>No open BidScope Tenders</h2>
          <p>
            New buyer-hosted opportunities will appear here as soon as verified
            buyers publish them.
          </p>
          <Link className="cc-button" href="/customer/discover">
            Browse External Tenders
          </Link>
        </section>
      )}
    </>
  );
}

function SupplierTenderDetail({ id }: { id: string }) {
  const result = useData<{ data: Tender }>(
      `/api/procurement?resource=tender&id=${id}`,
    ),
    clarifications = useData<{ data: Clarification[] }>(
      `/api/procurement?resource=clarifications&tenderId=${id}`,
    ),
    [showBid, setShowBid] = useState(false),
    [showQuestion, setShowQuestion] = useState(false),
    [message, setMessage] = useState("");
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorBox message={result.error} />;
  const t = result.data!.data;
  return (
    <>
      <Heading
        title={t.title}
        description={`${t.tender_type.toUpperCase()} · ${t.procurement_category} · closes ${new Date(t.submission_deadline).toLocaleString("en-GB")}`}
      />
      <section className="cc-editor">
        <div className="flex flex-wrap items-center gap-2">
          <span className="cc-status">
            <Gavel size={14} /> BidScope Tender
          </span>
          {t.buyerVerified && (
            <span className="cc-status">
              <BadgeCheck size={14} /> Verified buyer
            </span>
          )}
          <span className="cc-status">
            <Clock3 size={14} />{" "}
            {t.bid_opening_model === "sealed"
              ? "Sealed until deadline"
              : "Open as received"}
          </span>
        </div>
        <h2 className="mt-6">Overview</h2>
        <p>{t.description}</p>
        <div className="cc-detail-facts">
          <span>
            <Building2 size={15} />
            <b>{t.buyer?.name || "Buyer"}</b>
            <small>
              {t.buyer?.organization_type || "Procuring organisation"}
            </small>
          </span>
          <span>
            <BriefcaseBusiness size={15} />
            <b>{t.award_structure.replaceAll("_", " ")}</b>
            <small>Award structure</small>
          </span>
          <span>
            <LockKeyhole size={15} />
            <b>{t.visibility.replaceAll("_", " ")}</b>
            <small>Participation</small>
          </span>
        </div>
        {[
          ["Eligibility", t.eligibility_requirements],
          ["Technical requirements", t.technical_requirements],
          ["Commercial requirements", t.commercial_requirements],
          ["Delivery requirements", t.delivery_requirements],
        ]
          .filter(([, body]) => body)
          .map(([title, body]) => (
            <div className="mt-6" key={title}>
              <h2>{title}</h2>
              <p className="whitespace-pre-wrap">{body}</p>
            </div>
          ))}
        {!!t.requirements.length && (
          <div className="mt-6">
            <h2>Requirement checklist</h2>
            {t.requirements.map((r) => (
              <div className="cc-document-row" key={r.id}>
                <span>
                  <strong>{r.title}</strong>
                  <small>{r.description || r.section}</small>
                </span>
                {r.mandatory && <b>Required</b>}
              </div>
            ))}
          </div>
        )}
        {!!t.requiredDocuments.length && (
          <div className="mt-6">
            <h2>Required documents</h2>
            {t.requiredDocuments.map((d) => (
              <div className="cc-document-row" key={d.id}>
                <span>
                  <strong>{d.name}</strong>
                  <small>
                    {d.description || "Upload with your submission"}
                  </small>
                </span>
                {d.mandatory && <b>Required</b>}
              </div>
            ))}
          </div>
        )}
        {!!t.tenderDocuments.length && (
          <div className="mt-6">
            <h2>Tender documents</h2>
            {t.tenderDocuments.map((document) => (
              <button
                type="button"
                className="cc-document-row"
                key={document.id}
                onClick={() => void downloadAuthenticatedFile(
                  `/api/procurement/documents?kind=tender&id=${document.id}`,
                  document.original_filename,
                )}
              >
                <span>
                  <strong>{document.original_filename}</strong>
                  <small>
                    {(document.size_bytes / 1024 / 1024).toFixed(2)} MB · secure
                    download
                  </small>
                </span>
                <b>Download</b>
              </button>
            ))}
          </div>
        )}
        {!!t.lots.length && (
          <div className="mt-6">
            <h2>Tender lots</h2>
            {t.lots.map((l) => (
              <div className="cc-document-row" key={l.id}>
                <span>
                  <strong>
                    Lot {l.lot_number}: {l.title}
                  </strong>
                  <small>{l.description}</small>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="cc-detail-actions mt-6">
          <button
            className="cc-button primary"
            onClick={() => setShowBid(true)}
          >
            {t.currentBid?.status === "draft"
              ? "Continue Bid"
              : t.currentBid?.status === "submitted"
                ? "Submit a New Version"
                : "Start Bid"}
          </button>
          <button
            className="cc-button"
            onClick={async () => {
              const reason = window.prompt(
                "Tell us why this tender should be reviewed.",
              );
              if (!reason) return;
              try {
                await api("/api/procurement", {
                  action: "report_tender",
                  tenderId: t.id,
                  reason,
                });
                setMessage(
                  "Report received. Our administrators will review it.",
                );
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Report Tender
          </button>
          {t.questions_allowed && (
            <button
              className="cc-button"
              onClick={() => setShowQuestion((value) => !value)}
            >
              <MessageCircleQuestion size={15} /> Ask the buyer
            </button>
          )}
        </div>
        {showQuestion && (
          <QuestionForm
            tenderId={t.id}
            bidId={t.currentBid?.id}
            done={(value) => {
              setMessage(value);
              setShowQuestion(false);
            }}
          />
        )}
        <ClarificationThread
          items={clarifications.data?.data || []}
          onMessage={setMessage}
        />
        {t.currentBid && (
          <BidDocuments
            bidId={t.currentBid.id}
            documents={t.currentBid.documents || []}
            requiredDocuments={t.requiredDocuments}
            onMessage={setMessage}
          />
        )}
        {message && <p className="cc-form-note mt-4">{message}</p>}
      </section>
      {showBid && <BidForm tender={t} close={() => setShowBid(false)} />}
    </>
  );
}

type Clarification = {
  id: string;
  kind: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  response_to_id: string | null;
  recipient_organization_id: string | null;
};

function QuestionForm({
  tenderId,
  bidId,
  done,
}: {
  tenderId: string;
  bidId?: string;
  done: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="cc-form-note mt-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const form = new FormData(event.currentTarget);
        try {
          await api("/api/procurement", {
            action: "question",
            tenderId,
            bidId: bidId || null,
            subject: form.get("subject"),
            message: form.get("message"),
          });
          invalidate();
          done("Your question has been sent securely to the buyer.");
        } catch (error) {
          done((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Ask a private tender question</h3>
      <label>
        Subject
        <input required name="subject" maxLength={200} />
      </label>
      <label>
        Question
        <textarea required name="message" rows={4} maxLength={10000} />
      </label>
      <button disabled={busy} className="cc-button primary">
        <Send size={14} /> {busy ? "Sending…" : "Send question"}
      </button>
    </form>
  );
}

function ClarificationThread({
  items,
  onMessage,
}: {
  items: Clarification[];
  onMessage: (message: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-6">
      <h2>Questions and clarifications</h2>
      {items.map((item) => (
        <article className="cc-document-row" key={item.id}>
          <span>
            <strong>{item.subject}</strong>
            <small>{item.message}</small>
            <small>
              {new Date(item.created_at).toLocaleString("en-GB")} ·{" "}
              {item.status}
            </small>
          </span>
          {item.kind === "buyer_clarification" && item.status === "open" && (
            <button
              className="cc-button"
              onClick={async () => {
                const response = window.prompt("Your clarification response");
                if (!response) return;
                try {
                  await api("/api/procurement", {
                    action: "respond_clarification",
                    clarificationId: item.id,
                    message: response,
                  });
                  invalidate();
                  onMessage("Clarification response sent.");
                } catch (error) {
                  onMessage((error as Error).message);
                }
              }}
            >
              Respond
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

function BidDocuments({
  bidId,
  documents,
  requiredDocuments,
  onMessage,
}: {
  bidId: string;
  documents: Array<{
    id: string;
    required_document_id: string | null;
    original_filename: string;
    size_bytes: number;
  }>;
  requiredDocuments: Tender["requiredDocuments"];
  onMessage: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-6">
      <h2>Your secure bid documents</h2>
      <p>
        Files stay private and are released to the buyer only under the tender’s
        opening rules. Maximum file size: 25 MB.
      </p>
      {requiredDocuments.map((required) => {
        const uploaded = documents.find(
          (document) => document.required_document_id === required.id,
        );
        return (
          <form
            className="cc-document-row"
            key={required.id}
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget),
                file = form.get("file");
              if (!(file instanceof File) || !file.size) return;
              form.set("kind", "bid");
              form.set("entityId", bidId);
              form.set("requiredDocumentId", required.id);
              setBusy(true);
              try {
                await uploadAuthenticatedFile("/api/procurement/documents", form);
                invalidate();
                onMessage(`${required.name} uploaded securely.`);
              } catch (error) {
                onMessage((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <span>
              <strong>
                {required.name} {required.mandatory ? "*" : ""}
              </strong>
              <small>
                {uploaded
                  ? `${uploaded.original_filename} uploaded`
                  : required.description || "Choose a document"}
              </small>
            </span>
            <span className="flex items-center gap-2">
              <input required type="file" name="file" disabled={busy} />
              <button disabled={busy} className="cc-button">
                <UploadCloud size={14} /> Upload
              </button>
            </span>
          </form>
        );
      })}
      {!requiredDocuments.length && (
        <p className="cc-form-note">
          This tender does not specify mandatory uploads. Supporting documents
          can still be added after the buyer requests clarification.
        </p>
      )}
    </div>
  );
}

function BidForm({ tender, close }: { tender: Tender; close: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>, submit: boolean) {
    event.preventDefault();
    if (submit && !review) {
      setReview(true);
      return;
    }
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget);
    try {
      await api("/api/procurement", {
        action: "save_bid",
        bid: {
          tenderId: tender.id,
          bidPrice: f.get("bidPrice") ? Number(f.get("bidPrice")) : null,
          currency: f.get("currency") || tender.currency,
          priceBreakdown: [],
          deliveryPeriod: f.get("deliveryPeriod") || null,
          bidValidityDays: f.get("bidValidityDays")
            ? Number(f.get("bidValidityDays"))
            : null,
          technicalResponse: f.get("technicalResponse") || "",
          methodologyResponse: f.get("methodologyResponse") || "",
          experienceResponse: f.get("experienceResponse") || "",
          complianceDeclarations: { confirmed: f.get("compliance") === "on" },
          notes: f.get("notes") || "",
          lotResponses: tender.lots
            .filter((l) => f.get(`lot-${l.id}`) === "on")
            .map((l) => ({
              lotId: l.id,
              price: f.get(`price-${l.id}`)
                ? Number(f.get(`price-${l.id}`))
                : null,
              currency: String(f.get("currency") || tender.currency),
              response: String(f.get(`response-${l.id}`) || ""),
            })),
          responses: tender.requirements.map((r) => ({
            requirementId: r.id,
            responseText: String(f.get(`requirement-${r.id}`) || ""),
            declaration: f.get(`declare-${r.id}`) === "on",
          })),
          submit,
        },
      });
      invalidate();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="cc-meet-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Structured bid submission"
    >
      <form onSubmit={(e) => void save(e, false)}>
        <header>
          <div>
            <p className="cc-eyebrow">STRUCTURED BID</p>
            <h2>{review ? "Review and confirm" : "Prepare your response"}</h2>
          </div>
          <button type="button" onClick={close}>
            ×
          </button>
        </header>
        {review && (
          <div className="cc-form-note">
            <CheckCircle2 size={18} />
            Review every response before final submission. Submitting creates a
            timestamped, immutable version. Later amendments create a new
            version.
          </div>
        )}
        <div className="cc-meet-form-grid">
          <label>
            Bid price
            <input name="bidPrice" type="number" min="0" step="0.01" />
          </label>
          <label>
            Currency
            <input
              name="currency"
              defaultValue={tender.currency}
              maxLength={3}
            />
          </label>
          <label>
            Delivery / completion period
            <input name="deliveryPeriod" placeholder="e.g. 8 weeks" />
          </label>
          <label>
            Bid validity (days)
            <input name="bidValidityDays" type="number" min="1" max="730" />
          </label>
        </div>
        <label>
          Technical response
          <textarea required name="technicalResponse" rows={5} />
        </label>
        <label>
          Methodology / proposal
          <textarea name="methodologyResponse" rows={5} />
        </label>
        <label>
          Relevant experience
          <textarea name="experienceResponse" rows={5} />
        </label>
        {tender.requirements.map((r) => (
          <fieldset key={r.id}>
            <legend>
              {r.title}
              {r.mandatory ? " *" : ""}
            </legend>
            <label>
              Your response
              <textarea
                required={r.mandatory}
                name={`requirement-${r.id}`}
                rows={3}
              />
            </label>
            <label className="cc-checkbox-row">
              <input type="checkbox" name={`declare-${r.id}`} />I confirm this
              requirement is met
            </label>
          </fieldset>
        ))}
        {tender.lots.map((l) => (
          <fieldset key={l.id}>
            <legend>
              Lot {l.lot_number}: {l.title}
            </legend>
            <label className="cc-checkbox-row">
              <input type="checkbox" name={`lot-${l.id}`} />
              Include this lot
            </label>
            <label>
              Lot price
              <input type="number" min="0" step="0.01" name={`price-${l.id}`} />
            </label>
            <label>
              Lot response
              <textarea name={`response-${l.id}`} rows={3} />
            </label>
          </fieldset>
        ))}
        <label>
          Additional notes
          <textarea name="notes" rows={3} />
        </label>
        <label className="cc-checkbox-row">
          <input required type="checkbox" name="compliance" />I confirm the
          information is accurate and I am authorised to submit it.
        </label>
        {error && <ErrorBox message={error} />}
        <footer>
          <button type="button" className="cc-button" onClick={close}>
            Cancel
          </button>
          <button disabled={busy} className="cc-button">
            Save Draft
          </button>
          <button
            disabled={busy}
            type="button"
            className="cc-button primary"
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (form)
                void save(
                  {
                    preventDefault: () => {},
                    currentTarget: form,
                  } as unknown as FormEvent<HTMLFormElement>,
                  true,
                );
            }}
          >
            <Send size={15} />
            {review ? "Confirm Submission" : "Review Bid"}
          </button>
        </footer>
      </form>
    </div>
  );
}
