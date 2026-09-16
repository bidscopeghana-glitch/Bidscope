import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../../lib/server/procurement-ai.ts",import.meta.url),"utf8");

test("BidScope AI uses a server-only Gemini Auth key",()=>{
  assert.match(source,/process\.env\.GEMINI_API_KEY/);
  assert.match(source,/"x-goog-api-key":key/);
  assert.match(source,/gemini-3\.6-flash/);
  assert.doesNotMatch(source,/\?key=/);
});

test("Gemini interactions are private and retain grounded procurement rules",()=>{
  assert.match(source,/:generateContent/);
  assert.match(source,/url_context/);
  assert.match(source,/google_search/);
  assert.match(source,/Not found in the reviewed sources/);
  assert.match(source,/review the official tender documents/);
});
