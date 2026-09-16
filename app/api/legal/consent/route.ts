import { apiErrorResponse, ApiError } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { LEGAL_SIGNUP_COOKIE, recordLegalConsent, verifyLegalConsentToken } from "@/lib/server/legal-consent";

export const dynamic = "force-dynamic";

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const consent = verifyLegalConsentToken(cookieValue(request, LEGAL_SIGNUP_COOKIE));
    if (!consent) throw new ApiError(400, "Your signup consent expired. Please return to Create account and accept the legal terms again.", "legal_consent_required");
    await recordLegalConsent(user.id, consent.method, consent.acceptedAt);
    return new Response(JSON.stringify({ data: { recorded: true } }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `${LEGAL_SIGNUP_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

