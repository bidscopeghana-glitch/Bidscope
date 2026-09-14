import { NextResponse } from "next/server";
import { supabaseConfiguration } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { refreshToken?: string };
    if (!body.refreshToken || body.refreshToken.length < 10) {
      return NextResponse.json({ error: "A valid session refresh token is required." }, { status: 400 });
    }
    const { url, publicKey } = supabaseConfiguration();
    if (!publicKey) {
      return NextResponse.json({ error: "Account service is not configured." }, { status: 503 });
    }
    const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: publicKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: body.refreshToken }),
      cache: "no-store",
    });
    const result = (await response.json()) as Record<string, unknown>;
    if (!response.ok || typeof result.access_token !== "string") {
      return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    }
    return NextResponse.json({
      accessToken: result.access_token,
      refreshToken: typeof result.refresh_token === "string" ? result.refresh_token : body.refreshToken,
      expiresIn: typeof result.expires_in === "number" ? result.expires_in : 3600,
    });
  } catch {
    return NextResponse.json({ error: "Your session could not be refreshed. Please sign in again." }, { status: 401 });
  }
}
