import test from "node:test";
import assert from "node:assert/strict";
import { aiGatewayBaseUrl, configuredProviders } from "../../lib/server/ai/providers.ts";

const request = { model: "test-model", messages: [{ role: "user" as const, content: "Ping" }], maxOutputTokens: 16 };

test("gateway is opt-in and maps provider-native paths", () => {
  const previous = { account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_AI_GATEWAY_TOKEN };
  try {
    delete process.env.CLOUDFLARE_AI_GATEWAY_TOKEN;
    assert.equal(aiGatewayBaseUrl("groq"), null);
    process.env.CLOUDFLARE_ACCOUNT_ID = "account";
    process.env.CLOUDFLARE_AI_GATEWAY_TOKEN = "test-token";
    assert.equal(aiGatewayBaseUrl("groq"), "https://gateway.ai.cloudflare.com/v1/account/bidscope-ai/groq");
    assert.equal(aiGatewayBaseUrl("gemini"), "https://gateway.ai.cloudflare.com/v1/account/bidscope-ai/google-ai-studio/v1beta");
    assert.equal(aiGatewayBaseUrl("openrouter"), "https://gateway.ai.cloudflare.com/v1/account/bidscope-ai/openrouter");
    assert.equal(aiGatewayBaseUrl("openai"), "https://gateway.ai.cloudflare.com/v1/account/bidscope-ai/openai");
  } finally {
    if (previous.account === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = previous.account;
    if (previous.token === undefined) delete process.env.CLOUDFLARE_AI_GATEWAY_TOKEN; else process.env.CLOUDFLARE_AI_GATEWAY_TOKEN = previous.token;
  }
});

test("gateway sends both scoped and upstream credentials and falls back only on transport failure", async () => {
  const previous = { account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_AI_GATEWAY_TOKEN, groq: process.env.GROQ_API_KEY, fetch: globalThis.fetch };
  const calls: Array<{ url: string; headers: Headers }> = [];
  try {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account";
    process.env.CLOUDFLARE_AI_GATEWAY_TOKEN = "test-gateway-token";
    process.env.GROQ_API_KEY = "test-provider-token";
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), headers: new Headers(init?.headers) });
      if (calls.length === 1) throw new TypeError("gateway unavailable");
      return Response.json({ choices: [{ message: { content: "OK" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    };
    const provider = configuredProviders().find(item => item.id === "groq")!;
    assert.equal((await provider.generateText(request)).text, "OK");
    assert.match(calls[0].url, /gateway\.ai\.cloudflare\.com/);
    assert.equal(calls[0].headers.get("cf-aig-authorization"), "Bearer test-gateway-token");
    assert.equal(calls[0].headers.get("authorization"), "Bearer test-provider-token");
    assert.equal(calls[1].url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(calls[1].headers.get("cf-aig-authorization"), null);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of [["CLOUDFLARE_ACCOUNT_ID", previous.account], ["CLOUDFLARE_AI_GATEWAY_TOKEN", previous.token], ["GROQ_API_KEY", previous.groq]] as Array<[string, string | undefined]>) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("gateway HTTP rate limits do not retry the same provider and risk duplicate charges", async () => {
  const previous = { account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_AI_GATEWAY_TOKEN, groq: process.env.GROQ_API_KEY, fetch: globalThis.fetch };
  let calls = 0;
  try {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account";
    process.env.CLOUDFLARE_AI_GATEWAY_TOKEN = "test-gateway-token";
    process.env.GROQ_API_KEY = "test-provider-token";
    globalThis.fetch = async () => { calls++; return new Response("rate limited", { status: 429 }); };
    const provider = configuredProviders().find(item => item.id === "groq")!;
    await assert.rejects(() => provider.generateText(request), /429/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of [["CLOUDFLARE_ACCOUNT_ID", previous.account], ["CLOUDFLARE_AI_GATEWAY_TOKEN", previous.token], ["GROQ_API_KEY", previous.groq]] as Array<[string, string | undefined]>) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
