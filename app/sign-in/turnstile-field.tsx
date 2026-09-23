"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

export function TurnstileField({ siteKey, onToken, resetRef }: { siteKey: string; onToken: (token: string) => void; resetRef: React.RefObject<(() => void) | null> }) {
  const element = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady || !element.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(element.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
    resetRef.current = () => {
      onToken("");
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    };
    return () => {
      resetRef.current = null;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [scriptReady, siteKey, onToken, resetRef]);

  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setScriptReady(true)} />
    <div ref={element} aria-label="Security check" />
  </>;
}
