import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("new password accounts require and persist versioned legal consent", () => {
  const route = read("app/api/auth/password/route.ts");
  assert.match(route, /legalAccepted !== true/);
  assert.match(route, /recordLegalConsent\(createdUser\.id, "password"\)/);
  assert.match(route, /terms_version: TERMS_VERSION/);
});

test("Google account creation carries signed consent into the auth callback", () => {
  const google = read("app/api/auth/google/route.ts");
  const callback = read("app/auth/callback/page.tsx");
  const consent = read("lib/server/legal-consent.ts");
  assert.match(google, /createLegalConsentToken\("google"\)/);
  assert.match(google, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(callback, /\/api\/legal\/consent/);
  assert.match(consent, /timingSafeEqual/);
});

test("legal acceptance has a private immutable audit table", () => {
  const migration = read("supabase/migrations/20260916133000_user_legal_consents.sql");
  assert.match(migration, /unique \(user_id, document_type, document_version\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all .* from anon/);
});

test("cookie choices default optional categories off and remain reopenable", () => {
  const banner = read("components/legal/cookie-consent.tsx");
  const layout = read("app/layout.tsx");
  const footer = read("components/procurement/site-shell.tsx");
  assert.match(banner, /useState\(false\)[\s\S]*analytics/);
  assert.match(banner, /Reject optional/);
  assert.match(banner, /COOKIE_SETTINGS_EVENT/);
  assert.match(layout, /<CookieConsent/);
  assert.match(footer, /CookieSettingsButton/);
});

test("launch legal pages disclose procurement and AI limitations", () => {
  const terms = read("app/terms/page.tsx");
  const privacy = read("app/privacy/page.tsx");
  const cookies = read("app/cookies/page.tsx");
  assert.match(terms, /19.*Contact us|number="19"/);
  assert.match(terms, /issuing authority’s notice and tender documents are always authoritative/);
  assert.match(terms, /AI output can be incomplete/);
  assert.match(privacy, /Data Protection Act, 2012 \(Act 843\)/);
  assert.match(cookies, /Optional categories are off/);
});
