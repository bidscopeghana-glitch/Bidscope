export class VoiceCallTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceCallTimeoutError";
  }
}

/** Bound steps that can wait indefinitely on browser permissions or RTC networking. */
export function waitForVoiceCallStep<T>(
  task: Promise<T>,
  timeoutMs: number,
  message: string,
  onLateSuccess?: (value: T) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      finished = true;
      reject(new VoiceCallTimeoutError(message));
    }, timeoutMs);

    task.then(
      value => {
        if (finished) {
          try { onLateSuccess?.(value); } catch { /* late resources must not crash the page */ }
          return;
        }
        finished = true;
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function voiceCallErrorMessage(error: unknown): string {
  if (error instanceof VoiceCallTimeoutError) return error.message;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (/NotAllowedError|PermissionDeniedError|SecurityError/i.test(name) || /permission|denied|notallowed/i.test(message)) {
    return "Microphone access was denied. Allow the microphone for BidScope in your browser, then try again. Text help remains available.";
  }
  if (/NotFoundError|DevicesNotFoundError|NotReadableError|TrackStartError/i.test(name)) {
    return "No usable microphone was found. Connect or enable a microphone, then try again. Text help remains available.";
  }
  return message || "The voice call could not connect. Please try again or use Taleh's text help.";
}
