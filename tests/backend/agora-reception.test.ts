import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Agora is the speech layer while BidScope AI remains Taleh's brain", () => {
  const start = source("app/api/ai/voice/agora/route.ts");
  const completion = source("app/api/ai/voice/agora/completions/route.ts");
  assert.match(start, /new CustomLLM\(/);
  assert.match(start, /\/api\/ai\/voice\/agora\/completions/);
  assert.match(start, /new DeepgramSTT\(/);
  assert.match(start, /new MiniMaxTTS\(/);
  assert.match(completion, /POST as answerWithBidscopeAi/);
  assert.match(completion, /await answerWithBidscopeAi\(answerRequest\)/);
  assert.doesNotMatch(start, /new (?:Groq|OpenAI|Gemini)\(/);
});

test("live calls and every AI turn enforce a paid subscription", () => {
  const start = source("app/api/ai/voice/agora/route.ts");
  const completion = source("app/api/ai/voice/agora/completions/route.ts");
  assert.match(start, /if \(!eligible\) throw new ApiError\(402/);
  assert.match(completion, /tier !== "PREMIUM"/);
  assert.match(completion, /user\.id !== bridge\.userId/);
  assert.match(source("app/api/ai/voice/speech/route.ts"), /tier !== "PREMIUM"/);
});

test("voice session credentials are encrypted, expiring and server-only", () => {
  const bridge = source("lib/server/ai/agora-voice-bridge.ts");
  assert.match(bridge, /createCipheriv\("aes-256-gcm"/);
  assert.match(bridge, /Date\.now\(\) >= data\.expiresAt/);
  assert.match(bridge, /timingSafeEqual/);
  assert.match(bridge, /import "server-only"/);
});

test("Taleh has a separate calling stage, handoff and post-call review", () => {
  const client = source("components/help/agora-reception-call.tsx");
  assert.match(client, /createPortal\(/);
  assert.match(client, /bidscope-call-stage/);
  assert.match(client, /onHandoff\(\)/);
  assert.match(client, /How was your call with Taleh\?/);
  assert.match(client, /rating, pageUrl: currentPath/);
});

test("Taleh introduces herself after the caller joins", () => {
  const start = source("app/api/ai/voice/agora/route.ts");
  assert.match(start, /greetingMessage: "Hello and welcome to BidScope\. I'm Taleh, your AI receptionist\. How can I help you today\?"/);
  assert.match(start, /greetingConfigs: \{ mode: "single_first", delay_ms: 1000 \}/);
});

test("Taleh uses a known nonzero publisher ID and the browser subscribes to it", () => {
  const start = source("app/api/ai/voice/agora/route.ts");
  const client = source("components/help/agora-reception-call.tsx");
  assert.match(start, /const agentUid = 1;/);
  assert.match(start, /agentUid: String\(agentUid\)/);
  assert.match(start, /channel, uid, agentUid, token/);
  assert.match(client, /String\(user\.uid\) !== String\(result\.data!\.agentUid\)/);
  assert.match(client, /AgoraRTC\.onAutoplayFailed/);
  assert.match(client, /Tap to hear Taleh/);
  assert.doesNotMatch(client, /String\(user\.uid\) !== "0"/);
});
