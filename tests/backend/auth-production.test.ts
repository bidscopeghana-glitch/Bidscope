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

test("anonymous navigation does not rebroadcast an empty session forever", () => {
  const session = read("lib/client/session.ts");
  assert.match(session, /if \(!token && !hasRefreshToken\) return null/);
  assert.match(session, /hasRefreshToken = Boolean\(window\.localStorage\.getItem\(REFRESH_TOKEN_KEY\)\)/);
  assert.match(session, /if \(hadSession\) notify\(SESSION_CHANGE_EVENT\)/);
});

test("sign out performs one client navigation", () => {
  const authNav = read("components/procurement/auth-nav.tsx");
  assert.match(authNav, /clearSession\(\);\s*router\.replace\("\/"\)/);
  assert.doesNotMatch(authNav, /router\.refresh\(\)/);
});

test("production routes publish indexing and baseline security controls", () => {
  const config = read("next.config.ts");
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(read("app/robots.ts"), /sitemap\.xml/);
  assert.match(read("app/sitemap.ts"), /\/opportunities/);
});

test("administrator control is restricted to the builder identity and database flag",()=>{
  const auth=read("lib/server/auth.ts");
  const session=read("app/api/admin/session/route.ts");
  const shell=read("app/admin/command-centre/admin-shell.tsx");
  assert.match(auth,/BIDSCOPE_ADMIN_EMAIL = "basintaleuk@gmail\.com"/);
  assert.match(auth,/authenticated\.user\.email\.trim\(\)\.toLowerCase\(\) !== BIDSCOPE_ADMIN_EMAIL/);
  assert.match(auth,/is_super_admin/);
  assert.match(session,/requireSuperAdmin\(request\)/);
  assert.match(shell,/\/api\/admin\/session/);
});
