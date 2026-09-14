"use client";

export const SESSION_CHANGE_EVENT = "bidscope-session-change";
export const SESSION_EXPIRED_EVENT = "bidscope-session-expired";

const ACCESS_TOKEN_KEY = "bidscope_access_token";
const REFRESH_TOKEN_KEY = "bidscope_refresh_token";
const EXPIRES_AT_KEY = "bidscope_token_expires_at";
const REFRESH_EARLY_MS = 60_000;

type SessionPayload = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number;
};

let refreshInFlight: Promise<string | null> | null = null;

function notify(name: string) {
  window.dispatchEvent(new Event(name));
}

export function storeSession(session: SessionPayload) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  if (session.refreshToken) window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  window.localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + (session.expiresIn || 3600) * 1000));
  notify(SESSION_CHANGE_EVENT);
}

export function clearSession(expired = false) {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(EXPIRES_AT_KEY);
  notify(SESSION_CHANGE_EVENT);
  if (expired) notify(SESSION_EXPIRED_EVENT);
}

export function storedAccessToken() {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function refreshSession(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });
      const result = (await response.json()) as SessionPayload & { error?: string };
      if (!response.ok || !result.accessToken) return null;
      storeSession(result);
      return result.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function getValidAccessToken(forceRefresh = false): Promise<string | null> {
  const token = storedAccessToken();
  let expiresAt = 0;
  try {
    expiresAt = Number(window.localStorage.getItem(EXPIRES_AT_KEY) || 0);
  } catch {
    return null;
  }
  if (!forceRefresh && token && (!expiresAt || expiresAt > Date.now() + REFRESH_EARLY_MS)) return token;
  const refreshed = await refreshSession();
  if (refreshed) return refreshed;
  if (!token || (expiresAt && expiresAt <= Date.now())) clearSession(true);
  return null;
}
