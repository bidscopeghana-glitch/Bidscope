"use client";

import Link from "next/link";
import { ArrowRight, LogIn, LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";

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
    <a href="#bidscope-sign-in" className="inline-flex items-center gap-1.5 rounded-full bg-[#116149] px-3 py-2 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#0d523e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#116149]/35 focus-visible:ring-offset-2">
      <LogIn size={14}/><span className="hidden sm:inline">Sign in / Sign up</span><span className="sm:hidden">Sign in</span>
    </a>
  </>;
}

export function AuthModal() {
  return <div id="bidscope-sign-in" className="fixed inset-0 z-50 hidden place-items-center bg-[#082d24]/65 p-4 backdrop-blur-sm target:grid">
    <a href="#" aria-label="Close sign in" className="absolute inset-0" />
    <div role="dialog" aria-modal="true" aria-labelledby="bidscope-auth-title" aria-describedby="bidscope-auth-description" className="relative w-full max-w-md overflow-hidden rounded-[26px] bg-[#fffdf8] shadow-[0_30px_100px_rgba(7,47,37,.32)]">
      <a href="#" aria-label="Close sign in" className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"><X size={17}/></a>
      <div className="bg-[#103f32] px-6 pb-7 pt-8 text-white sm:px-8">
        <BrandLogo className="h-auto w-[150px] brightness-0 invert" />
        <div className="mt-8 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8ce0bd]">Your BidScope account</p>
          <h2 id="bidscope-auth-title" className="serif mt-2 text-3xl font-medium leading-tight tracking-[-.03em]">Welcome to smarter bidding.</h2>
          <p id="bidscope-auth-description" className="mt-2 text-sm leading-6 text-white/70">Sign in or create an account to save opportunities, track decisions and manage your bid workspace.</p>
        </div>
      </div>
      <div className="px-6 pb-7 pt-6 sm:px-8">
        <a href="/api/auth/google" className="group flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#17362d]/15 bg-white px-4 text-sm font-bold text-[#17362d] shadow-sm transition hover:-translate-y-0.5 hover:border-[#116149]/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#116149]/30">
          <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-white text-base font-extrabold text-[#4285f4] shadow-[0_0_0_1px_rgba(23,54,45,.12)]">G</span>
          Continue with Google
          <ArrowRight className="ml-auto transition group-hover:translate-x-0.5" size={16}/>
        </a>
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#edf3ee] p-4 text-xs leading-5 text-[#526a61]">
          <ShieldCheck className="mt-0.5 shrink-0 text-[#116149]" size={17}/>
          <p>Google securely confirms your identity. BidScope never receives or stores your Google password.</p>
        </div>
        <p className="mt-5 text-center text-[11px] leading-5 text-[#718079]">By continuing, you agree to our <Link className="font-semibold text-[#315b4e] underline-offset-2 hover:underline" href="/terms">Terms</Link> and acknowledge our <Link className="font-semibold text-[#315b4e] underline-offset-2 hover:underline" href="/privacy">Privacy Policy</Link>.</p>
      </div>
    </div></div>;
}
