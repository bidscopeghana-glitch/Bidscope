import assert from "node:assert/strict";
import test from "node:test";
import { spokenExcerpt } from "../../lib/server/ai/taleh-speech.ts";

test("Taleh sends a short, intelligible excerpt to natural speech", () => {
  assert.equal(spokenExcerpt("Hello. I can help."), "Hello. I can help.");
  const long = "I found five opportunities in Ghana. " + "Open a result to review the official tender record and confirm every requirement. ".repeat(4);
  const spoken = spokenExcerpt(long);
  assert.ok(spoken.length <= 200);
  assert.ok(spoken.endsWith("."));
  assert.equal(spokenExcerpt("Visit https://example.com/private. I can help."), "Visit the link on screen I can help.");
});
