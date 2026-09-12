import { apiErrorResponse } from "@/lib/server/api-error";
import { supabaseConfiguration } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { url } = supabaseConfiguration();
    const requestUrl = new URL(request.url);
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, "");
    const authorize = new URL(`${url}/auth/v1/authorize`);
    authorize.searchParams.set("provider", "google");
    authorize.searchParams.set("redirect_to", `${siteUrl}/auth/callback`);
    authorize.searchParams.set("scopes", "openid email profile");
    return Response.redirect(authorize);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
