import { apiErrorResponse } from "@/lib/server/api-error";
import { supabaseConfiguration } from "@/lib/server/supabase-rest";
import { createLegalConsentToken, LEGAL_SIGNUP_COOKIE } from "@/lib/server/legal-consent";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { url } = supabaseConfiguration();
    const requestUrl = new URL(request.url);
    const intent = requestUrl.searchParams.get("intent");
    const legalAccepted = requestUrl.searchParams.get("legalAccepted") === "true";
    if (intent === "sign-up" && !legalAccepted) {
      return Response.redirect(new URL("/sign-in?legal=required", requestUrl.origin));
    }
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, "");
    const authorize = new URL(`${url}/auth/v1/authorize`);
    authorize.searchParams.set("provider", "google");
    authorize.searchParams.set("redirect_to", `${siteUrl}/auth/callback${intent === "sign-up" ? "?signup=google" : ""}`);
    authorize.searchParams.set("scopes", "openid email profile");
    const response = Response.redirect(authorize);
    if (intent === "sign-up") {
      response.headers.append("Set-Cookie", `${LEGAL_SIGNUP_COOKIE}=${createLegalConsentToken("google")}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800`);
    }
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
