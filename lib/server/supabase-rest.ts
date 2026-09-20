import { ApiError } from "./api-error.ts";

type SupabaseOptions = RequestInit & {
  accessToken?: string;
  count?: "exact";
  serviceRole?: boolean;
};

export function supabaseConfiguration() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new ApiError(503, "Database service is not configured.", "database_unavailable");
  return { url, serviceKey, publicKey };
}

export async function supabaseRest<T>(path: string, options: SupabaseOptions = {}) {
  const { url, serviceKey, publicKey } = supabaseConfiguration();
  const key = options.serviceRole === false ? (publicKey || serviceKey) : serviceKey;
  if (!key) throw new ApiError(503, "Database credentials are not configured.", "database_unavailable");
  const headers = new Headers(options.headers);
  headers.set("apikey", key);
  // Supabase's current sb_secret_/sb_publishable_ keys belong in apikey only.
  // Legacy JWT keys may still be used as Bearer credentials, while an actual
  // user access token must always take precedence for RLS-scoped requests.
  const bearer = options.accessToken || (key.split(".").length === 3 ? key : null);
  if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
  else headers.delete("Authorization");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (options.count) headers.set("Prefer", `count=${options.count}`);

  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers, cache: "no-store" });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    console.error("Supabase REST request failed", response.status, path, data?.code || data?.message || "unknown");
    throw new ApiError(response.status >= 500 ? 503 : response.status, "The data request could not be completed.", "database_request_failed");
  }
  return { data: data as T, response };
}

export async function supabaseRpc<T>(name: string, body: unknown, accessToken?: string) {
  return supabaseRest<T>(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
    accessToken,
    serviceRole: !accessToken,
  });
}

export function encodeFilter(value: string) {
  return encodeURIComponent(value.replace(/[(),]/g, " ").trim());
}
