type Verification = { success?: boolean; hostname?: string; "error-codes"?: string[] };

export type TurnstileResult = { ok: true } | { ok: false; status: 400 | 503; message: string };

export async function verifyTurnstile(token: unknown, request: Request): Promise<TurnstileResult> {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  // An incomplete deployment must not quietly bypass a configured challenge.
  if (!siteKey && !secret) return { ok: true };
  if (!siteKey || !secret) return { ok: false, status: 503, message: "Verification is temporarily unavailable. Please try again later." };
  if (typeof token !== "string" || !token || token.length > 2048) {
    return { ok: false, status: 400, message: "Complete the security check and try again." };
  }
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, status: 503, message: "Verification is temporarily unavailable. Please try again later." };
    const result = await response.json() as Verification;
    if (!result.success) return { ok: false, status: 400, message: "Security check expired or was unsuccessful. Please try again." };
    const expectedHost = new URL(request.url).hostname.toLowerCase();
    if (result.hostname?.toLowerCase() !== expectedHost) return { ok: false, status: 400, message: "Security check did not match this site. Please try again." };
    return { ok: true };
  } catch {
    return { ok: false, status: 503, message: "Verification is temporarily unavailable. Please try again later." };
  }
}
