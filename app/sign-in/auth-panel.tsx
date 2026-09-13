"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "sign-in" | "sign-up";
type State = "idle" | "submitting" | "success" | "error";

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  function chooseMode(next: Mode) {
    setMode(next);
    setState("idle");
    setMessage("");
    setShowPassword(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") || "");
    if (mode === "sign-up" && password !== String(values.get("confirmPassword") || "")) {
      setState("error");
      setMessage("Your passwords do not match.");
      return;
    }

    setState("submitting");
    setMessage("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email: values.get("email"), password, fullName: values.get("fullName") }),
      });
      const result = (await response.json()) as { accessToken?: string | null; refreshToken?: string | null; expiresIn?: number; confirmationRequired?: boolean; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "We could not complete that request.");

      if (result.confirmationRequired) {
        setState("success");
        setMessage(result.message || "Check your email to confirm your account.");
        form.reset();
        return;
      }
      if (!result.accessToken) throw new Error("A secure session could not be created. Please try again.");

      localStorage.setItem("bidscope_access_token", result.accessToken);
      if (result.refreshToken) localStorage.setItem("bidscope_refresh_token", result.refreshToken);
      localStorage.setItem("bidscope_token_expires_at", String(Date.now() + (result.expiresIn || 3600) * 1000));
      setState("success");
      setMessage(mode === "sign-up" ? "Your account is ready. Opening BidScope…" : "Welcome back. Opening BidScope…");
      window.setTimeout(() => router.replace("/workspace"), 500);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  const busy = state === "submitting";

  return (
    <div className="rounded-[26px] border border-[#17362d]/10 bg-[#fffdf8]/97 p-5 shadow-[0_24px_70px_rgba(8,39,30,.2)] backdrop-blur-xl sm:p-7 lg:bg-[#fffdf8] lg:shadow-[0_24px_70px_rgba(19,62,49,.11)]">
      <div className="grid grid-cols-2 rounded-2xl bg-[#e8eee9] p-1" role="tablist" aria-label="Account access">
        <button type="button" role="tab" aria-selected={mode === "sign-in"} onClick={() => chooseMode("sign-in")} className={`h-11 rounded-xl text-sm font-bold ${mode === "sign-in" ? "bg-white text-[#17362d] shadow-sm" : "text-[#61736a] hover:text-[#17362d]"}`}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === "sign-up"} onClick={() => chooseMode("sign-up")} className={`h-11 rounded-xl text-sm font-bold ${mode === "sign-up" ? "bg-white text-[#17362d] shadow-sm" : "text-[#61736a] hover:text-[#17362d]"}`}>Create account</button>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        {mode === "sign-up" && <Field label="Full name" name="fullName" type="text" autoComplete="name" placeholder="Your full name" />}
        <Field label="Email address" name="email" type="email" autoComplete="email" placeholder="you@company.com" />
        <label className="grid gap-2 text-sm font-bold text-[#315b4e]">
          Password
          <span className="relative">
            <input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} required placeholder={mode === "sign-up" ? "At least 8 characters" : "Enter your password"} className="h-12 w-full rounded-xl border border-[#17362d]/15 bg-white px-4 pr-12 font-normal text-[#17362d] outline-none placeholder:text-[#8a9791] focus:border-[#16805e] focus:ring-3 focus:ring-[#16805e]/12" />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-lg text-[#718079] hover:bg-[#edf3ee]">
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>
        {mode === "sign-up" && <Field label="Confirm password" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Type your password again" minLength={8} />}

        {mode === "sign-up" && <label className="flex items-start gap-2.5 text-xs font-normal leading-5 text-[#61736a]"><input name="terms" type="checkbox" required className="mt-1 size-4 shrink-0 accent-[#116149]"/><span>I agree to the <Link href="/terms" className="font-bold text-[#315b4e] hover:underline">Terms</Link> and acknowledge the <Link href="/privacy" className="font-bold text-[#315b4e] hover:underline">Privacy Policy</Link>.</span></label>}

        {message && <p role="status" className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-xs leading-5 ${state === "success" ? "bg-[#e3f2e9] text-[#176347]" : "bg-red-50 text-red-700"}`}>{state === "success" && <CheckCircle2 className="mt-0.5 shrink-0" size={15}/>} {message}</p>}

        <button disabled={busy || state === "success"} className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#116149] px-5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(17,97,73,.2)] hover:-translate-y-0.5 hover:bg-[#0d523e] disabled:cursor-wait disabled:opacity-65">
          {busy ? <><LoaderCircle className="animate-spin" size={17}/>Please wait…</> : <>{mode === "sign-up" ? "Create my account" : "Sign in securely"}<ArrowRight size={17}/></>}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.12em] text-[#89958f] before:h-px before:flex-1 before:bg-[#17362d]/10 after:h-px after:flex-1 after:bg-[#17362d]/10">or continue with</div>

      <a href="/api/auth/google" className="group flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#17362d]/15 bg-white px-4 text-sm font-bold text-[#17362d] shadow-sm transition hover:-translate-y-0.5 hover:border-[#116149]/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#116149]/30">
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-full border border-[#17362d]/10 bg-white font-extrabold text-[#4285f4] shadow-sm">G</span>
        {mode === "sign-up" ? "Sign up with Google" : "Sign in with Google"}
      </a>

      <p className="mt-5 flex items-start gap-3 text-xs leading-5 text-[#61736a]"><ShieldCheck className="mt-0.5 shrink-0 text-[#116149]" size={16}/>Your credentials are handled through BidScope’s secure account service.</p>
    </div>
  );
}

function Field({ label, name, type, autoComplete, placeholder, minLength }: { label: string; name: string; type: string; autoComplete: string; placeholder: string; minLength?: number }) {
  return <label className="grid gap-2 text-sm font-bold text-[#315b4e]">{label}<input name={name} type={type} autoComplete={autoComplete} placeholder={placeholder} minLength={minLength} required className="h-12 rounded-xl border border-[#17362d]/15 bg-white px-4 font-normal text-[#17362d] outline-none placeholder:text-[#8a9791] focus:border-[#16805e] focus:ring-3 focus:ring-[#16805e]/12"/></label>;
}
