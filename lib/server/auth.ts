import { ApiError } from "./api-error";
import { supabaseConfiguration, supabaseRest } from "./supabase-rest";
import { timingSafeEqual } from "node:crypto";

export type AuthenticatedUser = { id: string; email: string; emailConfirmedAt?: string | null; metadata?: Record<string, unknown> };
export const BIDSCOPE_ADMIN_EMAIL = "basintaleuk@gmail.com";

export async function requireUser(request: Request): Promise<{ user: AuthenticatedUser; accessToken: string }> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, "Sign in is required.", "authentication_required");
  const accessToken = match[1];
  const { url, publicKey, serviceKey } = supabaseConfiguration();
  const apiKey = publicKey || serviceKey;
  if (!apiKey) throw new ApiError(503, "Authentication service is not configured.", "authentication_unavailable");
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: apiKey, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = (await response.json()) as { id?: string; email?: string; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> };
  if (!response.ok) throw new ApiError(401, "Your session is invalid or has expired.", "invalid_session");
  if (!data?.id) throw new ApiError(401, "Your session is invalid or has expired.", "invalid_session");
  return { user: { id: data.id, email: data.email || "", emailConfirmedAt: data.email_confirmed_at || null, metadata: data.user_metadata || {} }, accessToken };
}

export async function requireOrganizationMember(userId: string, organizationId: string) {
  const query = new URLSearchParams({
    select: "role",
    organization_id: `eq.${organizationId}`,
    user_id: `eq.${userId}`,
    limit: "1",
  });
  const { data } = await supabaseRest<Array<{ role: "owner" | "admin" | "member" }>>(`organization_members?${query}`);
  if (!data.length) throw new ApiError(403, "You do not have access to this business.", "organization_access_denied");
  return data[0];
}

export async function requireSuperAdmin(request: Request) {
  const authenticated = await requireUser(request);
  if (authenticated.user.email.trim().toLowerCase() !== BIDSCOPE_ADMIN_EMAIL) {
    throw new ApiError(403, "Administrator access is restricted.", "admin_access_denied");
  }
  const query = new URLSearchParams({ select: "is_super_admin", id: `eq.${authenticated.user.id}`, limit: "1" });
  const { data } = await supabaseRest<Array<{ is_super_admin: boolean }>>(`profiles?${query}`);
  if (!data[0]?.is_super_admin) throw new ApiError(403, "Administrator access is restricted.", "admin_access_denied");
  return authenticated;
}

export function requireInternalSecret(request: Request) {
  const expected = process.env.BIDSCOPE_INTERNAL_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const valid = Boolean(expected && supplied && expected.length === supplied.length && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)));
  if (!valid) {
    throw new ApiError(401, "A valid internal service credential is required.", "invalid_internal_credential");
  }
}

export function requireCronOrInternalSecret(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.replace(/^Bearer\s+/i, "");
  const candidates = [process.env.BIDSCOPE_INTERNAL_SECRET, process.env.CRON_SECRET].filter((value): value is string => Boolean(value));
  const valid = candidates.some((expected) => expected.length === supplied.length && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)));
  if (!valid) throw new ApiError(401, "A valid scheduler credential is required.", "invalid_scheduler_credential");
}
