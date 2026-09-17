import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../../lib/server/procurement-ai.ts",import.meta.url),"utf8");
const providers=readFileSync(new URL("../../lib/server/ai/providers.ts",import.meta.url),"utf8");

test("BidScope AI uses a server-only Gemini Auth key",()=>{
  assert.match(providers,/process\.env\.GOOGLE_GEMINI_API_KEY\|\|process\.env\.GEMINI_API_KEY/);
  assert.match(providers,/"x-goog-api-key":key/);
  assert.match(providers,/gemini-3\.6-flash/);
  assert.doesNotMatch(providers,/\?key=/);
});

test("Gemini interactions are private and retain grounded procurement rules",()=>{
  assert.match(providers,/:generateContent/);
  assert.match(providers,/url_context/);
  assert.match(providers,/google_search/);
  assert.match(source,/Not found in the reviewed sources/);
  assert.match(source,/review the official tender documents/);
});

test("AI route refreshes current official source content before analysis",()=>{
  const route=readFileSync(new URL("../../app/api/ai/assistant/route.ts",import.meta.url),"utf8");
  assert.match(route,/extractDocumentText/);
  assert.match(route,/Live official source/);
  assert.match(route,/Promise\.allSettled/);
});
