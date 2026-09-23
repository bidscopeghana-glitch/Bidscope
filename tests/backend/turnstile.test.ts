import test from "node:test";
import assert from "node:assert/strict";
import { verifyTurnstile } from "../../lib/server/turnstile.ts";

const request = new Request("https://www.bidscopeghana.com/api/auth/password");

test("Turnstile rejects missing, invalid, expired and reused tokens server-side", async () => {
  const previous = { site: process.env.TURNSTILE_SITE_KEY, secret: process.env.TURNSTILE_SECRET_KEY, fetch: globalThis.fetch };
  const responses = [
    { success: true, hostname: "www.bidscopeghana.com" },
    { success: false, "error-codes": ["invalid-input-response"] },
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { success: true, hostname: "other.example" },
  ];
  try {
    process.env.TURNSTILE_SITE_KEY = "test-site";
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    globalThis.fetch = async () => Response.json(responses.shift());
    assert.deepEqual(await verifyTurnstile(undefined, request), { ok: false, status: 400, message: "Complete the security check and try again." });
    assert.deepEqual(await verifyTurnstile("valid", request), { ok: true });
    for (const token of ["invalid", "expired", "reused"]) {
      const result = await verifyTurnstile(token, request);
      assert.equal(result.ok, false);
      assert.equal(!result.ok && result.status, 400);
    }
    assert.equal((await verifyTurnstile("wrong-host", request)).ok, false);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.site === undefined) delete process.env.TURNSTILE_SITE_KEY; else process.env.TURNSTILE_SITE_KEY = previous.site;
    if (previous.secret === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = previous.secret;
  }
});

test("Turnstile fails closed on an incomplete configuration or verification outage", async () => {
  const previous = { site: process.env.TURNSTILE_SITE_KEY, secret: process.env.TURNSTILE_SECRET_KEY, fetch: globalThis.fetch };
  try {
    process.env.TURNSTILE_SITE_KEY = "test-site";
    delete process.env.TURNSTILE_SECRET_KEY;
    assert.equal((await verifyTurnstile("token", request)).ok, false);
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    globalThis.fetch = async () => { throw new Error("offline"); };
    const result = await verifyTurnstile("token", request);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 503);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.site === undefined) delete process.env.TURNSTILE_SITE_KEY; else process.env.TURNSTILE_SITE_KEY = previous.site;
    if (previous.secret === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = previous.secret;
  }
});
