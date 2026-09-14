import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("password and refresh auth use the public Supabase credential", () => {
  const config = read("lib/server/supabase-rest.ts");
  const password = read("app/api/auth/password/route.ts");
  const refresh = read("app/api/auth/refresh/route.ts");
  assert.match(config, /SUPABASE_PUBLISHABLE_KEY/);
  assert.match(password, /apikey: publicKey/);
  assert.match(refresh, /grant_type=refresh_token/);
  assert.match(refresh, /apikey: publicKey/);
});

test("customer requests renew an expired session and retry once", () => {
  const session = read("lib/client/session.ts");
  const data = read("components/customer/data.ts");
  assert.match(session, /refreshInFlight/);
  assert.match(session, /getValidAccessToken/);
  assert.match(data, /response\.status===401/);
  assert.match(data, /getValidAccessToken\(true\)/);
});

test("production routes publish indexing and baseline security controls", () => {
  const config = read("next.config.ts");
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(read("app/robots.ts"), /sitemap\.xml/);
  assert.match(read("app/sitemap.ts"), /\/opportunities/);
});
