"use client";

import { useEffect } from "react";

/** Supabase invitations without an explicit redirect land on the site URL. */
export function InvitationRedirect() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("type") !== "invite" || !hash.get("access_token")) return;
    // The callback stores the session, clears the sensitive URL fragment and
    // resolves the destination through the normal account-routing checks.
    window.location.replace(`/auth/callback${window.location.hash}`);
  }, []);
  return null;
}
