"use client";

import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useBidScopeSession } from "@/components/procurement/auth-nav";

export function MemberAccess({ children, title, description }: { children: ReactNode; title: string; description: string }) {
  const signedIn = useBidScopeSession();
  if (signedIn === null) return <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8"><div className="h-64 animate-pulse rounded-[28px] bg-white"/></section>;
  if (signedIn) return <>{children}</>;
  return <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-6 sm:py-24">
    <div className="rounded-[30px] border border-[#17362d]/10 bg-[#fffdf8] px-6 py-12 shadow-[0_24px_80px_rgba(19,62,49,.1)] sm:px-12">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e4efe8] text-[#116149]"><LockKeyhole size={25}/></span>
      <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#527065]">Member access</p>
      <h1 className="serif mt-3 text-4xl font-medium tracking-[-.035em] text-[#17362d] sm:text-5xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#61736a]">{description}</p>
      <a href="#bidscope-sign-in" className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#116149] px-6 text-sm font-bold text-white shadow-[0_12px_28px_rgba(17,97,73,.2)] hover:-translate-y-0.5 hover:bg-[#0d523e]">Sign in / Sign up <ArrowRight size={16}/></a>
      <p className="mt-5 flex items-center justify-center gap-2 text-xs text-[#718079]"><ShieldCheck size={15} className="text-[#116149]"/>Your Google account securely confirms your identity.</p>
    </div>
  </section>;
}
