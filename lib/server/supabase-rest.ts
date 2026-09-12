import { ApiError } from "./api-error";

type SupabaseOptions = RequestInit & {
  accessToken?: string;
  count?: "exact";
  serviceRole?: boolean;
};

export function supabaseConfiguration() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new ApiError(503, "Database service is not configured.", "database_unavailable");
  return { url, serviceKey, publicKey };
}

export async function supabaseRest<T>(path: string, options: SupabaseOptions = {}) {
  const { url, serviceKey, publicKey } = supabaseConfiguration();
  const key = options.serviceRole === false ? publicKey : serviceKey;
  if (!key) throw new ApiError(503, "Database credentials are not configured.", "database_unavailable");
  const headers = new Headers(options.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${options.accessToken || key}`);
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
