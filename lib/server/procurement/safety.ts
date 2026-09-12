import { createHash } from "node:crypto";

export function stripImportedHtml(value: unknown, maximum = 50_000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

export function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180) || "opportunity";
}

export function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

export async function fetchWithRetry(url: string, init: RequestInit = {}, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000), cache: "no-store" });
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) throw new Error(`Source returned HTTP ${response.status}`);
      lastError = new Error(`Source returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error("Source request failed");
}

const calls = new Map<string, number[]>();
export function enforceSourceRateLimit(source: string, maximumPerMinute = 10) {
  const now = Date.now();
  const recent = (calls.get(source) || []).filter((time) => now - time < 60_000);
  if (recent.length >= maximumPerMinute) throw new Error(`${source} rate limit reached; retry later.`);
  recent.push(now);
  calls.set(source, recent);
}

