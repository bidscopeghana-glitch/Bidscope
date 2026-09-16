import { createHmac, timingSafeEqual } from "node:crypto";
import { COOKIE_POLICY_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { supabaseConfiguration, supabaseRest } from "@/lib/server/supabase-rest";

export const LEGAL_SIGNUP_COOKIE = "bidscope_signup_legal";

type ConsentMethod = "password" | "google";
type ConsentToken = { acceptedAt: string; method: ConsentMethod; termsVersion: string; privacyVersion: string; cookiePolicyVersion: string };

function secret() {
  const { serviceKey } = supabaseConfiguration();
  const value = process.env.LEGAL_CONSENT_SECRET || process.env.BIDSCOPE_INTERNAL_SECRET || serviceKey;
  if (!value) throw new Error("Legal consent signing is not configured.");
  return value;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createLegalConsentToken(method: ConsentMethod) {
  const payload: ConsentToken = {
    acceptedAt: new Date().toISOString(),
    method,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    cookiePolicyVersion: COOKIE_POLICY_VERSION,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${signature(encoded)}`;
}

export function verifyLegalConsentToken(token: string | undefined | null): ConsentToken | null {
  if (!token) return null;
  const [encoded, supplied] = token.split(".");
  if (!encoded || !supplied) return null;
  const expected = signature(encoded);
  if (expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ConsentToken;
    const accepted = Date.parse(payload.acceptedAt);
    if (!Number.isFinite(accepted) || Date.now() - accepted > 30 * 60 * 1000) return null;
    if (payload.termsVersion !== TERMS_VERSION || payload.privacyVersion !== PRIVACY_VERSION || payload.cookiePolicyVersion !== COOKIE_POLICY_VERSION) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function recordLegalConsent(userId: string, method: ConsentMethod, acceptedAt = new Date().toISOString()) {
  const records = [
    { document_type: "terms", document_version: TERMS_VERSION },
    { document_type: "privacy", document_version: PRIVACY_VERSION },
    { document_type: "cookies", document_version: COOKIE_POLICY_VERSION },
  ].map((record) => ({ ...record, user_id: userId, accepted_at: acceptedAt, acceptance_method: method }));
  await supabaseRest("user_legal_consents?on_conflict=user_id,document_type,document_version", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(records),
  });
}

