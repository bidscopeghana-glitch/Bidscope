import assert from "node:assert/strict";
import test from "node:test";
import { VoiceCallTimeoutError, voiceCallErrorMessage, waitForVoiceCallStep } from "../../lib/client/voice-call-timeout.ts";

test("voice call steps return successful results", async () => {
  assert.equal(await waitForVoiceCallStep(Promise.resolve("connected"), 100, "late"), "connected");
});

test("voice call steps time out and clean up a late microphone", async () => {
  let resolve!: (value: { close(): void }) => void;
  let closed = false;
  const pending = new Promise<{ close(): void }>(done => { resolve = done; });
  await assert.rejects(waitForVoiceCallStep(pending, 1, "Microphone timed out", value => value.close()), VoiceCallTimeoutError);
  resolve({ close: () => { closed = true; } });
  await Promise.resolve();
  assert.equal(closed, true);
});

test("voice call errors explain permission and missing-device failures", () => {
  assert.match(voiceCallErrorMessage(new DOMException("Permission denied", "NotAllowedError")), /Allow the microphone/);
  assert.match(voiceCallErrorMessage(new DOMException("No microphone", "NotFoundError")), /No usable microphone/);
});
