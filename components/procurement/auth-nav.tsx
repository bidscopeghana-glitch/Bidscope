"use client";

import Link from "next/link";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const sessionEvent = "bidscope-session-change";

function hasActiveSession() {
  try {
    const token = window.localStorage.getItem("bidscope_access_token");
    const expiresAt = Number(window.localStorage.getItem("bidscope_token_expires_at") || 0);
    return Boolean(token && (!expiresAt || expiresAt > Date.now()));
  } catch {
    return false;
  }
}

export function useBidScopeSession() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setSignedIn(hasActiveSession());
    const timer = window.setTimeout(update, 0);
    window.addEventListener("storage", update);
    window.addEventListener(sessionEvent, update);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", update); window.removeEventListener(sessionEvent, update); };
  }, []);
  return signedIn;
}

export function MemberNavLinks({ mode = "header", onNavigate }: { mode?: "header" | "landing" | "mobile"; onNavigate?: () => void }) {
  const signedIn = useBidScopeSession();
  if (!signedIn) return null;
  const links = [["/live-opportunities", "Live"], ["/awarded-opportunities", "Awards"], ["/workspace", "Workspace"]] as const;
  if (mode === "mobile") return <>{links.map(([href,label])=><Link key={href} href={href} onClick={onNavigate} className="rounded-lg px-2 py-2 text-center text-xs font-medium hover:bg-[#eee8d9]">{label}</Link>)}</>;
  const className = mode === "landing" ? "inline-flex items-center rounded-full px-3 py-2 text-sm font-semibold text-[#35554a] hover:bg-[#e9f1e8]" : "hidden rounded-full px-3 py-2 hover:bg-[#e9f1e8] md:inline-flex";
  return <>{links.map(([href,label])=><Link key={href} href={href} className={className}>{label === "Live" && <span className="mr-1.5 size-2 rounded-full bg-[#16a36f] shadow-[0_0_0_3px_rgba(22,163,111,.14)]"/>}{label}</Link>)}</>;
}

export function AuthNav() {
  const session = useBidScopeSession();
  const signedIn = session === true;
  const router = useRouter();

  function signOut() {
    localStorage.removeItem("bidscope_access_token");
    localStorage.removeItem("bidscope_refresh_token");
    localStorage.removeItem("bidscope_token_expires_at");
    window.dispatchEvent(new Event(sessionEvent));
    router.push("/");
    router.refresh();
  }

  if (signedIn) return <div className="flex items-center gap-1"><Link href="/profile" className="inline-flex items-center gap-1.5 rounded-full bg-[#116149] px-3 py-2 text-white transition hover:bg-[#0d523e]"><UserRound size={14}/><span className="hidden sm:inline">Profile</span></Link><button type="button" onClick={signOut} aria-label="Sign out" className="inline-flex items-center gap-1.5 rounded-full border border-[#17362d]/15 px-2.5 py-2 text-[#27493f] transition hover:bg-[#e9f1e8]"><LogOut size={14}/></button></div>;
  return <>
    <Link href="/sign-in" className="inline-flex items-center gap-1.5 rounded-full bg-[#116149] px-3 py-2 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#0d523e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#116149]/35 focus-visible:ring-offset-2">
      <LogIn size={14}/><span className="hidden sm:inline">Sign in / Sign up</span><span className="sm:hidden">Sign in</span>
    </Link>
  </>;
}
