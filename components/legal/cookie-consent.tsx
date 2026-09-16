"use client";

import Link from "next/link";
import { Cookie, Settings2, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { COOKIE_CONSENT_VERSION } from "@/lib/legal";

export const COOKIE_SETTINGS_EVENT = "bidscope-open-cookie-settings";
const STORAGE_KEY = "bidscope_cookie_consent";

type Preference = {
  version: string;
  essential: true;
  analytics: boolean;
  marketing: boolean;
  savedAt: string;
};

function readPreference(): Preference | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as Preference | null;
    return parsed?.version === COOKIE_CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function applyPreference(preference: Preference) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `bidscope_cookie_consent=${encodeURIComponent(JSON.stringify(preference))}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  document.documentElement.dataset.cookieAnalytics = preference.analytics ? "granted" : "denied";
  document.documentElement.dataset.cookieMarketing = preference.marketing ? "granted" : "denied";
  window.dispatchEvent(new CustomEvent("bidscope-cookie-consent-changed", { detail: preference }));
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [hasSavedPreference, setHasSavedPreference] = useState(false);

  useEffect(() => {
    const initialise = window.setTimeout(() => {
      const saved = readPreference();
      setHasSavedPreference(Boolean(saved));
      if (saved) {
        setAnalytics(saved.analytics);
        setMarketing(saved.marketing);
        applyPreference(saved);
      } else {
        setOpen(true);
      }
    }, 0);
    const reopen = () => {
      const current = readPreference();
      setAnalytics(current?.analytics || false);
      setMarketing(current?.marketing || false);
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => { window.clearTimeout(initialise); window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen); };
  }, []);

  function save(nextAnalytics: boolean, nextMarketing: boolean) {
    applyPreference({ version: COOKIE_CONSENT_VERSION, essential: true, analytics: nextAnalytics, marketing: nextMarketing, savedAt: new Date().toISOString() });
    setHasSavedPreference(true);
    setAnalytics(nextAnalytics);
    setMarketing(nextMarketing);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <aside role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-[760px] rounded-[22px] border border-white/15 bg-[#0b3e30]/98 p-5 text-white shadow-[0_24px_80px_rgba(4,28,21,.38)] backdrop-blur-xl sm:bottom-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e4f2e9] text-[#116149]"><Cookie size={21} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#9de2c4]">Your privacy choices</p>
              <h2 id="cookie-consent-title" className="mt-1 text-lg font-bold text-white">Choose how BidScope uses cookies</h2>
            </div>
            {hasSavedPreference && <button type="button" onClick={() => setOpen(false)} aria-label="Close cookie settings" className="grid size-9 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"><X size={18} /></button>}
          </div>
          <p className="mt-2 text-sm leading-6 text-white/72">Essential storage keeps the service secure and remembers your choices. Optional analytics helps us improve BidScope; marketing storage supports more relevant campaigns. Optional categories stay off unless you allow them.</p>

          {details && <div className="mt-4 grid gap-2.5">
            <PreferenceRow title="Essential" description="Required for security, authentication, payments and saved privacy choices." checked disabled onChange={() => undefined} />
            <PreferenceRow title="Analytics" description="Helps us understand aggregate site usage and improve performance." checked={analytics} onChange={setAnalytics} />
            <PreferenceRow title="Marketing" description="Allows campaign measurement and more relevant BidScope communications." checked={marketing} onChange={setMarketing} />
          </div>}

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => save(true, true)} className="rounded-full bg-[#d0a349] px-5 py-2.5 text-sm font-bold text-[#11372c] hover:bg-[#ddba6b]">Accept all</button>
            <button type="button" onClick={() => save(false, false)} className="rounded-full border border-white/22 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10">Reject optional</button>
            {details ? <button type="button" onClick={() => save(analytics, marketing)} className="rounded-full border border-[#8ed7b8]/35 px-5 py-2.5 text-sm font-bold text-[#a9e9cf] hover:bg-white/10">Save choices</button> : <button type="button" onClick={() => setDetails(true)} className="inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-sm font-bold text-[#a9e9cf] hover:bg-white/10"><Settings2 size={15} />Manage</button>}
            <Link href="/cookies" className="ml-auto text-xs font-semibold text-white/65 underline decoration-white/30 underline-offset-4 hover:text-white">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

function PreferenceRow({ title, description, checked, disabled, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] p-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/8 text-[#9de2c4]"><ShieldCheck size={16} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-white">{title}</strong><span className="block text-xs leading-5 text-white/58">{description}</span></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="size-5 shrink-0 accent-[#d0a349] disabled:opacity-70" /></label>;
}

export function CookieSettingsButton({ className = "" }: { className?: string }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}>Cookie settings</button>;
}

