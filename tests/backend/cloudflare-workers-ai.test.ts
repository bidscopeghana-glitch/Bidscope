import test from "node:test";
import assert from "node:assert/strict";
import { configuredProviders } from "../../lib/server/ai/providers.ts";
import { workersAITaskAllowed } from "../../lib/server/ai/orchestrator.ts";

const request = { model: "@cf/meta/llama-3.1-8b-instruct-fp8", messages: [{ role: "user" as const, content: "Reply OK" }], maxOutputTokens: 16 };

test("Workers AI is restricted to reviewed public classification metadata", () => {
  const base = { taskType: "public_tender_classification_review", messages: [], plan: "STANDARD" as const };
  assert.equal(workersAITaskAllowed(base), true);
  for (const taskType of ["help_assistant", "tender_summary", "tender_extraction", "deep_tender_analysis", "bid_no_bid", "company_classification", "campaign_generation"]) {
    assert.equal(workersAITaskAllowed({ ...base, taskType }), false, taskType);
  }
  assert.equal(workersAITaskAllowed({ ...base, userId: "user-1" }), false);
  assert.equal(workersAITaskAllowed({ ...base, containsSensitiveData: true }), false);
  assert.equal(workersAITaskAllowed({ ...base, containsCustomerDocuments: true }), false);
  assert.equal(workersAITaskAllowed({ ...base, requiresStructuredOutput: true }), false);
});

test("Workers AI is unavailable without both account ID and scoped token", () => {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_WORKERS_AI_TOKEN;
  try {
    delete process.env.CLOUDFLARE_WORKERS_AI_TOKEN;
    assert.equal(configuredProviders().find(item => item.id === "cloudflare")?.configured, false);
    process.env.CLOUDFLARE_WORKERS_AI_TOKEN = "test-token";
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    assert.equal(configuredProviders().find(item => item.id === "cloudflare")?.configured, false);
  } finally {
    if (account === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = account;
    if (token === undefined) delete process.env.CLOUDFLARE_WORKERS_AI_TOKEN; else process.env.CLOUDFLARE_WORKERS_AI_TOKEN = token;
  }
});

test("Workers AI sends a non-cached, non-logged request through BidScope AI Gateway", async () => {
  const previous = { account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_WORKERS_AI_TOKEN, fetch: globalThis.fetch };
  const calls: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
  try {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account";
    process.env.CLOUDFLARE_WORKERS_AI_TOKEN = "test-workers-token";
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      return Response.json({ choices: [{ message: { content: "OK" } }], usage: { prompt_tokens: 2, completion_tokens: 1 } });
    };
    const provider = configuredProviders().find(item => item.id === "cloudflare")!;
    assert.equal(provider.configured, true);
    const result = await provider.generateText(request);
    assert.equal(result.text, "OK");
    assert.equal(result.provider, "cloudflare");
    assert.equal(result.usage.inputTokens, 2);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.cloudflare.com/client/v4/accounts/account/ai/v1/chat/completions");
    assert.equal(calls[0].headers.get("authorization"), "Bearer test-workers-token");
    assert.equal(calls[0].headers.get("cf-aig-gateway-id"), "bidscope-ai");
    assert.equal(calls[0].headers.get("cf-aig-skip-cache"), "true");
    assert.equal(calls[0].headers.get("cf-aig-collect-log"), "false");
    assert.equal(calls[0].body.model, request.model);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.account === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = previous.account;
    if (previous.token === undefined) delete process.env.CLOUDFLARE_WORKERS_AI_TOKEN; else process.env.CLOUDFLARE_WORKERS_AI_TOKEN = previous.token;
  }
});

test("Workers AI does not retry an HTTP rate limit", async () => {
  const previous = { account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_WORKERS_AI_TOKEN, fetch: globalThis.fetch };
  let calls = 0;
  try {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account";
    process.env.CLOUDFLARE_WORKERS_AI_TOKEN = "test-workers-token";
    globalThis.fetch = async () => { calls++; return new Response("rate limited", { status: 429 }); };
    const provider = configuredProviders().find(item => item.id === "cloudflare")!;
    await assert.rejects(() => provider.generateText(request), /429/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.account === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = previous.account;
    if (previous.token === undefined) delete process.env.CLOUDFLARE_WORKERS_AI_TOKEN; else process.env.CLOUDFLARE_WORKERS_AI_TOKEN = previous.token;
  }
});
