"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUpRight, HelpCircle, Send, Sparkles, X } from "lucide-react";
import { useBidScopeSession } from "@/components/procurement/auth-nav";
import { api } from "@/components/customer/data";

type HelpReply = {
  answer: string;
  routedToTenderEvaluation: boolean;
  links: Array<{ label: string; href: string; primary?: boolean }>;
};
type Message = { role: "user" | "assistant"; content: string; reply?: HelpReply };

const suggestions = ["How do I find opportunities?", "How do I set up alerts?", "Which plan is right for me?"];

export function FloatingHelp() {
  const pathname = usePathname();
  const session = useBidScopeSession();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello — I’m the BidScope Help Assistant. Ask me how to use the platform, alerts, plans or your bid workspace." },
  ]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => panel.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus(), 120);
  }, [open]);

  async function ask(value: string) {
    const clean = value.trim();
    if (!clean || busy || !session) return;
    setQuestion(""); setError(""); setBusy(true);
    setMessages((current) => [...current, { role: "user", content: clean }]);
    try {
      const response = await api<{ data: HelpReply }>("/api/ai/help", { question: clean, currentPath: pathname });
      setMessages((current) => [...current, { role: "assistant", content: response.data.answer, reply: response.data }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Help Assistant could not respond.");
    } finally { setBusy(false); }
  }

  return <div className={`bidscope-help ${open ? "is-open" : ""}`}>
    {open && <div ref={panel} className="bidscope-help-panel" role="dialog" aria-label="BidScope Help Assistant" aria-modal="false">
      <header><div><span className="bidscope-help-status"/><span><strong>BidScope Help</strong><small>Product guidance</small></span></div><button onClick={() => setOpen(false)} aria-label="Close help"><X size={19}/></button></header>
      <div className="bidscope-help-thread" aria-live="polite">
        {messages.map((message, index) => <article className={message.role} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "BidScope" : "You"}</span><p>{message.content}</p>{message.reply?.links?.length ? <div className="bidscope-help-links">{message.reply.links.map(link => <Link href={link.href} key={link.href} onClick={() => setOpen(false)} className={link.primary ? "primary" : ""}>{link.label}<ArrowUpRight size={12}/></Link>)}</div> : null}{message.reply?.routedToTenderEvaluation ? <small><Sparkles size={12}/> Tender-specific analysis belongs in AI Tender Evaluation.</small> : null}</article>)}
        {busy && <div className="bidscope-help-thinking"><i/><i/><i/><span>Finding the right guidance…</span></div>}
      </div>
      {session === false ? <div className="bidscope-help-signin"><p>Sign in to ask the assistant and get guidance matched to your workspace.</p><Link href={`/sign-in?next=${encodeURIComponent(pathname)}`}>Sign in to continue</Link><Link href="/plans" className="secondary">Compare plans</Link></div> : session === null ? <div className="bidscope-help-signin"><p>Checking your account…</p></div> : <>
        {messages.length === 1 && <div className="bidscope-help-suggestions">{suggestions.map(suggestion => <button key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div>}
        <form onSubmit={(event: FormEvent) => { event.preventDefault(); void ask(question); }}><label htmlFor="floating-help-question">Ask BidScope</label><div><textarea id="floating-help-question" rows={2} maxLength={1000} value={question} onChange={event => setQuestion(event.target.value)} placeholder="How can we help?"/><button disabled={busy || question.trim().length < 2} aria-label="Send question"><Send size={17}/></button></div>{error && <p role="alert">{error}</p>}</form>
      </>}
      <footer><span>For tender requirements, use</span><Link href="/customer/ai" onClick={() => setOpen(false)}>AI Tender Evaluation <ArrowUpRight size={12}/></Link></footer>
    </div>}
    <button className="bidscope-floating-help" onClick={() => setOpen(value => !value)} aria-label={open ? "Close BidScope Help Assistant" : "Open BidScope Help Assistant"} aria-expanded={open}>{open ? <X size={22}/> : <HelpCircle size={22}/>}<span>{open ? "Close" : "Help"}</span></button>
  </div>;
}
