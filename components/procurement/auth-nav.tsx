"use client";

import { LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AuthNav() {
  const [signedIn, setSignedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const update = window.setTimeout(() => setSignedIn(Boolean(localStorage.getItem("bidscope_access_token"))), 0);
    return () => window.clearTimeout(update);
  }, []);

  function signOut() {
    localStorage.removeItem("bidscope_access_token");
    localStorage.removeItem("bidscope_refresh_token");
    localStorage.removeItem("bidscope_token_expires_at");
    setSignedIn(false);
    router.push("/");
    router.refresh();
  }

  if (signedIn) return <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 rounded-full border border-[#17362d]/15 px-3 py-2 text-[#27493f] transition hover:bg-[#e9f1e8]"><LogOut size={14}/><span className="hidden sm:inline">Sign out</span></button>;
  return <a href="/api/auth/google" className="inline-flex items-center gap-1.5 rounded-full bg-[#116149] px-3 py-2 text-white shadow-sm transition hover:bg-[#0d523e]"><LogIn size={14}/><span className="hidden sm:inline">Sign in with Google</span><span className="sm:hidden">Sign in</span></a>;
}
