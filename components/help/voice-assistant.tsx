"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Square, Volume2, VolumeX } from "lucide-react";
import { getValidAccessToken } from "@/lib/client/session";

type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechFailure = { error: string };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: ((event: SpeechFailure) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type RecognitionConstructor = new () => Recognition;
type VoiceMessage = { role: "user" | "assistant"; text: string; links?: Array<{ label: string; href: string }> };
type VoiceReply = { data: { threadId: string; answer: string; links: Array<{ label: string; href: string }> } };
type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";

function recognitionClass(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const browser = window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition || null;
}

export function VoiceAssistant({ currentPath, onClose }: { currentPath: string; onClose: () => void }) {
  const [messages, setMessages] = useState<VoiceMessage[]>([{ role: "assistant", text: "Welcome to BidScope. I’m Taleh, your AI receptionist. Tell me what you need: finding an opportunity, reaching our team, choosing a plan, or getting to the buyer or supplier desk." }]);
  const [question, setQuestion] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState("");
  const [micMuted, setMicMuted] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [threadId, setThreadId] = useState<string>();
  const recognition = useRef<Recognition | null>(null);
  const request = useRef<AbortController | null>(null);
  const speechRequest = useRef<AbortController | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const generation = useRef(0);
  const scroll = useRef<HTMLDivElement>(null);
  const supported = Boolean(recognitionClass());

  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); }, [messages, state]);
  useEffect(() => () => { generation.current++; recognition.current?.abort(); request.current?.abort(); speechRequest.current?.abort(); player.current?.pause(); if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); window.speechSynthesis?.cancel(); }, []);

  function stopAudio() {
    speechRequest.current?.abort(); speechRequest.current = null;
    player.current?.pause(); player.current = null;
    if (audioUrl.current) { URL.revokeObjectURL(audioUrl.current); audioUrl.current = null; }
    window.speechSynthesis?.cancel();
    setState(value => value === "speaking" ? "idle" : value);
  }

  function browserSpeak(value: string) {
    if (soundMuted || !window.speechSynthesis) { setState("idle"); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value.slice(0, 240).replace(/https?:\/\/\S+/g, "link available in transcript"));
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(voice => /female|zira|samantha|victoria|aria|jenny|serena/i.test(voice.name) && /^en/i.test(voice.lang))
      || voices.find(voice => /^en-GH/i.test(voice.lang));
    if (preferred) utterance.voice = preferred;
    utterance.lang = preferred?.lang || "en-GH";
    utterance.rate = 0.96;
    utterance.onstart = () => setState("speaking");
    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("idle");
    window.speechSynthesis.speak(utterance);
  }

  async function speak(value: string, activeThreadId: string) {
    if (soundMuted) { setState("idle"); return; }
    const controller = new AbortController(); speechRequest.current = controller;
    try {
      const token = await getValidAccessToken();
      if (!token || controller.signal.aborted) return;
      const response = await fetch("/api/ai/voice/speech", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ threadId: activeThreadId }),
      });
      if (!response.ok) throw new Error("Natural speech unavailable");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob); audioUrl.current = url;
      const audio = new Audio(url); player.current = audio;
      audio.onended = () => { if (player.current === audio) { player.current = null; setState("idle"); } URL.revokeObjectURL(url); if (audioUrl.current === url) audioUrl.current = null; };
      audio.onerror = () => { if (player.current === audio) { player.current = null; browserSpeak(value); } URL.revokeObjectURL(url); if (audioUrl.current === url) audioUrl.current = null; };
      await audio.play();
      setState("speaking");
    } catch {
      player.current?.pause(); player.current = null;
      if (audioUrl.current) { URL.revokeObjectURL(audioUrl.current); audioUrl.current = null; }
      if (!controller.signal.aborted) browserSpeak(value);
    }
    finally { if (speechRequest.current === controller) speechRequest.current = null; }
  }

  async function ask(value: string) {
    const clean = value.trim();
    if (clean.length < 2 || state === "thinking") return;
    recognition.current?.stop(); recognition.current = null;
    stopAudio(); setError(""); setQuestion(""); setState("thinking");
    setMessages(current => [...current, { role: "user", text: clean }]);
    const turn = ++generation.current;
    const controller = new AbortController(); request.current = controller;
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error("Sign in to continue talking to BidScope AI.");
      const response = await fetch("/api/ai/voice", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: clean, threadId, currentPath }), signal: controller.signal,
      });
      const payload = await response.json() as VoiceReply & { error?: string };
      if (!response.ok) throw new Error(payload.error || "BidScope AI is temporarily unavailable. Your account and tender data are unaffected.");
      if (turn !== generation.current) return;
      setThreadId(payload.data.threadId);
      setMessages(current => [...current, { role: "assistant", text: payload.data.answer, links: payload.data.links }]);
      void speak(payload.data.answer, payload.data.threadId);
    } catch (caught) {
      if (controller.signal.aborted || turn !== generation.current) return;
      setError(caught instanceof Error ? caught.message : "BidScope AI is temporarily unavailable.");
      setState("error");
    } finally { if (request.current === controller) request.current = null; }
  }

  function startListening() {
    if (micMuted) return;
    const Constructor = recognitionClass();
    if (!Constructor) { setError("Voice input is not supported in this browser. You can type your question below."); setState("error"); return; }
    if (state === "thinking") return;
    stopAudio(); recognition.current?.abort(); setError("");
    const active = new Constructor(); recognition.current = active;
    active.lang = navigator.language || "en-GH";
    active.continuous = false; active.interimResults = false;
    active.onresult = event => { const text = event.results[0]?.[0]?.transcript; if (text) void ask(text); };
    active.onerror = event => { if (event.error === "aborted" || recognition.current !== active) return; recognition.current = null; setState("error"); setError(event.error === "not-allowed" ? "Microphone access was denied. Allow it in your browser settings or type instead." : event.error === "no-speech" ? "I didn’t hear a question. Try again or type below." : "The microphone stopped unexpectedly. You can retry or type below."); };
    active.onend = () => { if (recognition.current === active) { recognition.current = null; setState(value => value === "listening" ? "idle" : value); } };
    try { active.start(); setState("listening"); } catch { setState("error"); setError("The microphone could not start. You can type your question instead."); }
  }

  function stop() {
    recognition.current?.abort(); recognition.current = null;
    request.current?.abort(); request.current = null;
    generation.current++; stopAudio(); setState("idle");
  }

  function end() {
    stop(); setThreadId(undefined); setMessages([{ role: "assistant", text: "Welcome back. I’m Taleh. How may I direct you today?" }]);
    onClose();
  }

  async function sendToTeam(event: FormEvent) {
    event.preventDefault();
    if (supportSubject.trim().length < 3 || supportMessage.trim().length < 10 || supportBusy) return;
    setSupportBusy(true); setError("");
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error("Sign in before sending a message to the BidScope team.");
      const response = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category: "GENERAL", subject: supportSubject.trim(), message: supportMessage.trim(), pageUrl: currentPath }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Your message could not be sent. Please try again.");
      setMessages(current => [...current, { role: "assistant", text: "I’ve passed your message to the BidScope team. You can track it in Feedback. I can still help you find your way around here.", links: [{ label: "View your messages", href: "/customer/feedback" }] }]);
      setSupportOpen(false); setSupportSubject(""); setSupportMessage("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Your message could not be sent."); }
    finally { setSupportBusy(false); }
  }

  return <div className="bidscope-voice" aria-label="Taleh, BidScope AI receptionist">
    <div className="bidscope-voice-status" role="status">{state === "listening" ? "Listening…" : state === "thinking" ? "Thinking…" : state === "speaking" ? "Speaking…" : state === "error" ? "Needs attention" : "Ready to talk"}</div>
    <nav className="bidscope-reception-actions" aria-label="Reception options"><Link href="/customer/discover" onClick={onClose}>Find tenders</Link><Link href="/procurement" onClick={onClose}>Buyer desk</Link><Link href="/customer/billing" onClick={onClose}>Plans</Link><button type="button" onClick={() => setSupportOpen(value => !value)}>Message the team</button></nav>
    <div className="bidscope-help-thread bidscope-voice-thread" ref={scroll} aria-live="polite">
      {messages.map((message, index) => <article className={message.role} key={`${index}-${message.role}`}><span>{message.role === "user" ? "You" : "Taleh · BidScope AI"}</span><p>{message.text}</p>{message.links?.length ? <div className="bidscope-help-links">{message.links.map(link => <Link href={link.href} key={link.href} onClick={onClose}>{link.label}</Link>)}</div> : null}</article>)}
    </div>
    {error && <p className="bidscope-voice-error" role="alert">{error}</p>}
    {supportOpen && <form className="bidscope-reception-handoff" onSubmit={sendToTeam}><strong>Pass a message to our team</strong><p>Taleh will send only what you review below. This is not a live human chat.</p><label htmlFor="taleh-subject">Subject</label><input id="taleh-subject" value={supportSubject} onChange={event => setSupportSubject(event.target.value)} minLength={3} maxLength={160} required/><label htmlFor="taleh-message">Message</label><textarea id="taleh-message" value={supportMessage} onChange={event => setSupportMessage(event.target.value)} minLength={10} maxLength={5000} rows={3} required/><button type="submit" disabled={supportBusy}>{supportBusy ? "Sending…" : "Confirm and send to BidScope"}</button></form>}
    <div className="bidscope-voice-controls" aria-label="Voice controls">
      <button type="button" onClick={state === "listening" ? stop : startListening} disabled={!supported || micMuted || state === "thinking"} aria-label={state === "listening" ? "Stop listening" : "Start listening"}>{state === "listening" ? <Square size={18}/> : <Mic size={18}/>}<span>{state === "listening" ? "Stop" : "Talk"}</span></button>
      <button type="button" onClick={() => { setMicMuted(value => !value); if (state === "listening") stop(); }} aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}>{micMuted ? <MicOff size={18}/> : <Mic size={18}/>}<span>{micMuted ? "Unmute" : "Mute"}</span></button>
      <button type="button" onClick={() => { setSoundMuted(value => !value); stopAudio(); }} aria-label={soundMuted ? "Enable spoken replies" : "Mute spoken replies"}>{soundMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}<span>{soundMuted ? "Sound off" : "Sound on"}</span></button>
      <button type="button" onClick={stop} aria-label="Stop audio and current response"><Square size={18}/><span>Stop</span></button>
      <button type="button" onClick={end} aria-label="End conversation"><span>End</span></button>
    </div>
    {!supported && <p className="bidscope-voice-note">Voice input is unavailable in this browser; text still works.</p>}
    <form className="bidscope-voice-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void ask(question); }}><label htmlFor="bidscope-voice-question">Type instead</label><div><input id="bidscope-voice-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={1000} placeholder="Ask BidScope AI…"/><button disabled={state === "thinking" || question.trim().length < 2} aria-label="Send question"><Send size={18}/></button></div></form>
    <p className="bidscope-voice-note">Taleh uses a natural female AI voice when available, with your browser voice as a fallback. Browser speech recognition may process microphone audio; BidScope receives the transcript, not microphone audio, and saves it to your AI conversation. Tender analysis stays in the subscription-controlled evaluation tool.</p>
  </div>;
}
