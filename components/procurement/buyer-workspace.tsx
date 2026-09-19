"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  FilePlus2,
  FileText,
  LayoutDashboard,
  Menu,
  MessageCircleQuestion,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Video,
  UploadCloud,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { api, downloadAuthenticatedFile, invalidate, uploadAuthenticatedFile, useData } from "@/components/customer/data";
import { useBidScopeSession } from "@/components/procurement/auth-nav";
import { EvaluationsWorkspace } from "@/components/procurement/evaluations-workspace";
import { ProcurementBidInbox } from "@/components/procurement/bid-inbox";
import { ProcurementMeetings } from "@/components/procurement/procurement-meetings";

type Capabilities = {
  organizationId: string;
  organization: {
    id: string;
    name: string;
    can_bid: boolean;
    can_procure: boolean;
  };
  role: string;
  membershipRole: string;
  canManage: boolean;
  verification: { status: string; verification_notes?: string | null };
};
type Tender = {
  id: string;
  title: string;
  reference_number: string | null;
  description: string;
  tender_type: string;
  procurement_category: string;
  classification: string;
  location: string | null;
  currency: string;
  estimated_budget: number | null;
  issue_date?: string | null;
  submission_deadline: string;
  clarification_deadline: string | null;
  status: string;
  award_structure: string;
  bid_opening_model: string;
  visibility: string;
  questions_allowed?: boolean;
  withdrawal_allowed?: boolean;
  supplier_identity_visible_before_opening?: boolean;
  approval_required?: boolean;
  eligibility_requirements?: string;
  technical_requirements?: string;
  commercial_requirements?: string;
  delivery_requirements?: string;
  terms_and_conditions?: string;
  bidCounts?: Record<string, number>;
  buyer?: { name: string };
  buyerVerified?: boolean;
  currentBid?: { id: string; status: string };
  lots?: Array<{
    id: string;
    lot_number: string;
    title: string;
    description: string;
    quantity?: number | null;
    budget?: number | null;
    requirements?: string;
    evaluation_criteria?: unknown[];
  }>;
  requirements?: Array<{
    id: string;
    section: string;
    title: string;
    description: string;
    mandatory: boolean;
  }>;
  requiredDocuments?: Array<{
    id: string;
    name: string;
    description: string;
    mandatory: boolean;
  }>;
  criteria?: Array<{
    id: string;
    name: string;
    criterion_type: string;
    weight: number | null;
    score_min: number;
    score_max: number;
    guidance: string;
    description?: string;
    mandatory?: boolean;
    section?: DraftCriterion["section"];
    lot_id?: string | null;
  }>;
  tenderDocuments?: Array<{
    id: string;
    original_filename: string;
    size_bytes: number;
    visibility: string;
  }>;
  viewer?: { isBuyer: boolean };
};
type Clarification = {
  id: string;
  kind: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  response_to_id: string | null;
};
type Bid = {
  id: string;
  tender_id: string;
  supplier_organization_id?: string;
  status: string;
  bid_price?: number | null;
  currency?: string;
  delivery_period?: string | null;
  bid_validity_days?: number | null;
  submitted_at?: string | null;
  supplier?: { id: string; name: string } | null;
  sealed?: boolean;
  tender?: Tender;
};
const navigation = [
  ["Procurement Home", "/procurement", LayoutDashboard],
  ["My Tenders", "/procurement/tenders", FileText],
  ["Bids Received", "/procurement/bids", BriefcaseBusiness],
  ["Evaluations", "/procurement/evaluations", ClipboardCheck],
  ["Meetings", "/procurement/meetings", Video],
  ["Suppliers", "/procurement/suppliers", Building2],
  ["Reports", "/procurement/reports", BarChart3],
  ["Team", "/procurement/team", Users],
  ["Settings", "/procurement/settings", Settings],
] as const;

export function ProcurementShell({ children }: { children: React.ReactNode }) {
  const session = useBidScopeSession(),
    router = useRouter(),
    pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (session === false)
      router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [session, router, pathname]);
  if (session !== true)
    return (
      <div className="cc-loading">Opening secure procurement workspace…</div>
    );
  return (
    <div className={`pw-app ${mobile ? "menu-open" : ""}`}>
      {mobile && (
        <button
          className="pw-overlay"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className="pw-sidebar">
        <div className="pw-logo">
          <BrandLogo />
        </div>
        <div className="pw-mode">
          <Link href="/customer">Bid for work</Link>
          <Link className="active" href="/procurement">
            Procure
          </Link>
        </div>
        <nav className="pw-nav" aria-label="Procurement navigation">
          {navigation.map(([label, href, Icon]) => (
            <Link
              aria-current={
                pathname === href ||
                (href !== "/procurement" && pathname.startsWith(href))
                  ? "page"
                  : undefined
              }
              href={href}
              key={href}
              onClick={() => setMobile(false)}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="pw-sidebar-foot">
          <Link href="/customer">
            <ArrowLeftRight size={15} />
            Switch to supplier workspace
          </Link>
        </div>
      </aside>
      <div className="pw-body">
        <header className="pw-topbar">
          <div className="flex items-center gap-3">
            <button
              className="pw-mobile"
              aria-label="Open procurement navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <div>
              <strong>Buyer / Procuring Organisation</strong>
              <span>SECURE PROCUREMENT WORKSPACE</span>
            </div>
          </div>
          <Link href="/procurement/create" className="pw-button primary">
            <Plus size={15} />
            Create tender
          </Link>
        </header>
        <main className="pw-main">{children}</main>
        <footer className="pw-footer">
          BidScope procurement · Human decisions supported by structured,
          auditable evidence.
        </footer>
      </div>
    </div>
  );
}

export function ProcurementPage({
  section,
  identifier,
}: {
  section: string;
  identifier?: string;
}) {
  if (section === "create") return <TenderForm tenderId={identifier} />;
  if (section === "tenders" && identifier)
    return <TenderDetail id={identifier} />;
  return (
    <CapabilityGate>
      {section === "home" ? (
        <Dashboard />
      ) : section === "tenders" ? (
        <TenderList />
      ) : section === "bids" ? (
        <ProcurementBidInbox />
      ) : section === "evaluations" ? (
        <Evaluations />
      ) : section === "meetings" ? (
        <ProcurementMeetings meetingId={identifier} />
      ) : section === "suppliers" ? (
        <Suppliers />
      ) : section === "reports" ? (
        <Reports />
      ) : section === "team" ? (
        <Team />
      ) : (
        <ProcurementSettings />
      )}
    </CapabilityGate>
  );
}

function CapabilityGate({ children }: { children: React.ReactNode }) {
  const result = useData<{ data: Capabilities }>(
    "/api/procurement?resource=capabilities",
  );
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorState message={result.error} />;
  const cap = result.data!.data;
  if (!cap.organization.can_procure)
    return (
      <section className="pw-empty">
        <ShieldCheck size={38} />
        <h1>Procure through BidScope</h1>
        <p>
          Create tenders, receive bids, compare suppliers, conduct interviews
          and award contracts — all from one workspace.
        </p>
        {["owner", "admin"].includes(cap.membershipRole) ? (
          <button
            className="pw-button primary"
            onClick={async () => {
              await api("/api/procurement", {
                action: "capabilities",
                canBid: cap.organization.can_bid,
                canProcure: true,
              });
              invalidate();
            }}
          >
            Activate procurement capabilities
          </button>
        ) : (
          <p>
            Ask an organisation owner or administrator to activate procurement.
          </p>
        )}
      </section>
    );
  return <>{children}</>;
}
function Heading({
  eyebrow = "PROCUREMENT WORKSPACE",
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="pw-hero">
      <p className="pw-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      {action && <div className="pw-actions mt-5">{action}</div>}
    </div>
  );
}
function Loading() {
  return (
    <div className="pw-card" aria-busy="true">
      Loading current procurement data…
    </div>
  );
}
function ErrorState({ message }: { message: string }) {
  const needsOrganisation = /organisation profile/i.test(message);
  return (
    <div className="pw-error" role="alert">
      {message}
      {needsOrganisation ? (
        <Link
          className="ml-3 underline"
          href="/customer/profile?onboarding=buyer"
        >
          Create organisation
        </Link>
      ) : (
        <button className="ml-3 underline" onClick={invalidate}>
          Retry
        </button>
      )}
    </div>
  );
}
function Empty({
  title,
  body,
  href = "/procurement/create",
  action = "Create tender",
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="pw-empty">
      <FileText size={30} />
      <h2>{title}</h2>
      <p>{body}</p>
      <Link className="pw-button primary" href={href}>
        {action}
      </Link>
    </div>
  );
}

function Dashboard() {
  const result = useData<{
    data: {
      counts: {
        activeTenders: number;
        bidsReceived: number;
        awaitingEvaluation: number;
        interviewsThisWeek: number;
        pendingAwards: number;
      };
      recent: Tender[];
      submissions: Bid[];
      upcoming: Array<{
        id: string;
        title: string;
        starts_at: string;
        procurement_meeting_type: string;
      }>;
      actions: Array<{ type: string; title: string; at?: string }>;
    };
  }>("/api/procurement?resource=dashboard");
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorState message={result.error} />;
  const d = result.data!.data,
    c = d.counts;
  return (
    <>
      <Heading
        title="Procurement home"
        description="Create, monitor and complete your organisation's procurements from one accountable workspace."
        action={
          <Link className="pw-button gold" href="/procurement/create">
            <FilePlus2 size={16} />
            Create your first tender
          </Link>
        }
      />
      <div className="pw-grid">
        {[
          ["Active tenders", c.activeTenders],
          ["Bids received", c.bidsReceived],
          ["Awaiting evaluation", c.awaitingEvaluation],
          ["Interviews this week", c.interviewsThisWeek],
          ["Pending awards", c.pendingAwards],
        ].map(([label, value]) => (
          <div className="pw-stat" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="pw-layout">
        <section className="pw-card">
          <h2>Tender activity</h2>
          {d.recent.length ? (
            <div className="pw-list">
              {d.recent.map((t) => (
                <Link href={`/procurement/tenders/${t.id}`} key={t.id}>
                  <strong>{t.title}</strong>
                  <small>
                    {t.status.replaceAll("_", " ")} · closes{" "}
                    {new Date(t.submission_deadline).toLocaleDateString(
                      "en-GB",
                    )}
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="You haven't created a tender yet"
              body="Create a draft now. Publishing becomes available after buyer verification."
            />
          )}
        </section>
        <aside className="pw-card">
          <h2>Pending actions</h2>
          {d.actions.length ? (
            <div className="pw-list">
              {d.actions.map((a, i) => (
                <article key={`${a.type}-${i}`}>
                  <span className="pw-badge gold">{a.type}</span>
                  <strong>{a.title}</strong>
                  {a.at && (
                    <small>{new Date(a.at).toLocaleString("en-GB")}</small>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p>No urgent procurement actions.</p>
          )}
          <h2 className="mt-7">Upcoming events</h2>
          {d.upcoming.length ? (
            d.upcoming.map((m) => (
              <div className="pw-row" key={m.id}>
                <span>
                  <strong>{m.title}</strong>
                  <small>{new Date(m.starts_at).toLocaleString("en-GB")}</small>
                </span>
                <Video size={17} />
              </div>
            ))
          ) : (
            <p>No supplier interviews scheduled.</p>
          )}
        </aside>
      </div>
      <div className="pw-layout mt-5">
        <section className="pw-card">
          <h2>Recent bid submissions</h2>
          {d.submissions.length ? (
            <div className="pw-list">
              {d.submissions.map((bid) => {
                const tender = d.recent.find((item) => item.id === bid.tender_id);
                return (
                  <Link href={`/procurement/bids?tender=${bid.tender_id}`} key={bid.id}>
                    <strong>{tender?.title || "Tender bid"}</strong>
                    <small>
                      {bid.status.replaceAll("_", " ")}
                      {bid.submitted_at ? ` · ${new Date(bid.submitted_at).toLocaleString("en-GB")}` : ""}
                    </small>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p>No bid submissions have arrived yet.</p>
          )}
        </section>
        <section className="pw-card">
          <h2>Recently closed tenders</h2>
          {d.recent.filter((tender) => ["closed", "evaluation", "shortlisted", "interviews", "pending_award", "awarded"].includes(tender.status)).length ? (
            <div className="pw-list">
              {d.recent
                .filter((tender) => ["closed", "evaluation", "shortlisted", "interviews", "pending_award", "awarded"].includes(tender.status))
                .map((tender) => (
                  <Link href={`/procurement/tenders/${tender.id}`} key={tender.id}>
                    <strong>{tender.title}</strong>
                    <small>{tender.status.replaceAll("_", " ")}</small>
                  </Link>
                ))}
            </div>
          ) : (
            <p>No tenders have closed yet.</p>
          )}
        </section>
      </div>
    </>
  );
}

function TenderList() {
  const result = useData<{ data: Tender[] }>(
    "/api/procurement?resource=tenders",
  );
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorState message={result.error} />;
  return (
    <>
      <Heading
        title="My tenders"
        description="Draft, publish and manage every BidScope-hosted procurement."
        action={
          <Link href="/procurement/create" className="pw-button gold">
            <Plus size={15} />
            Create tender
          </Link>
        }
      />
      <div className="pw-subnav">
        <Link className="pw-button" href="/procurement/tenders">
          All
        </Link>
        {["draft", "live", "closed", "evaluation", "awarded"].map((s) => (
          <Link
            className="pw-button"
            href={`/procurement/tenders?status=${s}`}
            key={s}
          >
            {s}
          </Link>
        ))}
      </div>
      {result.data?.data.length ? (
        <section className="pw-card">
          <table className="pw-table">
            <thead>
              <tr>
                <th>Tender</th>
                <th>Type</th>
                <th>Deadline</th>
                <th>Bids</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.data.data.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.title}</strong>
                    <small>{t.reference_number || "No reference"}</small>
                  </td>
                  <td>{t.tender_type.toUpperCase()}</td>
                  <td>
                    {new Date(t.submission_deadline).toLocaleString("en-GB")}
                  </td>
                  <td>
                    {Object.values(t.bidCounts || {}).reduce(
                      (a, b) => a + b,
                      0,
                    )}
                  </td>
                  <td>
                    <span className="pw-badge">{t.status}</span>
                  </td>
                  <td>
                    <Link
                      className="pw-button"
                      href={`/procurement/tenders/${t.id}`}
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <Empty
          title="You haven't created a tender yet"
          body="Start with a draft, add requirements and evaluation criteria, then publish after verification."
        />
      )}
    </>
  );
}

type DraftLot = {
  lotNumber: string;
  title: string;
  description: string;
  quantity: number | null;
  budget: number | null;
  requirements: string;
  evaluationCriteria: unknown[];
};
type DraftCriterion = {
  name: string;
  description: string;
  criterionType: "scored" | "pass_fail" | "text";
  weight: number | null;
  scoreMin: number;
  scoreMax: number;
  guidance: string;
  mandatory: boolean;
  lotNumber: string | null;
  section:
    | "general"
    | "technical"
    | "commercial"
    | "experience"
    | "delivery"
    | "compliance";
};
function TenderForm({ tenderId }: { tenderId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [lots, setLots] = useState<DraftLot[]>([]),
    [criteria, setCriteria] = useState<DraftCriterion[]>([
      {
        name: "Price",
        description: "Commercial value and price completeness",
        criterionType: "scored",
        weight: 30,
        scoreMin: 0,
        scoreMax: 10,
        guidance: "Score the complete commercial offer against the published basis.",
        mandatory: false,
        lotNumber: null,
        section: "commercial",
      },
      {
        name: "Technical quality",
        description: "Technical compliance and quality",
        criterionType: "scored",
        weight: 40,
        scoreMin: 0,
        scoreMax: 10,
        guidance: "Score only against the published technical requirements.",
        mandatory: false,
        lotNumber: null,
        section: "technical",
      },
      {
        name: "Experience",
        description: "Relevant delivery experience",
        criterionType: "scored",
        weight: 20,
        scoreMin: 0,
        scoreMax: 10,
        guidance: "Use the experience evidence included in the bid.",
        mandatory: false,
        lotNumber: null,
        section: "experience",
      },
      {
        name: "Delivery",
        description: "Delivery plan and timescale",
        criterionType: "scored",
        weight: 10,
        scoreMin: 0,
        scoreMax: 10,
        guidance: "Assess the proposed delivery plan.",
        mandatory: false,
        lotNumber: null,
        section: "delivery",
      },
    ]);
  const existing = useData<{ data: Tender }>(
    tenderId ? `/api/procurement?resource=tender&id=${tenderId}` : null,
  );
  useEffect(() => {
    const tender = existing.data?.data;
    if (!tenderId || !tender) return;
    // The remote draft is the authoritative initial value for these dynamic rows.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLots(
      (tender.lots || []).map((lot) => ({
        lotNumber: lot.lot_number,
        title: lot.title,
        description: lot.description,
        quantity: lot.quantity ?? null,
        budget: lot.budget ?? null,
        requirements: lot.requirements || "",
        evaluationCriteria: lot.evaluation_criteria || [],
      })),
    );
    setCriteria(
      (tender.criteria || []).map((criterion) => ({
        name: criterion.name,
        description: criterion.description || "",
        criterionType: criterion.criterion_type as DraftCriterion["criterionType"],
        weight: criterion.weight,
        scoreMin: criterion.score_min,
        scoreMax: criterion.score_max,
        guidance: criterion.guidance,
        mandatory: Boolean(criterion.mandatory),
        lotNumber: tender.lots?.find((lot) => lot.id === criterion.lot_id)?.lot_number || null,
        section: criterion.section || "general",
      })),
    );
  }, [existing.data?.data, tenderId]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget),
      dt = (name: string) => {
        const v = String(f.get(name) || "");
        return v ? new Date(v).toISOString() : null;
      },
      csv = (name: string) =>
        String(f.get(name) || "")
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean);
    try {
      const result = await api<{ data: { id: string } }>("/api/procurement", {
        action: "save_tender",
        id: tenderId,
        tender: {
          title: f.get("title"),
          referenceNumber: f.get("referenceNumber") || null,
          description: f.get("description"),
          tenderType: f.get("tenderType"),
          procurementCategory: f.get("procurementCategory"),
          classification: f.get("classification"),
          location: f.get("location") || null,
          currency: f.get("currency"),
          estimatedBudget: f.get("estimatedBudget")
            ? Number(f.get("estimatedBudget"))
            : null,
          issueDate: dt("issueDate"),
          clarificationDeadline: dt("clarificationDeadline"),
          submissionDeadline: dt("submissionDeadline"),
          expectedAwardDate: f.get("expectedAwardDate") || null,
          expectedContractStartDate: f.get("expectedContractStartDate") || null,
          eligibilityRequirements: f.get("eligibilityRequirements"),
          technicalRequirements: f.get("technicalRequirements"),
          commercialRequirements: f.get("commercialRequirements"),
          deliveryRequirements: f.get("deliveryRequirements"),
          termsAndConditions: f.get("termsAndConditions"),
          procurementOwnerName: f.get("procurementOwnerName") || null,
          procurementOwnerEmail: f.get("procurementOwnerEmail") || null,
          awardStructure: f.get("awardStructure"),
          bidOpeningModel: f.get("bidOpeningModel"),
          visibility: f.get("visibility"),
          questionsAllowed: f.get("questionsAllowed") === "on",
          supplierIdentityVisibleBeforeOpening:
            f.get("supplierIdentityVisibleBeforeOpening") === "on",
          withdrawalAllowed: f.get("withdrawalAllowed") === "on",
          approvalRequired: f.get("approvalRequired") === "on",
          publishAwardPublicly: false,
          lots,
          requirements: [
            ...csv("eligibilityList").map((title, i) => ({
              section: "eligibility",
              title,
              description: "",
              mandatory: true,
              displayOrder: i,
            })),
            ...csv("technicalList").map((title, i) => ({
              section: "technical",
              title,
              description: "",
              mandatory: true,
              displayOrder: 100 + i,
            })),
          ],
          requiredDocuments: csv("requiredDocuments").map((name, i) => ({
            name,
            description: "",
            mandatory: true,
            acceptedMimeTypes: [],
            displayOrder: i,
          })),
          criteria: criteria.map((c, i) => ({ ...c, displayOrder: i })),
        },
      });
      invalidate();
      router.push(`/procurement/tenders/${result.data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const defaults = existing.data?.data;
  const localDateTime = (value?: string | null) =>
    value ? new Date(value).toISOString().slice(0, 16) : "";
  return (
    <>
      <Heading
        title={tenderId ? "Edit tender draft" : "Create a BidScope Tender"}
        description="Build a structured, auditable procurement. Every field is stored as procurement data—not a decorative PDF form."
      />
      <form className="pw-form mt-5" key={defaults?.id || "new"} onSubmit={save}>
        <section className="pw-form-section">
          <h2>1. Tender identity</h2>
          <p>Give suppliers enough context to assess the opportunity.</p>
          <div className="pw-fields">
            <label className="wide">
              Tender title
              <input
                required
                name="title"
                minLength={5}
                defaultValue={defaults?.title}
              />
            </label>
            <label>
              Reference number
              <input
                name="referenceNumber"
                defaultValue={defaults?.reference_number || ""}
              />
            </label>
            <label>
              Tender type
              <select
                name="tenderType"
                defaultValue={defaults?.tender_type || "rfq"}
              >
                {[
                  ["rfq", "RFQ"],
                  ["rfp", "RFP"],
                  ["eoi", "EOI"],
                  ["itt", "ITT / Invitation to Tender"],
                  ["prequalification", "Prequalification"],
                  ["other", "Other"],
                ].map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Procurement category
              <input
                required
                name="procurementCategory"
                defaultValue={defaults?.procurement_category}
              />
            </label>
            <label>
              Classification
              <select
                name="classification"
                defaultValue={defaults?.classification || "goods"}
              >
                {["goods", "services", "works", "consulting", "other"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Location
              <input name="location" defaultValue={defaults?.location || ""} />
            </label>
            <label>
              Currency
              <input
                required
                maxLength={3}
                name="currency"
                defaultValue={defaults?.currency || "GHS"}
              />
            </label>
            <label>
              Estimated budget
              <input
                type="number"
                min="0"
                name="estimatedBudget"
                defaultValue={defaults?.estimated_budget || ""}
              />
            </label>
            <label className="wide">
              Description
              <textarea
                required
                minLength={20}
                rows={6}
                name="description"
                defaultValue={defaults?.description}
              />
            </label>
          </div>
        </section>
        <section className="pw-form-section">
          <h2>2. Timeline and contacts</h2>
          <p>Deadlines are enforced by the server.</p>
          <div className="pw-fields">
            <label>
              Issue date/time
              <input type="datetime-local" name="issueDate" defaultValue={localDateTime(defaults?.issue_date)} />
            </label>
            <label>
              Clarification deadline
              <input type="datetime-local" name="clarificationDeadline" defaultValue={localDateTime(defaults?.clarification_deadline)} />
            </label>
            <label>
              Submission deadline
              <input required type="datetime-local" name="submissionDeadline" defaultValue={localDateTime(defaults?.submission_deadline)} />
            </label>
            <label>
              Expected award date
              <input type="date" name="expectedAwardDate" />
            </label>
            <label>
              Expected contract start
              <input type="date" name="expectedContractStartDate" />
            </label>
            <label>
              Procurement owner
              <input name="procurementOwnerName" />
            </label>
            <label>
              Owner email
              <input type="email" name="procurementOwnerEmail" />
            </label>
          </div>
        </section>
        <section className="pw-form-section">
          <h2>3. Requirements</h2>
          <p>Use one line per mandatory item or document.</p>
          <div className="pw-fields">
            <label className="wide">
              Eligibility overview
              <textarea rows={4} name="eligibilityRequirements" defaultValue={defaults?.eligibility_requirements || ""} />
            </label>
            <label>
              Eligibility checklist
              <textarea
                rows={7}
                name="eligibilityList"
                defaultValue={(defaults?.requirements || []).filter((item) => item.section === "eligibility").map((item) => item.title).join("\n")}
                placeholder="Valid business registration&#10;Tax clearance certificate"
              />
            </label>
            <label>
              Technical checklist
              <textarea
                rows={7}
                name="technicalList"
                defaultValue={(defaults?.requirements || []).filter((item) => item.section === "technical").map((item) => item.title).join("\n")}
                placeholder="Technical methodology&#10;Relevant project experience"
              />
            </label>
            <label className="wide">
              Technical requirements
              <textarea rows={4} name="technicalRequirements" defaultValue={defaults?.technical_requirements || ""} />
            </label>
            <label>
              Commercial requirements
              <textarea rows={4} name="commercialRequirements" defaultValue={defaults?.commercial_requirements || ""} />
            </label>
            <label>
              Delivery requirements
              <textarea rows={4} name="deliveryRequirements" defaultValue={defaults?.delivery_requirements || ""} />
            </label>
            <label className="wide">
              Required documents
              <textarea
                rows={6}
                name="requiredDocuments"
                defaultValue={(defaults?.requiredDocuments || []).map((item) => item.name).join("\n")}
                placeholder="Certificate of incorporation&#10;Tax clearance&#10;Technical proposal"
              />
            </label>
            <label className="wide">
              Terms and conditions
              <textarea rows={6} name="termsAndConditions" defaultValue={defaults?.terms_and_conditions || ""} />
            </label>
          </div>
        </section>
        <section className="pw-form-section">
          <h2>4. Award and opening controls</h2>
          <div className="pw-option-grid">
            {[
              [
                "single",
                "Single winner",
                "One supplier receives the contract.",
              ],
              [
                "multiple",
                "Multiple winners",
                "More than one supplier may receive an award.",
              ],
              [
                "lots",
                "Lots / categories",
                "Different suppliers may win different lots.",
              ],
            ].map(([v, t, b]) => (
              <label className="pw-option" key={v}>
                <input
                  type="radio"
                  name="awardStructure"
                  value={v}
                  defaultChecked={v === (defaults?.award_structure || "single")}
                />
                <strong>{t}</strong>
                <small>{b}</small>
              </label>
            ))}
          </div>
          {lots.map((lot, i) => (
            <div className="pw-fields mt-3" key={i}>
              <label>
                Lot number
                <input
                  value={lot.lotNumber}
                  onChange={(e) =>
                    setLots((x) =>
                      x.map((l, n) =>
                        n === i ? { ...l, lotNumber: e.target.value } : l,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Lot title
                <input
                  value={lot.title}
                  onChange={(e) =>
                    setLots((x) =>
                      x.map((l, n) =>
                        n === i ? { ...l, title: e.target.value } : l,
                      ),
                    )
                  }
                />
              </label>
              <label className="wide">
                Description
                <textarea
                  value={lot.description}
                  onChange={(e) =>
                    setLots((x) =>
                      x.map((l, n) =>
                        n === i ? { ...l, description: e.target.value } : l,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min="0"
                  value={lot.quantity ?? ""}
                  onChange={(e) => setLots((items) => items.map((item, index) => index === i ? { ...item, quantity: e.target.value ? Number(e.target.value) : null } : item))}
                />
              </label>
              <label>
                Lot budget
                <input
                  type="number"
                  min="0"
                  value={lot.budget ?? ""}
                  onChange={(e) => setLots((items) => items.map((item, index) => index === i ? { ...item, budget: e.target.value ? Number(e.target.value) : null } : item))}
                />
              </label>
              <label className="wide">
                Lot-specific requirements
                <textarea
                  value={lot.requirements}
                  onChange={(e) => setLots((items) => items.map((item, index) => index === i ? { ...item, requirements: e.target.value } : item))}
                />
              </label>
              <button type="button" className="pw-button" onClick={() => setLots((items) => items.filter((_, index) => index !== i))}>
                Remove lot
              </button>
            </div>
          ))}
          <button
            type="button"
            className="pw-button mt-3"
            onClick={() =>
              setLots((x) => [
                ...x,
                { lotNumber: String(x.length + 1), title: "", description: "", quantity: null, budget: null, requirements: "", evaluationCriteria: [] },
              ])
            }
          >
            <Plus size={14} />
            Add lot
          </button>
          <div className="pw-option-grid mt-5">
            {[
              [
                "sealed",
                "Sealed until deadline",
                "Protected bid content stays unavailable until closing.",
              ],
              [
                "open_as_received",
                "Open as received",
                "Authorised buyer users may review submissions as they arrive.",
              ],
            ].map(([v, t, b]) => (
              <label className="pw-option" key={v}>
                <input
                  type="radio"
                  name="bidOpeningModel"
                  value={v}
                  defaultChecked={v === (defaults?.bid_opening_model || "sealed")}
                />
                <strong>{t}</strong>
                <small>{b}</small>
              </label>
            ))}
          </div>
          <div className="pw-fields mt-5">
            <label>
              Visibility
              <select name="visibility" defaultValue={defaults?.visibility || "open"}>
                <option value="open">Open to eligible suppliers</option>
                <option value="invite_only">Invite only</option>
                <option value="open_preferred">
                  Open + preferred invitations
                </option>
              </select>
            </label>
            <label className="pw-check">
              <input type="checkbox" name="questionsAllowed" defaultChecked={defaults?.questions_allowed ?? true} />
              Allow supplier questions
            </label>
            <label className="pw-check">
              <input type="checkbox" name="withdrawalAllowed" defaultChecked={defaults?.withdrawal_allowed ?? true} />
              Allow withdrawal before deadline
            </label>
            <label className="pw-check">
              <input
                type="checkbox"
                name="supplierIdentityVisibleBeforeOpening"
                defaultChecked={defaults?.supplier_identity_visible_before_opening ?? false}
              />
              Reveal supplier identity before bid opening
            </label>
            <label className="pw-check">
              <input type="checkbox" name="approvalRequired" defaultChecked={defaults?.approval_required ?? false} />
              Require award approval
            </label>
          </div>
        </section>
        <section className="pw-form-section">
          <h2>5. Evaluation criteria</h2>
          <p>Weighted scored criteria must total exactly 100%.</p>
          {criteria.map((criterion, i) => (
            <div className="pw-fields mb-3" key={i}>
              <label>
                Name
                <input
                  value={criterion.name}
                  onChange={(e) =>
                    setCriteria((x) =>
                      x.map((c, n) =>
                        n === i ? { ...c, name: e.target.value } : c,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Type
                <select
                  value={criterion.criterionType}
                  onChange={(e) =>
                    setCriteria((x) =>
                      x.map((c, n) =>
                        n === i
                          ? {
                              ...c,
                              criterionType: e.target
                                .value as DraftCriterion["criterionType"],
                            }
                          : c,
                      ),
                    )
                  }
                >
                  <option value="scored">Scored</option>
                  <option value="pass_fail">Pass / fail</option>
                  <option value="text">Text assessment</option>
                </select>
              </label>
              <label>
                Weight %
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={criterion.weight ?? ""}
                  onChange={(e) =>
                    setCriteria((x) =>
                      x.map((c, n) =>
                        n === i
                          ? {
                              ...c,
                              weight: e.target.value
                                ? Number(e.target.value)
                                : null,
                            }
                          : c,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Section
                <select
                  value={criterion.section}
                  onChange={(e) =>
                    setCriteria((x) =>
                      x.map((c, n) =>
                        n === i
                          ? {
                              ...c,
                              section: e.target
                                .value as DraftCriterion["section"],
                            }
                          : c,
                      ),
                    )
                  }
                >
                  {[
                    "general",
                    "technical",
                    "commercial",
                    "experience",
                    "delivery",
                    "compliance",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="wide">
                Description
                <textarea
                  value={criterion.description}
                  onChange={(e) => setCriteria((items) => items.map((item, index) => index === i ? { ...item, description: e.target.value } : item))}
                />
              </label>
              <label>
                Minimum score
                <input type="number" value={criterion.scoreMin} onChange={(e) => setCriteria((items) => items.map((item, index) => index === i ? { ...item, scoreMin: Number(e.target.value) } : item))} />
              </label>
              <label>
                Maximum score
                <input type="number" value={criterion.scoreMax} onChange={(e) => setCriteria((items) => items.map((item, index) => index === i ? { ...item, scoreMax: Number(e.target.value) } : item))} />
              </label>
              <label>
                Applies to lot
                <select value={criterion.lotNumber || ""} onChange={(e) => setCriteria((items) => items.map((item, index) => index === i ? { ...item, lotNumber: e.target.value || null } : item))}>
                  <option value="">All tender lots</option>
                  {lots.map((lot) => <option key={lot.lotNumber} value={lot.lotNumber}>{lot.lotNumber} · {lot.title || "Untitled lot"}</option>)}
                </select>
              </label>
              <label className="pw-check">
                <input type="checkbox" checked={criterion.mandatory} onChange={(e) => setCriteria((items) => items.map((item, index) => index === i ? { ...item, mandatory: e.target.checked } : item))} />
                Mandatory criterion
              </label>
              <label className="wide">
                Evaluator guidance
                <textarea value={criterion.guidance} onChange={(e) => setCriteria((items) => items.map((item, index) => index === i ? { ...item, guidance: e.target.value } : item))} />
              </label>
              <button type="button" className="pw-button" onClick={() => setCriteria((items) => items.filter((_, index) => index !== i))}>
                Remove criterion
              </button>
            </div>
          ))}
          <button
            type="button"
            className="pw-button"
            onClick={() =>
              setCriteria((x) => [
                ...x,
                {
                  name: "",
                  description: "",
                  criterionType: "scored",
                  weight: 0,
                  scoreMin: 0,
                  scoreMax: 10,
                  guidance: "",
                  mandatory: false,
                  lotNumber: null,
                  section: "general",
                },
              ])
            }
          >
            <Plus size={14} />
            Add criterion
          </button>
        </section>
        {error && <p className="pw-error">{error}</p>}
        <div className="pw-actions">
          <button disabled={busy} className="pw-button primary">
            {busy ? "Saving…" : "Save tender draft"}
          </button>
          <Link className="pw-button" href="/procurement/tenders">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}

function TenderDetail({ id }: { id: string }) {
  const result = useData<{ data: Tender }>(
      `/api/procurement?resource=tender&id=${id}`,
    ),
    clarifications = useData<{ data: Clarification[] }>(
      `/api/procurement?resource=clarifications&tenderId=${id}`,
    ),
    [message, setMessage] = useState("");
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorState message={result.error} />;
  const t = result.data!.data;
  async function publish() {
    try {
      const r = await api<{ data: { status: string } }>("/api/procurement", {
        action: "publish_tender",
        tenderId: t.id,
      });
      setMessage(`Tender is now ${r.data.status}.`);
      invalidate();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function changeDeadline() {
    const current = new Date(t.submission_deadline).toISOString().slice(0, 16);
    const next = window.prompt("New submission deadline (local date and time)", current);
    if (!next) return;
    const parsed = new Date(next);
    if (Number.isNaN(parsed.getTime())) {
      setMessage("Enter a valid deadline.");
      return;
    }
    const clarification = window.prompt(
      "Optional clarification deadline (local date and time)",
      t.clarification_deadline ? new Date(t.clarification_deadline).toISOString().slice(0, 16) : "",
    );
    try {
      await api("/api/procurement", {
        action: "update_deadline",
        tenderId: t.id,
        submissionDeadline: parsed.toISOString(),
        clarificationDeadline: clarification ? new Date(clarification).toISOString() : null,
      });
      setMessage("Deadline updated and participating suppliers notified.");
      invalidate();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function cancelTender() {
    const reason = window.prompt("Reason for cancelling this tender");
    if (!reason) return;
    if (!window.confirm("Cancel this tender and notify participating suppliers?")) return;
    try {
      await api("/api/procurement", { action: "cancel_tender", tenderId: t.id, reason });
      setMessage("Tender cancelled and participating suppliers notified.");
      invalidate();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="BIDSCOPE TENDER"
        title={t.title}
        description={`${t.tender_type.toUpperCase()} · ${t.procurement_category} · ${t.location || "Location not specified"}`}
        action={
          <>
            <Link
              className="pw-button gold"
              href={`/procurement/create/${t.id}`}
            >
              Edit draft
            </Link>
            {["draft", "pending_verification", "scheduled"].includes(
              t.status,
            ) && (
              <button
                className="pw-button primary"
                onClick={() => void publish()}
              >
                Publish tender
              </button>
            )}
            <Link
              className="pw-button"
              href={`/procurement/bids?tender=${t.id}`}
            >
              View bids
            </Link>
            {!['awarded', 'cancelled', 'archived'].includes(t.status) && (
              <button className="pw-button" onClick={() => void changeDeadline()}>
                Change deadline
              </button>
            )}
            {!['awarded', 'cancelled', 'archived'].includes(t.status) && (
              <button className="pw-button" onClick={() => void cancelTender()}>
                Cancel tender
              </button>
            )}
          </>
        }
      />
      {message && (
        <p
          className={
            message.includes("verification") ? "pw-error" : "pw-notice"
          }
        >
          {message}
        </p>
      )}
      <div className="pw-grid">
        <div className="pw-stat">
          <strong>{t.status}</strong>
          <span>Status</span>
        </div>
        <div className="pw-stat">
          <strong>{t.award_structure}</strong>
          <span>Award structure</span>
        </div>
        <div className="pw-stat">
          <strong>
            {t.bid_opening_model === "sealed" ? "Sealed" : "Open"}
          </strong>
          <span>Bid opening</span>
        </div>
        <div className="pw-stat">
          <strong>{t.lots?.length || 0}</strong>
          <span>Lots</span>
        </div>
        <div className="pw-stat">
          <strong>{t.criteria?.length || 0}</strong>
          <span>Evaluation criteria</span>
        </div>
      </div>
      <div className="pw-layout">
        <section className="pw-card">
          <h2>Scope and requirements</h2>
          <p>{t.description}</p>
          {[
            ["Eligibility", t.eligibility_requirements],
            ["Technical", t.technical_requirements],
            ["Commercial", t.commercial_requirements],
            ["Delivery", t.delivery_requirements],
          ].map(([label, value]) => (
            <div className="pw-row" key={label}>
              <span>
                <strong>{label}</strong>
                <small>{value || "Not specified"}</small>
              </span>
            </div>
          ))}
        </section>
        <aside className="pw-card">
          <h2>Critical dates</h2>
          <div className="pw-row">
            <span>
              <strong>Submission deadline</strong>
              <small>
                {new Date(t.submission_deadline).toLocaleString("en-GB")}
              </small>
            </span>
          </div>
          <div className="pw-row">
            <span>
              <strong>Clarification deadline</strong>
              <small>
                {t.clarification_deadline
                  ? new Date(t.clarification_deadline).toLocaleString("en-GB")
                  : "Not set"}
              </small>
            </span>
          </div>
          <Link
            className="pw-button primary mt-4"
            href={`/procurement/meetings?tender=${t.id}`}
          >
            Schedule procurement meeting
          </Link>
        </aside>
      </div>
      <section className="pw-card mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2>Tender documents</h2>
            <p>
              Upload controlled documents to the private BidScope storage
              bucket. Supplier access follows the selected visibility rule.
            </p>
          </div>
          <form
            className="pw-actions"
            onSubmit={async (event) => {
              event.preventDefault();
              const formElement = event.currentTarget,
                form = new FormData(formElement),
                file = form.get("file");
              if (!(file instanceof File) || !file.size) return;
              form.set("kind", "tender");
              form.set("entityId", t.id);
              try {
                await uploadAuthenticatedFile("/api/procurement/documents", form);
                setMessage("Tender document uploaded securely.");
                invalidate();
                formElement.reset();
              } catch (error) {
                setMessage((error as Error).message);
              }
            }}
          >
            <select name="visibility" defaultValue="eligible_suppliers">
              <option value="eligible_suppliers">Eligible suppliers</option>
              <option value="bidders">Submitted bidders</option>
              <option value="buyer_team">Buyer team only</option>
            </select>
            <input required type="file" name="file" />
            <button className="pw-button primary">
              <UploadCloud size={14} /> Upload
            </button>
          </form>
        </div>
        {t.tenderDocuments?.length ? (
          t.tenderDocuments.map((document) => (
            <button
              type="button"
              className="pw-row"
              key={document.id}
              onClick={() => void downloadAuthenticatedFile(
                `/api/procurement/documents?kind=tender&id=${document.id}`,
                document.original_filename,
              )}
            >
              <span>
                <strong>{document.original_filename}</strong>
                <small>
                  {(document.size_bytes / 1024 / 1024).toFixed(2)} MB ·{" "}
                  {document.visibility.replaceAll("_", " ")}
                </small>
              </span>
              <b>Download</b>
            </button>
          ))
        ) : (
          <p>No tender documents uploaded yet.</p>
        )}
      </section>
      <section className="pw-card mt-5">
        <h2>
          <MessageCircleQuestion size={18} /> Questions and clarifications
        </h2>
        {clarifications.loading ? (
          <p>Loading clarification thread…</p>
        ) : clarifications.error ? (
          <p className="pw-error">{clarifications.error}</p>
        ) : clarifications.data?.data.length ? (
          clarifications.data.data.map((item) => (
            <article className="pw-row" key={item.id}>
              <span>
                <strong>{item.subject}</strong>
                <small>{item.message}</small>
                <small>
                  {new Date(item.created_at).toLocaleString("en-GB")} ·{" "}
                  {item.status}
                </small>
              </span>
              {item.kind === "supplier_question" && item.status === "open" && (
                <button
                  className="pw-button"
                  onClick={async () => {
                    const response = window.prompt("Answer this question");
                    if (!response) return;
                    try {
                      await api("/api/procurement", {
                        action: "respond_clarification",
                        clarificationId: item.id,
                        message: response,
                      });
                      setMessage("Clarification answer sent.");
                      invalidate();
                    } catch (error) {
                      setMessage((error as Error).message);
                    }
                  }}
                >
                  Respond
                </button>
              )}
            </article>
          ))
        ) : (
          <p>No questions or clarification requests yet.</p>
        )}
      </section>
    </>
  );
}

// Legacy presentation retained temporarily while the richer inbox is in production.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BidInbox() {
  const params = useSearchParams(),
    router = useRouter(),
    tenderId = params.get("tender"),
    tenders = useData<{ data: Tender[] }>("/api/procurement?resource=tenders"),
    bids = useData<{
      data: Bid[];
      meta: { sealed: boolean; deadline: string };
    }>(tenderId ? `/api/procurement?resource=bids&tenderId=${tenderId}` : null),
    [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <Heading
        title="Bids received"
        description="Review structured submissions, respect sealed-opening rules and compare selected suppliers without automatic winner recommendations."
      />
      <label className="mt-5 block text-sm font-bold">
        Tender
        <select
          className="ml-3 rounded-xl border bg-white p-3"
          value={tenderId || ""}
          onChange={(e) =>
            router.push(`/procurement/bids?tender=${e.target.value}`)
          }
        >
          <option value="">Choose a tender</option>
          {tenders.data?.data.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      {!tenderId ? (
        <Empty
          title="Choose a tender"
          body="Select one of your tenders to view its bid inbox."
          href="/procurement/tenders"
          action="Open my tenders"
        />
      ) : bids.loading ? (
        <Loading />
      ) : bids.error ? (
        <ErrorState message={bids.error} />
      ) : bids.data?.meta.sealed ? (
        <section className="pw-empty">
          <ShieldCheck size={35} />
          <h2>Bids remain sealed</h2>
          <p>
            Protected technical and commercial content will become available
            after {new Date(bids.data.meta.deadline).toLocaleString("en-GB")}.
          </p>
        </section>
      ) : !bids.data?.data.length ? (
        <Empty
          title="No bids have been received yet"
          body="Submitted supplier bids will appear here."
        />
      ) : (
        <>
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
                </tr>
              </thead>
              <tbody>
                {bids.data.data.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(b.id)}
                        onChange={(e) =>
                          setSelected((x) =>
                            e.target.checked
                              ? [...x, b.id]
                              : x.filter((id) => id !== b.id),
                          )
                        }
                      />
                    </td>
                    <td>{b.supplier?.name || "Supplier"}</td>
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
                      <span className="pw-badge">{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {selected.length > 1 && (
            <section className="pw-card pw-compare mt-5">
              <h2>Compare selected bids</h2>
              <div className="pw-compare-grid">
                {bids.data.data
                  .filter((b) => selected.includes(b.id))
                  .map((b) => (
                    <article key={b.id}>
                      <h3>{b.supplier?.name || "Supplier"}</h3>
                      <p>
                        <strong>Price</strong>
                        <br />
                        {b.currency} {Number(b.bid_price || 0).toLocaleString()}
                      </p>
                      <p>
                        <strong>Delivery</strong>
                        <br />
                        {b.delivery_period || "Not stated"}
                      </p>
                      <p>
                        <strong>Validity</strong>
                        <br />
                        {b.bid_validity_days || "Not stated"} days
                      </p>
                      <span className="pw-badge">{b.status}</span>
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

function Evaluations() {
  return <EvaluationsWorkspace />;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Meetings() {
  return (
    <>
      <Heading
        title="Procurement meetings"
        description="Supplier interviews, presentations, clarifications, negotiations and committee meetings reuse BidScope Meet."
        action={
          <Link className="pw-button gold" href="/procurement/meetings">
            Schedule meeting
          </Link>
        }
      />
      <section className="pw-card mt-5">
        <h2>One meeting infrastructure</h2>
        <p>
          Procurement meetings use the existing secure Daily or Google Meet
          connection, attendance records, reminders, notes and action items.
        </p>
        <Link className="pw-button primary" href="/procurement/meetings">
          Open BidScope Meet
        </Link>
      </section>
    </>
  );
}
function Suppliers() {
  const params = useSearchParams(),
    q = params.get("q") || "",
    result = useData<{
      data: Array<{
        id: string;
        name: string;
        region: string | null;
        sectors: string[];
        services: string[];
        products: string[];
        certifications: string[];
      }>;
    }>(`/api/procurement?resource=suppliers&q=${encodeURIComponent(q)}`);
  return (
    <>
      <Heading
        title="Supplier directory"
        description="Find BidScope supplier organisations using business information they have chosen to maintain."
      />
      <form className="pw-card mt-5 flex gap-2" action="/procurement/suppliers">
        <input
          className="min-w-0 flex-1 rounded-xl border p-3"
          name="q"
          defaultValue={q}
          placeholder="Search supplier name, service or product"
        />
        <button className="pw-button primary">
          <Search size={15} />
          Search
        </button>
      </form>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} />
      ) : (
        <div className="pw-list mt-5">
          {result.data?.data.map((s) => (
            <article className="pw-card" key={s.id}>
              <div className="flex justify-between gap-4">
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    {s.region || "Location not provided"} ·{" "}
                    {s.sectors.join(", ") || "No sectors listed"}
                  </small>
                </span>
                <span className="pw-badge">BidScope supplier</span>
              </div>
              <p>
                {[...s.services, ...s.products].slice(0, 8).join(" · ") ||
                  "Products and services not provided."}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
function Reports() {
  const result = useData<{
    data: {
      tenders: number;
      active: number;
      bids: number;
      uniqueSuppliers: number;
      averageBids: number;
      awards: Array<{ contract_value: number; currency: string }>;
      categories: Record<string, Tender[]>;
    };
  }>("/api/procurement?resource=reports");
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorState message={result.error} />;
  const d = result.data!.data;
  return (
    <>
      <Heading
        title="Procurement reports"
        description="Organisation-specific participation, cycle and award indicators from live BidScope records."
      />
      <div className="pw-grid">
        {[
          ["Tenders", d.tenders],
          ["Active", d.active],
          ["Bids", d.bids],
          ["Suppliers", d.uniqueSuppliers],
          ["Average bids", d.averageBids],
        ].map(([l, v]) => (
          <div className="pw-stat" key={l}>
            <strong>{v}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <section className="pw-card">
        <h2>Category breakdown</h2>
        {Object.entries(d.categories).length ? (
          Object.entries(d.categories).map(([category, items]) => (
            <div className="pw-row" key={category}>
              <span>{category}</span>
              <strong>{items.length}</strong>
            </div>
          ))
        ) : (
          <p>No procurement data yet.</p>
        )}
      </section>
    </>
  );
}
function Team() {
  const result = useData<{
    data: {
      organizationId: string | null;
      canManage: boolean;
      members: Array<{
        user_id: string;
        role: string;
        procurement_role: string;
        profile: { email: string; full_name: string } | null;
      }>;
    };
  }>("/api/team");
  const [message, setMessage] = useState("");
  const roles = [
    "procurement_manager",
    "procurement_officer",
    "evaluator",
    "technical_expert",
    "finance_evaluator",
    "approver",
    "viewer",
    "bid_team_member",
  ];
  return (
    <>
      <Heading
        title="Procurement team"
        description="Use your existing BidScope organisation team, then assign procurement-specific responsibilities per tender."
      />
      <section className="pw-card mt-5">
        <h2>Manage organisation members</h2>
        <p>
          Owners and administrators can invite team members from the existing
          team workspace. Evaluator access remains tender-specific.
        </p>
        <Link className="pw-button primary" href="/customer/team">
          Invite or remove team members
        </Link>
        {message && <p className="pw-notice mt-4">{message}</p>}
        {result.loading ? (
          <p className="mt-5">Loading procurement roles…</p>
        ) : result.error ? (
          <ErrorState message={result.error} />
        ) : (
          <div className="mt-5">
            {result.data?.data.members.map((member) => (
              <div className="pw-row" key={member.user_id}>
                <span>
                  <strong>{member.profile?.full_name || member.profile?.email || "Workspace member"}</strong>
                  <small>{member.profile?.email} · workspace {member.role}</small>
                </span>
                {member.role === "owner" ? (
                  <span className="pw-badge">organisation owner</span>
                ) : (
                  <select
                    aria-label={`Procurement role for ${member.profile?.email || "member"}`}
                    disabled={!result.data?.data.canManage}
                    value={member.procurement_role}
                    onChange={async (event) => {
                      if (!result.data?.data.organizationId) return;
                      try {
                        await api("/api/team", {
                          action: "set_procurement_role",
                          organizationId: result.data.data.organizationId,
                          userId: member.user_id,
                          procurementRole: event.target.value,
                        });
                        setMessage("Procurement role updated.");
                        invalidate();
                      } catch (error) {
                        setMessage((error as Error).message);
                      }
                    }}
                  >
                    {roles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
function ProcurementSettings() {
  const result = useData<{ data: Capabilities }>(
      "/api/procurement?resource=capabilities",
    ),
    [message, setMessage] = useState("");
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorState message={result.error} />;
  const d = result.data!.data;
  return (
    <>
      <Heading
        title="Organisation capabilities"
        description="One account can bid for work, procure goods and services, or do both."
      />
      <section className="pw-card mt-5">
        <h2>Capabilities</h2>
        <div className="pw-row">
          <span>
            <strong>Bid for opportunities</strong>
            <small>Supplier discovery, bid preparation and submission.</small>
          </span>
          <input
            type="checkbox"
            defaultChecked={d.organization.can_bid}
            id="cap-bid"
          />
        </div>
        <div className="pw-row">
          <span>
            <strong>Procure goods and services</strong>
            <small>Create and manage BidScope-hosted tenders.</small>
          </span>
          <input
            type="checkbox"
            defaultChecked={d.organization.can_procure}
            id="cap-procure"
          />
        </div>
        {["owner", "admin"].includes(d.membershipRole) && (
          <button
            className="pw-button primary mt-4"
            onClick={async () => {
              try {
                await api("/api/procurement", {
                  action: "capabilities",
                  canBid: (
                    document.getElementById("cap-bid") as HTMLInputElement
                  ).checked,
                  canProcure: (
                    document.getElementById("cap-procure") as HTMLInputElement
                  ).checked,
                });
                setMessage("Capabilities updated.");
                invalidate();
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Save capabilities
          </button>
        )}
      </section>
      <VerificationPanel
        organizationId={d.organizationId}
        status={d.verification.status}
        message={message}
        setMessage={setMessage}
      />
    </>
  );
}
function VerificationPanel({
  organizationId,
  status,
  message,
  setMessage,
}: {
  organizationId: string;
  status: string;
  message: string;
  setMessage: (v: string) => void;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      const files = f.getAll("verificationFiles").filter(
        (item): item is File => item instanceof File && item.size > 0,
      );
      if (!files.length)
        throw new Error("Upload at least one official verification document.");
      const documentPaths: string[] = [];
      for (const file of files) {
        const upload = new FormData();
        upload.set("kind", "verification");
        upload.set("entityId", organizationId);
        upload.set("file", file);
        const result = await uploadAuthenticatedFile<{
          data: { path: string };
        }>("/api/procurement/documents", upload);
        documentPaths.push(result.data.path);
      }
      await api("/api/procurement", {
        action: "submit_verification",
        verification: {
          organizationName: f.get("organizationName"),
          registrationNumber: f.get("registrationNumber"),
          officialCompanyEmail: f.get("officialCompanyEmail"),
          contactPerson: f.get("contactPerson"),
          organizationType: f.get("organizationType") || null,
          documentPaths,
        },
      });
      setMessage("Buyer verification submitted for review.");
      invalidate();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section className="pw-card mt-5">
      <div className="flex items-center justify-between gap-4">
        <h2>Buyer verification</h2>
        <span className={`pw-badge ${status === "verified" ? "" : "gold"}`}>
          {status}
        </span>
      </div>
      <p>
        Verified buyer status protects suppliers from organisation
        impersonation. Drafting is available before approval; publishing is not.
      </p>
      {status !== "verified" && (
        <form className="pw-fields mt-5" onSubmit={submit}>
          <label>
            Organisation name
            <input required name="organizationName" />
          </label>
          <label>
            Registration number
            <input required name="registrationNumber" />
          </label>
          <label>
            Official company email
            <input required type="email" name="officialCompanyEmail" />
          </label>
          <label>
            Contact person
            <input required name="contactPerson" />
          </label>
          <label>
            Organisation type
            <input
              name="organizationType"
              placeholder="Company, NGO, public authority…"
            />
          </label>
          <label>
            Official verification documents
            <input
              required
              multiple
              type="file"
              name="verificationFiles"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            />
            <small>
              Upload registration evidence or another official organisation document. Files stay private.
            </small>
          </label>
          <button className="pw-button primary">Submit for verification</button>
        </form>
      )}
      {message && <p className="pw-notice mt-4">{message}</p>}
    </section>
  );
}
