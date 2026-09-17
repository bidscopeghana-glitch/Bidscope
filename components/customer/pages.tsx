"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  api,
  date,
  invalidate,
  officialUrl,
  useData,
  type Opportunity,
  type Notice,
  type Pulse,
  type RetentionOverview,
} from "./data";
import { Empty, Skeleton, useAccount } from "./shell";
import { HomePage, PanelTitle } from "./home";
import { Discovery } from "./opportunities";
const Detail = dynamic(() => import("./detail").then((m) => m.Detail), {
  loading: Skeleton,
});
const AIAnalysis = dynamic(() => import("./detail").then((m) => m.AIAnalysis), {
  loading: Skeleton,
});
const BidsPage = dynamic(() => import("./bids").then((m) => m.BidsPage), {
  loading: Skeleton,
});
export function CustomerPage({
  section,
  identifier,
}: {
  section: string;
  identifier?: string;
}) {
  if (section === "home") return <HomePage />;
  if (["discover", "recommended", "saved", "recent"].includes(section))
    return (
      <Discovery
        key={section}
        collection={section === "discover" ? undefined : section}
      />
    );
  if (section === "opportunity" && identifier)
    return <Detail slug={identifier} />;
  if (["bids", "pipeline", "deadlines"].includes(section))
    return (
      <BidsPage
        pipeline={section === "pipeline"}
        calendar={section === "deadlines"}
      />
    );
  if (section === "profile") return <BusinessProfile />;
  if (section === "team") return <TeamPage />;
  if (section === "readiness") return <ReadinessPage />;
  if (section === "billing") return <BillingPage />;
  if (section === "settings") return <SettingsPage />;
  if (section === "notifications") return <Notifications />;
  if (section === "alerts") return <Alerts />;
  if (section === "following") return <Following />;
  if (section === "buyers") return <Buyers />;
  if (section === "intelligence") return <Intelligence />;
  if (section === "awards") return <Awards />;
  if (section === "documents") return <Documents />;
  if (section === "ai") return <AIPage />;
  return <Help />;
}
function Heading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const image = /award|billing|team|profile|readiness/i.test(title)
    ? "/images/contract-win.webp"
    : /alert|notification|document|setting/i.test(title)
      ? "/images/ghana-supplier.webp"
      : "/images/bidscope-hero.webp";
  return (
    <div className="cc-page-heading">
      <div>
        <p className="cc-eyebrow">BIDSCOPE WORKSPACE</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="cc-page-heading-image" aria-hidden="true">
        <Image src={image} alt="" fill sizes="(max-width: 768px) 96px, 180px" />
      </div>
    </div>
  );
}
function BusinessProfile() {
  const { organization, profile, toast } = useAccount();
  const [busy, setBusy] = useState(false);
  const lists = [
    ["sectors", "Sectors"],
    ["services", "Services"],
    ["products", "Products"],
    ["certifications", "Certifications"],
    ["preferred_regions", "Service regions"],
    ["preferred_countries", "Preferred countries"],
    ["preferred_buyers", "Preferred buyers"],
    ["excluded_buyers", "Excluded buyers"],
    ["preferred_opportunity_types", "Preferred opportunity types"],
    ["cpv_codes", "CPV codes"],
    ["unspsc_codes", "UNSPSC codes"],
  ] as const;
  return (
    <>
      <Heading
        title="Your business profile"
        description="Better information creates better recommendations. Keep your capabilities up to date."
      />
      <form
        className="cc-editor cc-profile-form"
        key={organization?.id || "new"}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            await api("/api/me", { fullName: f.get("fullName") }, "PATCH");
            if (!organization) {
              const name = String(f.get("name"));
              await api("/api/organizations", {
                name,
                slug:
                  (name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
                    .slice(0, 60) || "business") +
                  "-" +
                  crypto.randomUUID().slice(0, 8),
                sectors: String(f.get("sectors"))
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
                region: f.get("region") || null,
              });
              toast(
                "Business created. Add the rest of your capabilities below.",
              );
            } else {
              await api("/api/customer", {
                resource: "business",
                organizationId: organization.id,
                business: {
                  name: f.get("name"),
                  region: f.get("region") || null,
                  business_description: f.get("description") || null,
                  registration_number: f.get("registration") || null,
                  website: f.get("website") || null,
                  phone: f.get("phone") || null,
                  company_size: f.get("companySize") || null,
                  annual_turnover_min: f.get("turnoverMin")
                    ? Number(f.get("turnoverMin"))
                    : null,
                  annual_turnover_max: f.get("turnoverMax")
                    ? Number(f.get("turnoverMax"))
                    : null,
                  turnover_currency: f.get("turnoverCurrency") || null,
                  international_willingness:
                    f.get("international") === "yes"
                      ? true
                      : f.get("international") === "no"
                        ? false
                        : null,
                  local_partnership_willingness:
                    f.get("partnership") === "yes"
                      ? true
                      : f.get("partnership") === "no"
                        ? false
                        : null,
                  ...Object.fromEntries(
                    lists.map(([key]) => [
                      key,
                      String(f.get(key) || "")
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    ]),
                  ),
                  preferred_minimum_value: f.get("minimum")
                    ? Number(f.get("minimum"))
                    : null,
                  preferred_maximum_value: f.get("maximum")
                    ? Number(f.get("maximum"))
                    : null,
                },
              });
              await api("/api/retention", { resource: "recalculate" });
              toast("Business profile and readiness score updated.");
            }
            invalidate();
          } catch (e) {
            toast((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Identity & capabilities</h2>
        <div className="cc-form-grid">
          <label>
            Your full name
            <input name="fullName" defaultValue={profile?.full_name || ""} />
          </label>
          <label>
            Business name
            <input
              required
              name="name"
              defaultValue={organization?.name || ""}
            />
          </label>
          <label>
            Registration number
            <input
              name="registration"
              defaultValue={organization?.registration_number || ""}
            />
          </label>
          <label>
            Website
            <input
              type="url"
              name="website"
              defaultValue={organization?.website || ""}
              placeholder="https://"
            />
          </label>
          <label>
            Business phone
            <input name="phone" defaultValue={organization?.phone || ""} />
          </label>
          <label>
            Company size
            <input
              name="companySize"
              defaultValue={organization?.company_size || ""}
              placeholder="e.g. 11–50 employees"
            />
          </label>
          <label className="cc-form-span">
            Business description
            <textarea
              name="description"
              rows={4}
              defaultValue={organization?.business_description || ""}
            />
          </label>
          <label>
            Main operating region
            <input name="region" defaultValue={organization?.region || ""} />
          </label>
          {lists.map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                defaultValue={organization?.[key]?.join(", ") || ""}
                placeholder="Separate with commas"
              />
            </label>
          ))}
          <label>
            Minimum preferred contract value
            <input
              type="number"
              min="0"
              name="minimum"
              defaultValue={organization?.preferred_minimum_value ?? ""}
            />
          </label>
          <label>
            Maximum preferred contract value
            <input
              type="number"
              min="0"
              name="maximum"
              defaultValue={organization?.preferred_maximum_value ?? ""}
            />
          </label>
          <label>
            Annual turnover minimum
            <input
              type="number"
              min="0"
              name="turnoverMin"
              defaultValue={organization?.annual_turnover_min ?? ""}
            />
          </label>
          <label>
            Annual turnover maximum
            <input
              type="number"
              min="0"
              name="turnoverMax"
              defaultValue={organization?.annual_turnover_max ?? ""}
            />
          </label>
          <label>
            Turnover currency
            <input
              name="turnoverCurrency"
              maxLength={3}
              defaultValue={organization?.turnover_currency || "GHS"}
            />
          </label>
          <label>
            Open to international opportunities?
            <select
              name="international"
              defaultValue={
                organization?.international_willingness === true
                  ? "yes"
                  : organization?.international_willingness === false
                    ? "no"
                    : "unknown"
              }
            >
              <option value="unknown">Not specified</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            Open to local partnerships?
            <select
              name="partnership"
              defaultValue={
                organization?.local_partnership_willingness === true
                  ? "yes"
                  : organization?.local_partnership_willingness === false
                    ? "no"
                    : "unknown"
              }
            >
              <option value="unknown">Not specified</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
        <p className="cc-quiet">
          Scores only use the evidence you save here and the information
          published by the official source. Unknown information remains labelled
          unknown.
        </p>
        <button disabled={busy} className="cc-button primary">
          {busy
            ? "Saving…"
            : organization
              ? "Save and recalculate"
              : "Create business profile"}
        </button>
      </form>
    </>
  );
}
function ReadinessPage() {
  const r = useData<{ data: RetentionOverview }>(
    "/api/retention?resource=overview",
  );
  const labels: Record<string, string> = {
    companyInformation: "Company information",
    legalRegistration: "Legal & registration",
    financialInformation: "Financial readiness",
    experience: "Experience evidence",
    technicalCapability: "Technical capability",
    certifications: "Certifications",
    tenderDocuments: "Tender documentation",
    internationalReadiness: "International readiness",
    bidManagement: "Bid management readiness",
  };
  return (
    <>
      <Heading
        title="Tender readiness"
        description="A practical evidence score for your ability to compete, not a profile-completion badge."
      />
      {r.loading ? (
        <Skeleton />
      ) : r.error ? (
        <p className="cc-error">{r.error}</p>
      ) : r.data?.data.readiness ? (
        <>
          <section className="cc-editor cc-readiness-detail">
            <div className="cc-readiness-total">
              <strong>{r.data.data.readiness.overallScore}%</strong>
              <span>
                Global readiness · {r.data.data.readiness.confidence} evidence
                confidence
              </span>
            </div>
            <div className="cc-score-grid">
              {Object.entries(r.data.data.readiness.categoryScores).map(
                ([key, item]) => (
                  <div key={key}>
                    <span>{labels[key] || key}</span>
                    <strong>{item.score}%</strong>
                    <progress max={100} value={item.score} />
                  </div>
                ),
              )}
            </div>
          </section>
          <section className="cc-editor">
            <h2>Improve your readiness</h2>
            {r.data.data.readiness.recommendations.length ? (
              r.data.data.readiness.recommendations.map((item) => (
                <Link
                  className="cc-readiness-action"
                  key={item.category}
                  href={
                    item.category === "tenderDocuments"
                      ? "/customer/documents"
                      : "/customer/profile"
                  }
                >
                  <strong>+{item.pointsAvailable} points</strong>
                  <span>{item.label}</span>→
                </Link>
              ))
            ) : (
              <p className="cc-quiet">
                All currently measured readiness evidence is complete. Keep
                documents and profile information current.
              </p>
            )}
          </section>
        </>
      ) : (
        <Empty
          title="Create your business readiness baseline"
          description="Add your business profile to calculate evidence-based procurement readiness."
          href="/customer/profile"
          action="Complete business profile"
        />
      )}
    </>
  );
}
const CURRENT_BILLING_PLAN_CODES = new Set([
  "pro_launch_monthly", "pro_launch_annual",
  "premium_launch_monthly", "premium_launch_annual",
  "platinum_launch_monthly", "platinum_launch_annual",
]);

function BillingPage() {
  const { organization, toast } = useAccount();
  const plans = useData<{
    data: Array<{
      code: string;
      tier: string;
      name: string;
      description: string;
      billing_interval: string;
      payment_kind: string;
      currency: string;
      amount_minor: number | null;
      enabled: boolean;
      activation_status: string;
    }>;
    productionActivation: string;
  }>("/api/billing/plans");
  const billing = useData<{
    data: {
      entitlement: {
        tier: string;
        status: string;
        adminOverride: boolean;
        plan: { name: string };
        subscription: {
          billing_interval: string | null;
          amount_minor: number | null;
          currency: string | null;
          next_payment_at: string | null;
          current_period_ends_at: string | null;
          cancel_at_period_end: boolean;
          payment_method_summary: Record<string, string>;
        } | null;
      };
      transactions: Array<{
        id: string;
        billing_plan_code: string;
        amount_minor: number;
        currency: string;
        payment_kind: string;
        status: string;
        created_at: string;
      }>;
    };
  }>(organization ? `/api/billing?organizationId=${organization.id}` : null);
  const money = (minor: number | null, currency = "GHS") =>
    minor == null
      ? "Not configured"
      : new Intl.NumberFormat("en-GH", { style: "currency", currency }).format(
          minor / 100,
        );
  const entitlement = billing.data?.data.entitlement;
  const currentPackages = plans.data?.data.filter((plan) => CURRENT_BILLING_PLAN_CODES.has(plan.code)) || [];
  const displayedPackages = currentPackages.length
    ? currentPackages
    : plans.data?.data.filter((plan) => plan.tier === "PREMIUM") || [];
  async function checkout(code: string) {
    if (!organization) return;
    try {
      const result = await api<{ data: { authorization_url: string } }>(
        "/api/billing/checkout",
        {
          organizationId: organization.id,
          billingPlanCode: code,
          triggerFeature: "Billing",
        },
      );
      window.location.assign(result.data.authorization_url);
    } catch (error) {
      toast((error as Error).message);
    }
  }
  return (
    <>
      <Heading
        title="Billing"
        description="Manage your organisation’s Free or Premium access, renewals and verified payment history."
      />
      {!organization ? (
        <Empty
          title="Create your business first"
          description="Subscriptions belong to the business workspace, so authorised team members share one entitlement."
          href="/customer/profile"
          action="Create business profile"
        />
      ) : (
        <>
          {billing.loading ? (
            <Skeleton />
          ) : billing.error ? (
            <p className="cc-error">{billing.error}</p>
          ) : (
            <section className="cc-editor cc-billing-summary">
              <p className="cc-eyebrow">CURRENT PLAN</p>
              <h2>
                {entitlement?.plan?.name || "BidScope Free"}
              </h2>
              <p>
                Status: <strong>{entitlement?.status || "FREE"}</strong>
              </p>
              {entitlement?.adminOverride && <p className="cc-quiet">Builder administrator access · all features enabled · no subscription required</p>}
              {entitlement?.subscription && (
                <div className="cc-billing-facts">
                  <span>
                    <small>Billing interval</small>
                    {entitlement.subscription.billing_interval || "—"}
                  </span>
                  <span>
                    <small>Amount</small>
                    {money(
                      entitlement.subscription.amount_minor,
                      entitlement.subscription.currency || "GHS",
                    )}
                  </span>
                  <span>
                    <small>Next renewal / expiry</small>
                    {date(
                      entitlement.subscription.next_payment_at ||
                        entitlement.subscription.current_period_ends_at,
                    )}
                  </span>
                  <span>
                    <small>Payment method</small>
                    {entitlement.subscription.payment_method_summary?.channel ||
                      "Not recorded"}
                  </span>
                </div>
              )}
              {entitlement?.tier === "PREMIUM" &&
                entitlement.subscription?.billing_interval &&
                ["MONTHLY", "ANNUAL"].includes(
                  entitlement.subscription.billing_interval,
                ) &&
                !entitlement.subscription.cancel_at_period_end && (
                  <button
                    className="cc-button"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Cancel automatic renewal? Premium access will remain available until the current paid period ends.",
                        )
                      )
                        return;
                      try {
                        await api("/api/billing/cancel", {
                          organizationId: organization.id,
                        });
                        toast(
                          "Cancellation scheduled. Your paid access remains available until the period ends.",
                        );
                        invalidate();
                      } catch (error) {
                        toast((error as Error).message);
                      }
                    }}
                  >
                    Cancel automatic renewal
                  </button>
                )}
            </section>
          )}
          <section className="cc-editor">
            <h2>Packages and billing options</h2>
            <p className="cc-quiet">
              Choose the level of monitoring, intelligence and bid preparation
              your business needs. Card plans renew automatically until cancelled.
            </p>
            <div className="cc-plan-options">
              {displayedPackages.map((plan) => (
                  <article key={plan.code}>
                    <strong>{plan.name}</strong>
                    <span>{money(plan.amount_minor, plan.currency)}</span>
                    <p className="cc-quiet">{plan.description}</p>
                    <small>
                      {plan.payment_kind === "RECURRING_CARD"
                          ? `${plan.billing_interval} · CARD · AUTOMATIC RENEWAL`
                          : "MOBILE MONEY · MANUAL RENEWAL"}
                    </small>
                    <button
                      className="cc-button primary"
                      disabled={
                        !plan.enabled ||
                        plan.activation_status ===
                          "PRICING_CONFIGURATION_REQUIRED"
                      }
                      onClick={() => void checkout(plan.code)}
                    >
                      {plan.enabled
                        ? "Continue to secure Paystack checkout"
                        : "Price not configured"}
                    </button>
                  </article>
                ))}
            </div>
            {plans.data?.productionActivation !== "LIVE" && (
              <p className="cc-configuration-note">
                PRICING_CONFIGURATION_REQUIRED — no payment can be taken until
                an administrator configures and tests real pricing.
              </p>
            )}
          </section>
          <section className="cc-editor">
            <h2>Payment history</h2>
            {billing.data?.data.transactions.length ? (
              billing.data.data.transactions.map((tx) => (
                <div className="cc-document-row" key={tx.id}>
                  <span>
                    <strong>{tx.billing_plan_code.replaceAll("_", " ")}</strong>
                    <small className="block">
                      {new Date(tx.created_at).toLocaleDateString()} ·{" "}
                      {tx.payment_kind.replaceAll("_", " ")}
                    </small>
                  </span>
                  <span>
                    {money(tx.amount_minor, tx.currency)} · {tx.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="cc-quiet">
                No payments have been recorded for this business.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
function SettingsPage() {
  const { preferences, setPreferences } = useAccount();
  return (
    <>
      <Heading
        title="Workspace settings"
        description="A few preferences to make your daily briefing work for you."
      />
      <section className="cc-editor">
        <h2>Home & display</h2>
        {(
          [
            ["compact", "Compact opportunity rows"],
            ["collapsed", "Collapsed desktop navigation"],
            ["hideMarket", "Hide market snapshot"],
            ["hideInternational", "Hide international recommendations"],
            ["deadlinesFirst", "Prioritise deadlines"],
          ] as const
        ).map(([key, label]) => (
          <label className="cc-checkbox-row" key={key}>
            <input
              type="checkbox"
              checked={!!preferences[key]}
              onChange={(e) => setPreferences({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <div className="cc-inline-actions">
          <Link className="cc-button" href="/customer/alerts">
            Alert delivery preferences
          </Link>
          <Link className="cc-button" href="/customer/billing">
            Billing & subscription
          </Link>
          <Link className="cc-button" href="/pricing">
            Compare plans
          </Link>
        </div>
      </section>
    </>
  );
}
function Notifications() {
  const [type, setType] = useState("");
  const data = useData<{ data: Notice[] }>(
    `/api/notifications${type ? `?type=${type}` : ""}`,
  );
  const { toast } = useAccount();
  return (
    <>
      <Heading
        title="Notifications"
        description="Procurement changes that deserve your attention."
      />
      <div className="cc-results-toolbar">
        <select
          aria-label="Notification category"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All events</option>
          {[
            "opportunity_match",
            "deadline",
            "tender_amendment",
            "buyer_activity",
            "award",
          ].map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button
          className="cc-button"
          onClick={async () => {
            try {
              await api("/api/notifications", { markAllRead: true }, "PATCH");
              invalidate();
            } catch (e) {
              toast((e as Error).message);
            }
          }}
        >
          Mark all read
        </button>
      </div>
      {data.loading ? (
        <Skeleton />
      ) : data.error ? (
        <p className="cc-error">{data.error}</p>
      ) : data.data?.data.length ? (
        data.data.data.map((n) => (
          <article
            className={`cc-notice ${n.read_at ? "read" : ""}`}
            key={n.id}
          >
            <div>
              <small>
                {n.type.replaceAll("_", " ")} · {date(n.created_at)}
              </small>
              <h2>
                <Link href={n.related_url || "/customer/notifications"}>
                  {n.title}
                </Link>
              </h2>
              <p>{n.message}</p>
            </div>
            {!n.read_at && (
              <button
                className="cc-button"
                onClick={async () => {
                  try {
                    await api(
                      `/api/notifications/${n.id}`,
                      { read: true },
                      "PATCH",
                    );
                    invalidate();
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                Mark read
              </button>
            )}
          </article>
        ))
      ) : (
        <Empty
          title="You’re up to date"
          description="Relevant procurement changes will appear here as you save opportunities and follow buyers."
        />
      )}
    </>
  );
}
function Following() {
  const { toast } = useAccount();
  const response = useData<{
    data: {
      id: string;
      entity_type: string;
      entity_name: string;
      entity_id: string;
      relevant_only: boolean;
    }[];
  }>("/api/watched-entities");
  return (
    <>
      <Heading
        title="Following"
        description="The buyers and procurements you want to keep in view."
      />
      {response.loading ? (
        <Skeleton />
      ) : response.error ? (
        <p className="cc-error">{response.error}</p>
      ) : response.data?.data.length ? (
        response.data.data.map((w) => (
          <article className="cc-notice" key={w.id}>
            <div>
              <small>{w.entity_type}</small>
              <h2>{w.entity_name}</h2>
              <Link
                href={`/customer/discover?${w.entity_type === "buyer" ? "buyer" : "q"}=${encodeURIComponent(w.entity_name || "")}`}
              >
                Explore related opportunities →
              </Link>
              {w.entity_type === "buyer" && (
                <label className="cc-checkbox-row">
                  <input
                    type="checkbox"
                    checked={w.relevant_only}
                    onChange={async (e) => {
                      try {
                        await api(
                          "/api/watched-entities",
                          { id: w.id, relevantOnly: e.target.checked },
                          "PATCH",
                        );
                        invalidate();
                        toast(
                          e.target.checked
                            ? "Only relevant buyer activity will alert you."
                            : "All published buyer activity will alert you.",
                        );
                      } catch (error) {
                        toast((error as Error).message);
                      }
                    }}
                  />
                  Only opportunities matching my business
                </label>
              )}
            </div>
            <button
              className="cc-button"
              onClick={async () => {
                try {
                  await api(
                    `/api/watched-entities?id=${w.id}`,
                    undefined,
                    "DELETE",
                  );
                  invalidate();
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              Unfollow
            </button>
          </article>
        ))
      ) : (
        <Empty
          title="No followed buyers or procurements"
          description="Follow a buyer or upcoming procurement to build your watchlist."
          href="/customer/buyers"
          action="Explore buyers"
        />
      )}
    </>
  );
}
function Buyers() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { toast, organization } = useAccount();
  const r = useData<{
    data: { id: string; name: string; region: string; description: string }[];
    pagination: { total: number };
  }>(`/api/buyers?q=${encodeURIComponent(q)}&page=${page}`);
  return (
    <>
      <Heading
        title="Buyer intelligence"
        description="Explore procuring organisations and follow the buyers relevant to your business."
      />
      <form
        className="cc-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(String(new FormData(e.currentTarget).get("q") || ""));
          setPage(1);
        }}
      >
        <label>
          Search buyers
          <input name="q" placeholder="Organisation name" />
        </label>
        <button className="cc-button">Search</button>
      </form>
      {r.loading ? (
        <Skeleton />
      ) : r.error ? (
        <p className="cc-error">{r.error}</p>
      ) : (
        r.data?.data.map((b) => (
          <article className="cc-notice" key={b.id}>
            <div>
              <h2>
                <Link
                  href={`/customer/discover?buyer=${encodeURIComponent(b.name)}`}
                >
                  {b.name}
                </Link>
              </h2>
              <p>{b.region || "Ghana"}</p>
              <p>{b.description}</p>
            </div>
            <button
              className="cc-button"
              onClick={async () => {
                try {
                  await api("/api/watched-entities", {
                    organizationId: organization?.id,
                    entityType: "buyer",
                    entityId: b.id,
                    entityName: b.name,
                    relevantOnly: true,
                  });
                  toast(
                    "Buyer followed. Only matching activity will alert you by default.",
                  );
                  invalidate();
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              Follow buyer
            </button>
          </article>
        ))
      )}
      {r.data?.data.length === 0 && (
        <Empty
          title="No buyers found"
          description="Try a broader organisation name."
        />
      )}
      <div className="cc-pagination">
        <button
          className="cc-button"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="cc-button"
          disabled={!r.data || page * 20 >= r.data.pagination.total}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
function Intelligence() {
  const r = useData<{ data: Pulse }>("/api/customer?resource=pulse");
  return (
    <>
      <Heading
        title="Market intelligence"
        description="A transparent view of procurement activity in BidScope’s current index."
      />
      {r.loading ? (
        <Skeleton />
      ) : r.error ? (
        <p className="cc-error">{r.error}</p>
      ) : (
        <section className="cc-editor">
          <PanelTitle title="Current open opportunities by sector" />
          <p>
            {r.data?.data.open.toLocaleString()} open opportunities across the
            current index. These are indexed records, not a measure of the
            entire procurement market.
          </p>
          {r.data?.data.sectors.map((s) => (
            <Link
              className="cc-market-row"
              href={`/customer/discover?sector=${encodeURIComponent(s.sector)}`}
              key={s.sector}
            >
              <span>{s.sector}</span>
              <progress value={s.total} max={r.data!.data.open} />
              <strong>{s.total}</strong>
            </Link>
          ))}
          <Link className="cc-button" href="/customer/awards">
            Explore awards & history
          </Link>
        </section>
      )}
    </>
  );
}
function Awards() {
  const [page, setPage] = useState(1);
  const r = useData<{
    data: {
      id: string;
      title: string;
      award_date: string;
      award_value: number;
      currency: string;
      source_url: string;
      buyer: { name: string };
      suppliers: { supplier_name: string }[];
    }[];
    pagination: { total: number };
  }>(`/api/awards?page=${page}`);
  return (
    <>
      <Heading
        title="Awards & history"
        description="Published Ghana World Bank-financed awards. Research previous procurement outcomes."
      />
      {r.loading ? (
        <Skeleton />
      ) : r.error ? (
        <p className="cc-error">{r.error}</p>
      ) : (
        r.data?.data.map((a) => (
          <article className="cc-notice" key={a.id}>
            <div>
              <small>OFFICIAL AWARD · {date(a.award_date)}</small>
              <h2>{a.title}</h2>
              <p>{a.buyer?.name}</p>
              <p>
                Supplier:{" "}
                {a.suppliers?.map((s) => s.supplier_name).join(", ") ||
                  "Not published"}
              </p>
            </div>
            <div>
              <strong>
                {a.award_value != null
                  ? `${a.currency} ${a.award_value.toLocaleString()}`
                  : "Value not published"}
              </strong>
              <p>
                <a
                  href={officialUrl(a.source_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official source ↗
                </a>
              </p>
            </div>
          </article>
        ))
      )}
      <div className="cc-pagination">
        <button
          className="cc-button"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="cc-button"
          disabled={!r.data || page * 20 >= r.data.pagination.total}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
function Documents() {
  const { organization, toast } = useAccount();
  const r = useData<{
    data: {
      id: string;
      title: string;
      document_type: string;
      expires_at: string;
      source_url: string;
    }[];
  }>(
    organization
      ? `/api/supplier-documents?organizationId=${organization.id}`
      : null,
  );
  return (
    <>
      <Heading
        title="Business documents"
        description="Keep your supplier evidence and expiry dates together. Bid-specific links belong inside each bid workspace."
      />
      {!organization ? (
        <Empty
          title="Add your business first"
          description="Documents belong to your business profile."
          href="/customer/profile"
          action="Create profile"
        />
      ) : (
        <>
          <form
            className="cc-inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api("/api/supplier-documents", {
                  organizationId: organization.id,
                  title: f.get("title"),
                  documentType: "other",
                  sourceUrl: f.get("url") || null,
                  expiresAt: f.get("expiry") ? String(f.get("expiry")) : null,
                });
                toast("Document recorded.");
                invalidate();
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            <label>
              Document title
              <input name="title" required />
            </label>
            <label>
              Secure document URL
              <input name="url" type="url" pattern="https://.*" />
            </label>
            <label>
              Expiry date
              <input name="expiry" type="date" />
            </label>
            <button className="cc-button primary">Add document</button>
          </form>
          {r.loading ? (
            <Skeleton />
          ) : r.error ? (
            <p className="cc-error">{r.error}</p>
          ) : r.data?.data.length ? (
            r.data.data.map((d) => (
              <div className="cc-document-row" key={d.id}>
                <a
                  href={officialUrl(d.source_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {d.title}
                </a>
                <span>Expires {date(d.expires_at)}</span>
              </div>
            ))
          ) : (
            <p className="cc-quiet">
              No business documents recorded yet. Add a secure link to your
              first certificate or registration document.
            </p>
          )}
        </>
      )}
    </>
  );
}
function TeamPage(){
  const params=useSearchParams();const invite=params.get("invite");const{organization,toast}=useAccount();
  const r=useData<{data:{organizationId:string|null;members:Array<{user_id:string;role:string;created_at:string;profile:{email:string;full_name:string}|null}>;invitations:Array<{id:string;email:string;role:string;expires_at:string}>;used:number;limit:number;canManage:boolean}}>("/api/team");
  return <><Heading title="Team workspace" description="Give colleagues controlled access to your procurement workspace."/>
  {invite&&<section className="cc-brief"><div><p className="cc-eyebrow">WORKSPACE INVITATION</p><h2>Accept your BidScope invitation</h2><p>The invitation is tied to the email address that received it.</p><div><button className="cc-button primary" onClick={()=>void api("/api/team",{action:"accept",token:invite}).then(()=>{toast("Invitation accepted.");invalidate();window.history.replaceState({},"","/customer/team");}).catch(error=>toast((error as Error).message))}>Accept invitation</button></div></div></section>}
  {r.loading?<Skeleton/>:r.error?<p className="cc-error">{r.error}</p>:r.data&&<><section className="cc-editor"><div className="cc-team-heading"><div><h2>Workspace members</h2><p className="cc-quiet">{r.data.data.used} of {r.data.data.limit} seats allocated, including pending invitations.</p></div><Link className="cc-button" href="/customer/billing">Compare team plans</Link></div>{r.data.data.members.map(member=><div className="cc-document-row" key={member.user_id}><div><strong>{member.profile?.full_name||member.profile?.email||"Workspace member"}</strong><p className="cc-quiet">{member.profile?.email}</p></div><span>{member.role}</span></div>)}</section>
  {r.data.data.canManage&&<section className="cc-editor"><h2>Invite a teammate</h2><p className="cc-quiet">An email invitation expires after seven days. Premium supports up to three seats; Platinum supports up to five.</p><form className="cc-form-grid" onSubmit={async e=>{e.preventDefault();if(!organization)return;const form=new FormData(e.currentTarget);try{await api("/api/team",{action:"invite",organizationId:organization.id,email:form.get("email"),role:form.get("role")});(e.target as HTMLFormElement).reset();toast("Invitation sent.");invalidate();}catch(error){toast((error as Error).message);}}}><label>Email address<input name="email" type="email" required autoComplete="email" placeholder="colleague@company.com"/></label><label>Role<select name="role" defaultValue="member"><option value="member">Member</option><option value="admin">Administrator</option></select></label><button className="cc-button primary">Send secure invitation</button></form>{r.data.data.invitations.length>0&&<><h2 className="cc-subheading">Pending invitations</h2>{r.data.data.invitations.map(invitation=><div className="cc-document-row" key={invitation.id}><div><strong>{invitation.email}</strong><p className="cc-quiet">{invitation.role} · expires {date(invitation.expires_at)}</p></div><button className="cc-button" onClick={()=>void api(`/api/team?id=${invitation.id}`,undefined,"DELETE").then(()=>{toast("Invitation revoked.");invalidate();}).catch(error=>toast((error as Error).message))}>Revoke</button></div>)}</>}</section>}</>}
  </>;
}
function AIPage() {
  const params = useSearchParams();
  const slug = params.get("opportunity");
  const r = useData<{ data: Opportunity }>(
    slug ? `/api/opportunities/${encodeURIComponent(slug)}` : null,
  );
  const recommendations = useData<{ data: Opportunity[] }>(
    slug ? null : "/api/customer?resource=discover&collection=recommended&sort=match&pageSize=6",
  );
  return (
    <>
      <Heading
        title="BidScope AI"
        description="Turn official opportunity records into clear, source-cited bidding intelligence."
      />
      {slug ? (
        r.loading ? (
          <Skeleton />
        ) : r.error ? (
          <p className="cc-error">{r.error}</p>
        ) : (
          r.data && <AIAnalysis opportunity={r.data.data} />
        )
      ) : (
        <>
          <section className="cc-brief">
            <div>
              <p className="cc-eyebrow">SOURCE-GROUNDED PROCUREMENT ASSISTANT</p>
              <h2>Choose an opportunity to begin.</h2>
              <p>BidScope AI can summarise the notice, find mandatory documents and dates, assess eligibility, flag disqualification risks and compare requirements with your Supplier Passport. Every answer stays tied to the official record.</p>
              <div><Link href="/customer/discover">Search all opportunities</Link><Link href="/customer/documents">Review Supplier Passport</Link></div>
            </div>
          </section>
          <section className="cc-editor">
            <PanelTitle title="Recommended for AI analysis" />
            {recommendations.loading?<Skeleton/>:recommendations.error?<p className="cc-error">{recommendations.error}</p>:recommendations.data?.data.length?recommendations.data.data.map(o=><article className="cc-opportunity" key={o.id}><div className="cc-op-main"><div className="cc-op-meta"><span className="cc-badge positive">OPEN</span><span>{o.source_name}</span></div><h3><Link href={`/customer/ai?opportunity=${encodeURIComponent(o.slug)}`}>{o.title}</Link></h3><p className="cc-buyer-line">{o.buyer_name}</p><div className="cc-row-actions"><Link href={`/customer/ai?opportunity=${encodeURIComponent(o.slug)}`}>Analyse with BidScope AI →</Link><Link href={`/customer/opportunity/${o.slug}`}>View opportunity</Link></div></div><div className="cc-op-right">{o.match?.percentage!=null&&<span className="cc-match"><strong>{o.match.percentage}%</strong><span>business match</span></span>}<span className="cc-deadline"><strong>{date(o.deadline_at)}</strong><span>submission deadline</span></span></div></article>):<Empty title="No recommended opportunities yet" description="Complete your business profile or search the live opportunity index, then choose Analyse with BidScope AI."/>}
          </section>
        </>
      )}
    </>
  );
}
type Preference = {
  alert_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  frequency: string;
  urgent_override: boolean;
  reminder_days: number[];
};
function Alerts() {
  const r = useData<{ data: Preference[]; emailConfigured: boolean }>(
    "/api/notification-preferences",
  );
  const searches = useData<{
    data: {
      id: string;
      name: string;
      alerts_enabled: boolean;
      frequency: "instant" | "daily" | "weekly";
      delivery_recipients: string[];
      filters: Record<string, string>;
    }[];
  }>("/api/customer?resource=searches");
  const { toast } = useAccount();
  return (
    <>
      <Heading
        title="Alert Centre"
        description="Choose the procurement events you receive and how often you hear from us."
      />
      <section className="cc-editor">
        <h2>Delivery preferences</h2>
        <p className="cc-quiet">
          In-app alerts are available now. Email and WhatsApp controls remain
          disabled until their delivery providers are connected.
        </p>
        {r.loading ? (
          <Skeleton />
        ) : r.error ? (
          <p className="cc-error">{r.error}</p>
        ) : (
          r.data?.data.map((p) => (
            <form
              className="cc-preference-row"
              key={p.alert_type}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  await api(
                    "/api/notification-preferences",
                    {
                      alertType: p.alert_type,
                      inAppEnabled: f.get("inapp") === "on",
                      emailEnabled: f.get("email") === "on",
                      frequency: f.get("frequency"),
                      urgentOverride: p.urgent_override,
                      reminderDays: p.reminder_days,
                    },
                    "PATCH",
                  );
                  toast("Alert preference saved.");
                  invalidate();
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              <strong>{p.alert_type.replaceAll("_", " ")}</strong>
              <label>
                <input
                  type="checkbox"
                  name="inapp"
                  defaultChecked={p.in_app_enabled}
                />
                In-app
              </label>
              <label>
                <input
                  type="checkbox"
                  name="email"
                  defaultChecked={p.email_enabled}
                  disabled={!r.data?.emailConfigured}
                />
                Email {r.data?.emailConfigured ? "" : "(not connected)"}
              </label>
              <select
                aria-label={`${p.alert_type} frequency`}
                name="frequency"
                defaultValue={p.frequency}
              >
                <option value="instant">Immediate</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
              </select>
              <button className="cc-button">Save</button>
            </form>
          ))
        )}
      </section>
      <section className="cc-editor">
        <h2>Tender Watches</h2>
        {searches.error ? (
          <p className="cc-error">{searches.error}</p>
        ) : searches.data?.data.length ? (
          searches.data.data.map((s) => (
            <div className="cc-document-row" key={s.id}>
              <Link
                href={`/customer/discover?${new URLSearchParams(s.filters)}`}
              >
                {s.name} →
              </Link>
              <select
                aria-label={`${s.name} frequency`}
                value={s.frequency}
                onChange={async (e) => {
                  try {
                    await api(
                      "/api/customer",
                      {
                        id: s.id,
                        alertsEnabled: s.alerts_enabled,
                        frequency: e.target.value,
                      },
                      "PATCH",
                    );
                    invalidate();
                    toast("Tender Watch frequency saved.");
                  } catch (error) {
                    toast((error as Error).message);
                  }
                }}
              >
                <option value="instant">Immediate</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <label className="cc-checkbox-row">
                <input
                  type="checkbox"
                  checked={s.alerts_enabled}
                  onChange={async (e) => {
                    try {
                      await api(
                        "/api/customer",
                        {
                          id: s.id,
                          alertsEnabled: e.target.checked,
                          frequency: s.frequency,
                        },
                        "PATCH",
                      );
                      invalidate();
                      toast("Tender Watch alert preference saved.");
                    } catch (error) {
                      toast((error as Error).message);
                    }
                  }}
                />
                Alert me to new results
              </label>
              <form className="cc-alert-recipients" onSubmit={async e=>{e.preventDefault();const input=new FormData(e.currentTarget).get("recipients")?.toString()||"";try{await api("/api/customer",{id:s.id,alertsEnabled:s.alerts_enabled,frequency:s.frequency,deliveryRecipients:input.split(",").map(value=>value.trim()).filter(Boolean)},"PATCH");invalidate();toast("Alert recipients saved.");}catch(error){toast((error as Error).message);}}}>
                <label>Additional email recipients<input name="recipients" type="text" inputMode="email" defaultValue={(s.delivery_recipients||[]).join(", ")} placeholder="procurement@company.com" aria-describedby={`recipients-${s.id}`}/></label>
                <small id={`recipients-${s.id}`}>Separate addresses with commas. Your plan controls the maximum.</small>
                <button className="cc-button">Save recipients</button>
              </form>
              <button
                className="cc-button"
                onClick={async () => {
                  if (!window.confirm(`Delete Tender Watch “${s.name}”?`)) return;
                  try {
                    await api(`/api/customer?id=${s.id}`, undefined, "DELETE");
                    invalidate();
                    toast("Tender Watch deleted.");
                  } catch (error) {
                    toast((error as Error).message);
                  }
                }}
              >
                Delete
              </button>
            </div>
          ))
        ) : (
          <p className="cc-quiet">
            Save a search in Discover to create a Tender Watch.
          </p>
        )}
        <p className="cc-quiet">
          Each watch uses its own frequency. New published results are
          deduplicated before delivery.
        </p>
      </section>
    </>
  );
}
function Help() {
  type HelpReply = {
    answer: string;
    category: string;
    routedToTenderEvaluation: boolean;
    links: Array<{ label: string; href: string; primary?: boolean }>;
  };
  type Message = { role: "user" | "assistant"; content: string; reply?: HelpReply };
  const suggestions = [
    "How do I find opportunities for my business?",
    "How do I create tender alerts?",
    "Where can I compare plans?",
    "How do I use AI Tender Evaluation?",
  ];
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello — I’m the BidScope Help Assistant. I can guide you around opportunities, alerts, profiles, plans, bid tracking and professional services.",
    },
  ]);

  const ask = async (value: string) => {
    const clean = value.trim();
    if (!clean || busy) return;
    setQuestion("");
    setError("");
    setBusy(true);
    setMessages((current) => [...current, { role: "user", content: clean }]);
    try {
      const response = await api<{ data: HelpReply }>("/api/ai/help", {
        question: clean,
        currentPath: window.location.pathname + window.location.search,
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.data.answer, reply: response.data },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Help Assistant could not respond.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Heading
        title="BidScope Help Assistant"
        description="Get help using your workspace, finding features and choosing the correct procurement tool."
      />
      <div className="cc-help-layout">
        <section className="cc-help-chat" aria-label="BidScope Help Assistant conversation">
          <div className="cc-help-chat-head">
            <div><span className="cc-help-status" /> <strong>Product help</strong></div>
            <span>Not tender analysis</span>
          </div>
          <div className="cc-help-messages" aria-live="polite">
            {messages.map((message, index) => (
              <article className={`cc-help-message ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === "assistant" ? "BidScope" : "You"}</span>
                <p>{message.content}</p>
                {!!message.reply?.links.length && (
                  <div className="cc-help-links">
                    {message.reply.links.map((link) => (
                      <Link className={`cc-button ${link.primary ? "primary" : ""}`} href={link.href} key={link.href}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
                {message.reply?.routedToTenderEvaluation && (
                  <small>AI Tender Evaluation is a paid feature. Your active plan and usage allowance apply.</small>
                )}
              </article>
            ))}
            {busy && <div className="cc-help-thinking"><span />Checking the best place to help you…</div>}
          </div>
          {messages.length === 1 && (
            <div className="cc-help-suggestions">
              {suggestions.map((suggestion) => (
                <button className="cc-button" disabled={busy} key={suggestion} onClick={() => void ask(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <form className="cc-help-composer" onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
            <label htmlFor="help-question">How can we help?</label>
            <div>
              <textarea
                id="help-question"
                maxLength={1000}
                rows={2}
                required
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask how to use BidScope, manage alerts, plans, your profile or bid workflow…"
              />
              <button className="cc-button primary" disabled={busy || question.trim().length < 2}>Send</button>
            </div>
          </form>
          {error && <p role="alert" className="cc-error">{error}</p>}
        </section>
        <aside className="cc-help-aside">
          <section>
            <p className="cc-eyebrow">USE THE RIGHT TOOL</p>
            <h2>Need tender details?</h2>
            <p>Requirements, eligibility, documents, risks and bid/no-bid advice belong in the paid, source-grounded Tender Evaluation workspace.</p>
            <Link className="cc-button primary" href="/customer/ai">Open AI Tender Evaluation</Link>
          </section>
          <section>
            <h2>Popular destinations</h2>
            <Link href="/customer/discover">Search opportunities</Link>
            <Link href="/customer/alerts">Manage alerts</Link>
            <Link href="/customer/profile">Business profile</Link>
            <Link href="/customer/billing">Plans and billing</Link>
            <Link href="/services">Professional services</Link>
          </section>
          <section className="cc-help-legal">
            <Link href="/terms">Terms of service</Link>
            <Link href="/privacy">Privacy policy</Link>
          </section>
        </aside>
      </div>
    </>
  );
}
