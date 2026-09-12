"use client";

import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function GoogleAuthCallbackPage() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Completing your secure sign-in…");
  const router = useRouter();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const accessToken = hash.get("access_token");
    const error = hash.get("error_description") || query.get("error_description") || hash.get("error") || query.get("error");

    if (error) {
      const update = window.setTimeout(() => {
        setState("error");
        setMessage(error.replaceAll("+", " "));
      }, 0);
      return () => window.clearTimeout(update);
    }
    if (!accessToken) {
      const update = window.setTimeout(() => {
        setState("error");
        setMessage("Google sign-in did not return a valid session. Please try again.");
      }, 0);
      return () => window.clearTimeout(update);
    }

    localStorage.setItem("bidscope_access_token", accessToken);
    const refreshToken = hash.get("refresh_token");
    const expiresIn = Number(hash.get("expires_in") || 3600);
    if (refreshToken) localStorage.setItem("bidscope_refresh_token", refreshToken);
    localStorage.setItem("bidscope_token_expires_at", String(Date.now() + expiresIn * 1000));
    window.history.replaceState({}, document.title, "/auth/callback");
    const update = window.setTimeout(() => {
      setState("success");
      setMessage("You are signed in. Opening your BidScope workspace…");
    }, 0);
    const redirect = window.setTimeout(() => router.replace("/workspace"), 700);
    return () => { window.clearTimeout(update); window.clearTimeout(redirect); };
  }, [router]);

  const Icon = state === "loading" ? LoaderCircle : state === "success" ? CheckCircle2 : CircleAlert;
  return <main className="grid min-h-screen place-items-center bg-[#f7f4eb] px-5"><section className="w-full max-w-md rounded-[28px] border border-[#17362d]/10 bg-[#fffdf8] p-8 text-center shadow-[0_24px_80px_rgba(19,62,49,.12)]"><Icon className={`mx-auto ${state === "loading" ? "animate-spin text-[#116149]" : state === "success" ? "text-[#116149]" : "text-red-600"}`} size={34}/><p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#6a7a73]">BidScope secure access</p><h1 className="serif mt-3 text-3xl text-[#17362d]">{state === "error" ? "Sign-in needs attention" : "Welcome to BidScope"}</h1><p className="mt-4 text-sm leading-6 text-[#61736a]">{message}</p>{state === "error" && <a href="/api/auth/google" className="mt-6 inline-flex rounded-full bg-[#116149] px-5 py-3 text-sm font-bold text-white">Try Google sign-in again</a>}</section></main>;
}
