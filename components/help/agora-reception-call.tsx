"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import type { IAgoraRTCClient, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { getValidAccessToken } from "@/lib/client/session";

type CallAccess = { appId: string; channel: string; uid: number; token: string; agentId: string; stopProof: string; expiresAt: number };
type CallState = "idle" | "connecting" | "connected";

export function AgoraReceptionCall({ currentPath, onHandoff }: { currentPath: string; onHandoff: () => void }) {
  const [available, setAvailable] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const trackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const accessRef = useRef<CallAccess | null>(null);
  const activeRef = useRef(false);
  const connectedRef = useRef(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void getValidAccessToken().then(token => token ? fetch("/api/ai/voice/agora", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }) : null).then(response => response?.json()).then(data => { const status = data as { enabled?: boolean; eligible?: boolean } | undefined; setAvailable(status?.enabled === true); setEligible(status?.eligible === true); }).catch(() => setAvailable(false));
  }, []);

  const end = useCallback(async (offerReview = true) => {
    activeRef.current = false;
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = null;
    if (offerReview && connectedRef.current) setReviewOpen(true);
    connectedRef.current = false;
    trackRef.current?.stop(); trackRef.current?.close(); trackRef.current = null;
    const client = clientRef.current; clientRef.current = null;
    if (client) await client.leave().catch(() => undefined);
    const access = accessRef.current; accessRef.current = null;
    setState("idle"); setMuted(false);
    if (access) {
      const auth = await getValidAccessToken().catch(() => null);
      if (auth) await fetch("/api/ai/voice/agora", { method: "DELETE", headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify({ agentId: access.agentId, stopProof: access.stopProof }), keepalive: true }).catch(() => undefined);
    }
  }, []);

  useEffect(() => () => { void end(false); }, [end]);

  async function start() {
    if (state !== "idle") return;
    activeRef.current = true; setState("connecting"); setError("");
    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      // Ask for microphone permission in direct response to the user's click.
      const microphone = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "speech_standard" });
      trackRef.current = microphone;
      const auth = await getValidAccessToken();
      if (!auth) throw new Error("Sign in to speak with Taleh.");
      const response = await fetch("/api/ai/voice/agora", { method: "POST", headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify({ currentPath }) });
      const result = await response.json() as { data?: CallAccess; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "Taleh could not start the call.");
      accessRef.current = result.data;
      if (!activeRef.current) { await end(); return; }
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;
      client.on("user-published", async (user, mediaType) => {
        if (String(user.uid) !== "0" || mediaType !== "audio") return;
        await client.subscribe(user, "audio");
        user.audioTrack?.play();
      });
      client.on("user-left", user => { if (String(user.uid) === "0" && connectedRef.current) void end(); });
      client.on("connection-state-change", connection => { if (connection === "DISCONNECTED" && connectedRef.current) void end(); });
      await client.join(result.data.appId, result.data.channel, result.data.token, result.data.uid);
      await client.publish(microphone);
      if (!activeRef.current) { await end(false); return; }
      connectedRef.current = true;
      expiryTimer.current = setTimeout(() => { void end(); }, Math.max(1000, result.data.expiresAt - Date.now()));
      setState("connected");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Agora voice could not connect.";
      setError(/permission|denied|notallowed/i.test(message) ? "Microphone access was denied. Allow it in your browser or use Taleh's text chat." : message);
      await end(false);
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!rating || reviewBusy) return;
    setReviewBusy(true); setReviewError("");
    try {
      const auth = await getValidAccessToken();
      if (!auth) throw new Error("Sign in to submit a call review.");
      const response = await fetch("/api/feedback", { method: "POST", headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify({ category: "GENERAL", subject: "Taleh voice call review", message: `Taleh voice call rating: ${rating} out of 5. ${reviewText.trim()}`.trim(), rating, pageUrl: currentPath }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Your review could not be sent.");
      setReviewOpen(false); setRating(0); setReviewText("");
    } catch (caught) { setReviewError(caught instanceof Error ? caught.message : "Your review could not be sent."); }
    finally { setReviewBusy(false); }
  }

  if (!available) return null;
  return <><div className="bidscope-agora-call" aria-label="Live call with Taleh">
    <div className="bidscope-agora-call-heading"><span className="bidscope-agora-avatar" aria-hidden="true">T</span><div><strong>Taleh · BidScope AI</strong><small>{state === "connected" ? "Live receptionist call" : state === "connecting" ? "Connecting securely…" : "Natural voice, BidScope AI brain"}</small></div></div>
    {eligible ? <button type="button" onClick={() => void start()} disabled={state !== "idle"}><Phone size={17}/> {state === "idle" ? "Call Taleh" : "Call in progress"}</button> : <p>Live voice calls are for subscribed members. Text help is still available.</p>}
    {!eligible && <Link href="/customer/billing">Compare plans</Link>}
    {error && <p role="alert">{error}</p>}
    <small>Microphone audio is handled by Agora for this call. BidScope receives and saves the spoken question transcript and AI reply; no call recording is created here. Tender evaluation remains in its paid tool.</small>
  </div>
  {state !== "idle" && typeof document !== "undefined" && createPortal(<div className="bidscope-call-overlay" role="dialog" aria-modal="true" aria-label="Call with Taleh"><div className="bidscope-call-stage"><div className="bidscope-call-top"><span>BidScope Meet · AI Reception</span><span>{state === "connected" ? "● Connected" : "Connecting…"}</span></div><div className="bidscope-call-person"><span className="bidscope-call-avatar" aria-hidden="true">T</span><h2>Taleh</h2><p>BidScope AI receptionist</p><span className="bidscope-call-pulse">{state === "connected" ? "You can speak now" : "Preparing your private call"}</span></div><div className="bidscope-call-bottom"><button type="button" disabled={state !== "connected"} onClick={() => { const next = !muted; void trackRef.current?.setEnabled(!next); setMuted(next); }}><span>{muted ? <MicOff size={22}/> : <Mic size={22}/>}</span>{muted ? "Unmute" : "Mute"}</button><button type="button" className="hangup" onClick={() => void end()}><span><PhoneOff size={22}/></span>End call</button><button type="button" onClick={() => { void end(); onHandoff(); }}><span>✉</span>Message team</button></div></div></div>, document.body)}
  {reviewOpen && typeof document !== "undefined" && createPortal(<div className="bidscope-call-overlay" role="dialog" aria-modal="true" aria-label="Review your call with Taleh"><form className="bidscope-call-review" onSubmit={submitReview}><span className="bidscope-call-avatar" aria-hidden="true">T</span><h2>How was your call with Taleh?</h2><p>Your review helps us improve BidScope AI. If she could not resolve your query, you can send it to our team.</p><div className="bidscope-call-stars" role="group" aria-label="Rate the call">{[1,2,3,4,5].map(value => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={rating === value}>{value <= rating ? "★" : "☆"}</button>)}</div><label htmlFor="taleh-review">Anything else? (optional)</label><textarea id="taleh-review" maxLength={2000} rows={3} value={reviewText} onChange={event => setReviewText(event.target.value)} placeholder="What worked well, or what could improve?"/><div className="bidscope-call-review-actions"><button type="submit" disabled={!rating || reviewBusy}>{reviewBusy ? "Sending…" : "Submit review"}</button><button type="button" onClick={() => { setReviewOpen(false); onHandoff(); }}>Message the team</button><button type="button" onClick={() => setReviewOpen(false)}>Not now</button></div>{reviewError && <p role="alert">{reviewError}</p>}</form></div>, document.body)}
  </>;
}
