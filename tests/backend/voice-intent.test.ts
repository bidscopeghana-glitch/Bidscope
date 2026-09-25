import assert from "node:assert/strict";
import test from "node:test";
import { classifyVoiceIntent } from "../../lib/server/ai/voice-intent.ts";

test("voice search extracts only a bounded keyword and does not choose arbitrary tools", () => {
  assert.deepEqual(classifyVoiceIntent("Find construction tenders in Ghana"), { kind: "search", term: "construction", country: "GH" });
  assert.deepEqual(classifyVoiceIntent("Show road tenders in Kenya"), { kind: "search", term: "road", country: "KE" });
  assert.equal(classifyVoiceIntent("Show me open opportunities").kind, "search");
});

test("tender evaluation stays in the paid evidence-grounded tool", () => {
  assert.equal(classifyVoiceIntent("Do we qualify for this tender?").kind, "tender_evaluation");
  assert.equal(classifyVoiceIntent("What mandatory documents are missing?").kind, "tender_evaluation");
});

test("spoken write requests never execute directly", () => {
  for (const request of ["Save this tender", "Create a tender alert", "Submit my bid", "Schedule a meeting", "Delete this document"]) {
    assert.equal(classifyVoiceIntent(request).kind, "write_request");
  }
});

test("normal product questions remain help requests", () => {
  assert.equal(classifyVoiceIntent("How do I change my plan?").kind, "help");
  assert.equal(classifyVoiceIntent("How do alerts work?").kind, "help");
  assert.equal(classifyVoiceIntent("What is my subscription status?").kind, "subscription");
  assert.equal(classifyVoiceIntent("Show my notifications").kind, "notifications");
  assert.equal(classifyVoiceIntent("What is my supplier verification status?").kind, "verification");
  assert.deepEqual(classifyVoiceIntent("I need to speak to a human"), { kind: "reception", desk: "human" });
  assert.deepEqual(classifyVoiceIntent("Take me to the buyer desk"), { kind: "reception", desk: "buyer" });
});
