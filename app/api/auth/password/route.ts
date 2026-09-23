import { NextResponse } from "next/server";
import { supabaseConfiguration } from "@/lib/server/supabase-rest";
import { COOKIE_POLICY_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { recordLegalConsent } from "@/lib/server/legal-consent";
import { verifyTurnstile } from "@/lib/server/turnstile";

export const dynamic = "force-dynamic";

type AuthAction = "sign-in" | "sign-up";

function messageFor(status: number, fallback?: string) {
  if (status === 400) return "Please check your details and try again.";
  if (status === 422) return "Please use a valid email address and a stronger password.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  return fallback || "We could not complete that request. Please try again.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: AuthAction; email?: string; password?: string; fullName?: string; usageMode?: "supplier" | "buyer"; legalAccepted?: boolean; turnstileToken?: string };
    const action = body.action;
    const email = body.email?.trim().toLowerCase();
    const password = body.password || "";
    const fullName = body.fullName?.trim();
    const usageMode = body.usageMode === "buyer" || body.usageMode === "supplier" ? body.usageMode : null;

    if (action !== "sign-in" && action !== "sign-up") {
      return NextResponse.json({ error: "Choose sign in or create account." }, { status: 400 });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must contain at least 8 characters." }, { status: 400 });
    }
    if (action === "sign-up" && (!fullName || fullName.length < 2)) {
      return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
    }
    if (action === "sign-up" && body.legalAccepted !== true) {
      return NextResponse.json({ error: "You must accept the Terms of Service and acknowledge the Privacy and Cookie Policies to create an account." }, { status: 400 });
    }
    if (action === "sign-up" && !usageMode) {
      return NextResponse.json({ error: "Choose a Seller / Supplier account or a Buyer account." }, { status: 400 });
    }
    const verification = await verifyTurnstile(body.turnstileToken, request);
    if (!verification.ok) return NextResponse.json({ error: verification.message }, { status: verification.status });

    const { url, publicKey } = supabaseConfiguration();
    if (!publicKey) {
      return NextResponse.json({ error: "Account service is not configured." }, { status: 503 });
    }
    const requestUrl = new URL(request.url);
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, "");
    const endpoint = action === "sign-in"
      ? `${url}/auth/v1/token?grant_type=password`
      : `${url}/auth/v1/signup?redirect_to=${encodeURIComponent(`${siteUrl}/auth/callback?next=${encodeURIComponent(usageMode === "buyer" ? "/procurement/onboarding" : "/customer/profile?onboarding=seller")}`)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { apikey: publicKey, "Content-Type": "application/json" },
      body: JSON.stringify(action === "sign-in" ? { email, password } : {
        email,
        password,
        data: {
          full_name: fullName,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          cookie_policy_version: COOKIE_POLICY_VERSION,
          legal_accepted_at: new Date().toISOString(),
          bidscope_usage: usageMode,
        },
      }),
      cache: "no-store",
    });
    const result = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const providerMessage = typeof result.msg === "string" ? result.msg : typeof result.message === "string" ? result.message : undefined;
      return NextResponse.json({ error: messageFor(response.status, providerMessage) }, { status: response.status });
    }

    const accessToken = typeof result.access_token === "string" ? result.access_token : null;
    const createdUser = result.user && typeof result.user === "object" ? result.user as { id?: string } : null;
    if (action === "sign-up" && createdUser?.id) await recordLegalConsent(createdUser.id, "password");
    if (!accessToken && action === "sign-up") {
      return NextResponse.json({ confirmationRequired: true, message: "Check your email to confirm your account, then return to sign in." });
    }

    return NextResponse.json({
      accessToken,
      refreshToken: typeof result.refresh_token === "string" ? result.refresh_token : null,
      expiresIn: typeof result.expires_in === "number" ? result.expires_in : 3600,
    });
  } catch {
    return NextResponse.json({ error: "Account service is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
