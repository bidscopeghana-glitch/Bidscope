import { AlertOpportunityRecord, AlertRuleRecord, escapeHtml, matchesAlert } from "@/lib/server/alerts";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireInternalSecret } from "@/lib/server/auth";
import { claimMatchingTenderEmail } from "@/lib/server/matching-email-quota";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Delivery = { id: string; recipient: string; opportunity_id: string; alert_rule_id: string };

async function sendEmail(delivery: Delivery, opportunity: AlertOpportunityRecord) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  if (!apiKey || !from) return "queued" as const;
  if (!(await claimMatchingTenderEmail(delivery.recipient, `legacy-alert:${delivery.id}`))) {
    await supabaseRest(`alert_deliveries?id=eq.${delivery.id}`, {
      method: "PATCH", body: JSON.stringify({ status: "suppressed", error_message: "Daily matching-tender email limit reached (3 per recipient)." }),
    });
    return "suppressed" as const;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `legacy-alert:${delivery.id}` },
    body: JSON.stringify({
      from, to: [delivery.recipient], subject: `BidScope opportunity: ${opportunity.title}`,
      html: `<div style="font-family:Arial,sans-serif;color:#1d1d1d"><h2>${escapeHtml(opportunity.title)}</h2><p>${escapeHtml(opportunity.summary)}</p><p><a href="${escapeHtml(opportunity.official_source_url)}">Review at the official source</a></p><p>Always verify details at the official source before bidding.</p></div>`,
    }),
  });
  const result = (await response.json()) as { id?: string; message?: string };
  await supabaseRest(`alert_deliveries?id=eq.${delivery.id}`, {
    method: "PATCH",
    body: JSON.stringify(response.ok
      ? { status: "sent", provider_message_id: result.id || null, sent_at: new Date().toISOString() }
      : { status: "failed", error_message: (result.message || "Email provider rejected the message").slice(0, 1000) }),
  });
  return response.ok ? "sent" as const : "failed" as const;
}

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const since = new Date(Date.now() - 8 * 86_400_000).toISOString();
    const rulesQuery = new URLSearchParams({ select: "*", enabled: "eq.true", limit: "500" });
    const opportunitiesQuery = new URLSearchParams({
      select: "id,title,summary,description,category,sector,region,buyer_normalized_id,estimated_value,deadline_at,slug,official_source_url",
      status: "in.(OPEN,CLOSING_SOON)", deadline_at: `gt.${new Date().toISOString()}`, published_at: "not.is.null", updated_at: `gte.${since}`, limit: "500",
    });
    const [{ data: rules }, { data: opportunities }] = await Promise.all([
      supabaseRest<AlertRuleRecord[]>(`alert_rules?${rulesQuery}`),
      supabaseRest<AlertOpportunityRecord[]>(`procurement_opportunities?${opportunitiesQuery}`),
    ]);
    const opportunityById = new Map(opportunities.map((item) => [item.id, item]));
    const candidates = rules.flatMap((rule) => opportunities.filter((item) => matchesAlert(rule, item)).flatMap((item) => rule.email_recipients.map((recipient) => ({ alert_rule_id: rule.id, opportunity_id: item.id, recipient, channel: "email" }))));
    if (!candidates.length) return Response.json({ matched: 0, queued: 0, sent: 0, failed: 0 });
    const { data: deliveries } = await supabaseRest<Delivery[]>("alert_deliveries?on_conflict=alert_rule_id,opportunity_id,recipient,channel", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(candidates),
    });
    const outcomes = await Promise.all(deliveries.slice(0, 100).map((delivery) => sendEmail(delivery, opportunityById.get(delivery.opportunity_id)!)));
    await Promise.all(rules.map((rule) => supabaseRest(`alert_rules?id=eq.${rule.id}`, { method: "PATCH", body: JSON.stringify({ last_run_at: new Date().toISOString() }) })));
    return Response.json({ matched: candidates.length, queued: outcomes.filter((value) => value === "queued").length, sent: outcomes.filter((value) => value === "sent").length, failed: outcomes.filter((value) => value === "failed").length, suppressed: outcomes.filter((value) => value === "suppressed").length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
