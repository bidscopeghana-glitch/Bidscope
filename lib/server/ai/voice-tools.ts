import { GET as listOpportunities } from "../../../app/api/opportunities/route.ts";
import { GET as getSubscription } from "../../../app/api/subscription/route.ts";
import { GET as getVerification } from "../../../app/api/supplier-verification/route.ts";
import { GET as getNotifications } from "../../../app/api/notifications/route.ts";

export type VoiceLink = { label: string; href: string };
export type VoiceToolReply = { answer: string; links: VoiceLink[] };

function authenticatedRequest(request: Request, pathname: string): Request {
  return new Request(new URL(pathname, request.url), { headers: { authorization: request.headers.get("authorization") || "" } });
}

/** These existing endpoints recheck the bearer identity and organisation membership. */
export async function accountStatusForVoice(request: Request, organizationId: string | undefined, kind: "subscription" | "verification" | "notifications"): Promise<VoiceToolReply> {
  if (!organizationId && kind !== "notifications") return { answer: "Create or join a business workspace to see this status.", links: [{ label: "Open profile", href: "/customer/profile" }] };
  const path = kind === "notifications" ? "/api/notifications?limit=3" : `/api/${kind === "subscription" ? "subscription" : "supplier-verification"}?organizationId=${encodeURIComponent(organizationId!)}`;
  const response = await (kind === "subscription" ? getSubscription(authenticatedRequest(request, path)) : kind === "verification" ? getVerification(authenticatedRequest(request, path)) : getNotifications(authenticatedRequest(request, path)));
  if (!response.ok) return { answer: "I could not retrieve that account status now. Please open its workspace page.", links: [{ label: "Open workspace", href: "/customer" }] };
  if (kind === "subscription") {
    const payload = await response.json() as { data: { plan_code: string; status: string; current_period_ends_at?: string | null } };
    return { answer: `Your BidScope plan is ${payload.data.plan_code}. Its current status is ${payload.data.status}.${payload.data.current_period_ends_at ? ` The current period ends ${new Date(payload.data.current_period_ends_at).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}.` : ""}`, links: [{ label: "Open billing", href: "/customer/billing" }] };
  }
  if (kind === "verification") {
    const payload = await response.json() as { data: { level: string; expiresAt?: string | null } };
    return { answer: `Your supplier verification level is ${payload.data.level.replaceAll("_", " ")}.${payload.data.expiresAt ? ` It expires ${new Date(payload.data.expiresAt).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}.` : ""} Open verification for the individual checks and supporting evidence.`, links: [{ label: "Open verification", href: "/customer/verification" }] };
  }
  const payload = await response.json() as { unreadCount: number };
  // A notification created under an earlier paid plan may contain restricted tender data.
  return { answer: `You have ${payload.unreadCount} unread notifications. Open your notification centre to review them with your current access level.`, links: [{ label: "Open notifications", href: "/customer/notifications" }] };
}

/** Reuse the public opportunity API's subscription gate and preview projection. */
export async function searchTendersForVoice(request: Request, term: string, country?: string): Promise<VoiceToolReply> {
  const url = new URL("/api/opportunities", request.url);
  url.searchParams.set("scope", "all");
  if (country) url.searchParams.set("country", country);
  url.searchParams.set("pageSize", "5");
  if (term) url.searchParams.set("q", term);
  const response = await listOpportunities(authenticatedRequest(request, url.pathname + url.search));
  if (!response.ok) return { answer: "I could not search opportunities just now. Please try Discover directly.", links: [{ label: "Open Discover", href: "/customer/discover" }] };
  const payload = await response.json() as { data?: Array<{ slug?: string; title?: string; deadline_at?: string | null }> };
  const results = (payload.data || []).filter(item => item.slug && item.title).slice(0, 5);
  const discoverParams = new URLSearchParams();
  if (term) discoverParams.set("q", term);
  if (country) discoverParams.set("country", country);
  const discover = `/customer/discover${discoverParams.size ? `?${discoverParams}` : ""}`;
  if (!results.length) return { answer: "I did not find matching open opportunities in the current BidScope listing. Try a broader keyword or browse Discover.", links: [{ label: "Browse Discover", href: discover }] };
  const countryName = country === "GH" ? "Ghana" : country;
  const first = results[0];
  const firstDeadline = first.deadline_at ? `, closing ${new Date(first.deadline_at).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` : "";
  const answer = `I found ${results.length} open ${results.length === 1 ? "opportunity" : "opportunities"}${term ? ` matching “${term}”` : ""}${countryName ? ` in ${countryName}` : ""}. The first is “${first.title?.slice(0, 140)}”${firstDeadline}. I’ve listed the results below. Open one to confirm its official details and your access level.`;
  return { answer, links: [
    ...results.map(item => ({ label: item.title!.slice(0, 58), href: `/customer/opportunity/${encodeURIComponent(item.slug!)}` })),
    { label: "View all results", href: discover },
  ] };
}
