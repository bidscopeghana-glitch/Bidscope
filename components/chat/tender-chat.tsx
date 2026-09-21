"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { IAgoraRTCClient, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { ArrowLeft, LockKeyhole, MessageSquareText, Mic, MicOff, Phone, PhoneOff, Send, ShieldCheck, Users } from "lucide-react";
import { api } from "@/components/customer/data";

type Conversation = {
  id: string;
  supplier_bid_id: string;
  status: "open" | "closed";
  side: "buyer" | "supplier";
  tender: { id: string; title: string; reference_number: string | null; status: string; submission_deadline: string } | null;
  counterparty: { id: string; name: string } | null;
  lastMessage: { body: string; created_at: string } | null;
  unreadCount: number;
};
type ChatMessage = {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
  sender: { full_name: string | null; email: string } | null;
};
type VoiceCall = {
  id: string;
  conversationId: string;
  status: "active" | "ended" | "expired";
  startedByMe: boolean;
  startedAt: string;
  endedAt: string | null;
  expiresAt: string;
};
type VoiceAccess = { appId: string; channel: string; token: string; uid: string; expiresAt: string };

export function TenderChatWorkspace({
  workspace,
  conversationId,
}: {
  workspace: "buyer" | "supplier";
  conversationId?: string;
}) {
  const base = workspace === "buyer" ? "/procurement/messages" : "/customer/messages";
  const router = useRouter();
  const params = useSearchParams();
  const bidId = params.get("bid");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState(conversationId || "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [call, setCall] = useState<VoiceCall | null>(null);
  const [callState, setCallState] = useState<"idle" | "joining" | "connected">("idle");
  const [muted, setMuted] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState(0);
  const [callSeconds, setCallSeconds] = useState(0);
  const openedBid = useRef("");
  const end = useRef<HTMLDivElement>(null);
  const rtcClient = useRef<IAgoraRTCClient | null>(null);
  const microphone = useRef<IMicrophoneAudioTrack | null>(null);
  const joinedCallId = useRef("");

  const leaveVoiceChannel = useCallback(async () => {
    microphone.current?.stop();
    microphone.current?.close();
    microphone.current = null;
    if (rtcClient.current) await rtcClient.current.leave().catch(() => undefined);
    rtcClient.current = null;
    joinedCallId.current = "";
    setCallState("idle");
    setMuted(false);
    setRemoteParticipants(0);
    setCallSeconds(0);
  }, []);

  const joinVoiceChannel = useCallback(async (voiceCall: VoiceCall, access: VoiceAccess) => {
    if (joinedCallId.current === voiceCall.id && callState === "connected") return;
    setError("");
    try {
      await leaveVoiceChannel();
      setCallState("joining");
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      rtcClient.current = client;
      client.on("user-published", async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType);
        if (mediaType === "audio") remoteUser.audioTrack?.play();
        setRemoteParticipants(client.remoteUsers.length);
      });
      client.on("user-unpublished", () => setRemoteParticipants(client.remoteUsers.length));
      client.on("user-left", () => setRemoteParticipants(client.remoteUsers.length));
      await client.join(access.appId, access.channel, access.token, access.uid);
      const track = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "speech_standard" });
      microphone.current = track;
      await client.publish(track);
      joinedCallId.current = voiceCall.id;
      setCall(voiceCall);
      setRemoteParticipants(client.remoteUsers.length);
      setCallState("connected");
    } catch (caught) {
      await leaveVoiceChannel();
      setError(caught instanceof Error ? caught.message : "The voice call could not connect.");
    }
  }, [callState, leaveVoiceChannel]);

  const loadCall = useCallback(async (conversation: string) => {
    try {
      const response = await api<{ data: VoiceCall | null }>(`/api/tender-chat/call?conversationId=${encodeURIComponent(conversation)}`);
      setCall(response.data);
      if (!response.data && joinedCallId.current) await leaveVoiceChannel();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Voice-call status could not be loaded.");
    }
  }, [leaveVoiceChannel]);

  const loadList = useCallback(async () => {
    try {
      const response = await api<{ data: Conversation[] }>("/api/tender-chat");
      setConversations(response.data);
      if (!conversationId && response.data.length && window.innerWidth > 800) {
        setSelected((current) => current || response.data[0].id);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Conversations could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const loadThread = useCallback(async (id: string) => {
    try {
      const response = await api<{ data: { conversation: Conversation; messages: ChatMessage[] } }>(
        `/api/tender-chat?conversationId=${encodeURIComponent(id)}`,
      );
      setActive(response.data.conversation);
      setMessages(response.data.messages);
      setError("");
      if (response.data.conversation.unreadCount) {
        await api("/api/tender-chat", { action: "mark_read", conversationId: id });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This conversation could not be opened.");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadList(), 0);
    const timer = window.setInterval(() => void loadList(), 15000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadList]);

  useEffect(() => {
    if (!selected) return;
    const initial = window.setTimeout(() => void loadThread(selected), 0);
    const timer = window.setInterval(() => void loadThread(selected), 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadThread, selected]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void leaveVoiceChannel();
      setCall(null);
      if (selected) void loadCall(selected);
    }, 0);
    const timer = selected ? window.setInterval(() => void loadCall(selected), 4000) : 0;
    return () => {
      window.clearTimeout(initial);
      if (timer) window.clearInterval(timer);
    };
  }, [leaveVoiceChannel, loadCall, selected]);

  useEffect(() => () => { void leaveVoiceChannel(); }, [leaveVoiceChannel]);

  useEffect(() => {
    if (callState !== "connected") return;
    const started = Date.now();
    const timer = window.setInterval(() => setCallSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [callState]);

  useEffect(() => {
    if (!bidId || openedBid.current === bidId) return;
    openedBid.current = bidId;
    setBusy(true);
    void api<{ data: { id: string } }>("/api/tender-chat", { action: "open", bidId })
      .then((response) => {
        setSelected(response.data.id);
        router.replace(`${base}/${response.data.id}`);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "The tender chat could not be opened."))
      .finally(() => setBusy(false));
  }, [base, bidId, router]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = String(data.get("message") || "").trim();
    if (!message) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/tender-chat", { action: "send", conversationId: selected, message });
      form.reset();
      await Promise.all([loadThread(selected), loadList()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function startVoiceCall() {
    if (!selected || callState !== "idle") return;
    setBusy(true);
    try {
      const response = await api<{ data: { call: VoiceCall; access: VoiceAccess } }>("/api/tender-chat/call", { action: "start", conversationId: selected });
      setCall(response.data.call);
      await joinVoiceChannel(response.data.call, response.data.access);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The voice call could not be started.");
    } finally {
      setBusy(false);
    }
  }

  async function joinVoiceCall() {
    if (!selected || !call || callState !== "idle") return;
    setBusy(true);
    try {
      const response = await api<{ data: { call: VoiceCall; access: VoiceAccess } }>("/api/tender-chat/call", { action: "join", conversationId: selected, callId: call.id });
      await joinVoiceChannel(response.data.call, response.data.access);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The voice call could not be joined.");
    } finally {
      setBusy(false);
    }
  }

  async function endVoiceCall() {
    const activeCall = call;
    await leaveVoiceChannel();
    setCall(null);
    if (!selected || !activeCall) return;
    try {
      await api("/api/tender-chat/call", { action: "end", conversationId: selected, callId: activeCall.id });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The voice call could not be ended cleanly.");
    }
  }

  async function toggleMute() {
    const track = microphone.current;
    if (!track) return;
    await track.setMuted(!muted);
    setMuted((current) => !current);
  }

  const formattedCallTime = `${String(Math.floor(callSeconds / 60)).padStart(2, "0")}:${String(callSeconds % 60).padStart(2, "0")}`;

  return (
    <div className={`tc-workspace ${selected ? "has-selection" : ""}`}>
      <header className="tc-heading">
        <div>
          <p>BIDSCOPE MANAGED PROCUREMENT</p>
          <h1>Tender messages</h1>
          <span>Private communication between the buyer and each bidding organisation.</span>
        </div>
        <div className="tc-security"><ShieldCheck size={18} /> Participant restricted</div>
      </header>
      {error && <p className="tc-error" role="alert">{error}</p>}
      <div className="tc-grid">
        <aside className="tc-list" aria-label="Tender conversations">
          <div className="tc-list-head">
            <strong>Conversations</strong>
            <span>{conversations.reduce((total, item) => total + item.unreadCount, 0)} unread</span>
          </div>
          {loading ? (
            <p className="tc-empty">Loading secure conversations…</p>
          ) : conversations.length ? (
            conversations.map((conversation) => (
              <Link
                className={selected === conversation.id ? "active" : ""}
                href={`${base}/${conversation.id}`}
                key={conversation.id}
                onClick={() => setSelected(conversation.id)}
              >
                <span className="tc-avatar">{(conversation.counterparty?.name || "B").slice(0, 1).toUpperCase()}</span>
                <span className="tc-summary">
                  <strong>{conversation.counterparty?.name || (workspace === "buyer" ? "Supplier" : "Buyer")}</strong>
                  <b>{conversation.tender?.title || "Managed tender"}</b>
                  <small>{conversation.lastMessage?.body || "Conversation ready"}</small>
                </span>
                {!!conversation.unreadCount && <i>{conversation.unreadCount}</i>}
              </Link>
            ))
          ) : (
            <div className="tc-empty"><MessageSquareText size={28} /><strong>No tender conversations yet</strong><span>Chats appear after a managed tender bid has been submitted and opened.</span></div>
          )}
        </aside>
        <section className="tc-thread" aria-label="Selected tender conversation">
          {active ? (
            <>
              <div className="tc-thread-head">
                <button type="button" onClick={() => { setSelected(""); setActive(null); setMessages([]); router.push(base); }} aria-label="Back to conversations"><ArrowLeft size={18} /></button>
                <div><strong>{active.counterparty?.name || "Tender participant"}</strong><span>{active.tender?.title}{active.tender?.reference_number ? ` · ${active.tender.reference_number}` : ""}</span></div>
                <div className="tc-thread-actions">
                  {active.status === "open" && !call && callState === "idle" && <button className="tc-call-button" disabled={busy} onClick={startVoiceCall} type="button"><Phone size={16} /> Start voice call</button>}
                  <span className={`tc-status ${active.status}`}><LockKeyhole size={13} /> {active.status}</span>
                </div>
              </div>
              <div className="tc-notice">This private thread belongs only to this BidScope-managed tender and bidding organisation. Keep decisions and formal submissions in the appropriate procurement workflow.</div>
              {call && callState === "idle" && <div className="tc-call-invite"><span className="tc-call-pulse"><Phone size={18} /></span><div><strong>{call.startedByMe ? "Voice call ready" : "Incoming voice call"}</strong><span>{call.startedByMe ? "Waiting for the other participant." : "A tender participant is calling you."}</span></div><div className="tc-call-invite-actions"><button disabled={busy} onClick={joinVoiceCall} type="button"><Phone size={16} /> {call.startedByMe ? "Reconnect" : "Join call"}</button>{call.startedByMe && <button className="danger" onClick={endVoiceCall} type="button"><PhoneOff size={16}/> Cancel</button>}</div></div>}
              {callState !== "idle" && <div className="tc-call-live" role="status"><div className="tc-call-live-copy"><span className="tc-call-wave"><i/><i/><i/><i/></span><div><strong>{callState === "joining" ? "Connecting secure voice call…" : "Voice call connected"}</strong><span><Users size={13} /> {remoteParticipants + 1} participant{remoteParticipants ? "s" : ""} · {formattedCallTime}</span></div></div><div className="tc-call-controls"><button aria-label={muted ? "Unmute microphone" : "Mute microphone"} disabled={callState !== "connected"} onClick={toggleMute} type="button">{muted ? <MicOff size={17}/> : <Mic size={17}/>} {muted ? "Unmute" : "Mute"}</button><button className="danger" onClick={endVoiceCall} type="button"><PhoneOff size={17}/> End call</button></div></div>}
              <div className="tc-messages" aria-live="polite">
                {messages.length ? messages.map((message) => (
                  <article className={message.mine ? "mine" : "theirs"} key={message.id}>
                    <span>{message.mine ? "You" : message.sender?.full_name || active.counterparty?.name || "Participant"}</span>
                    <p>{message.body}</p>
                    <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time>
                  </article>
                )) : <div className="tc-empty"><MessageSquareText size={28} /><strong>Start the conversation</strong><span>Send a clear procurement-related message to the other party.</span></div>}
                <div ref={end} />
              </div>
              {active.status === "open" ? (
                <form className="tc-composer" onSubmit={send}>
                  <label htmlFor="tender-chat-message">Message</label>
                  <textarea id="tender-chat-message" name="message" required maxLength={4000} rows={3} placeholder="Write a clear tender-related message…" />
                  <button disabled={busy} type="submit"><Send size={16} /> {busy ? "Sending…" : "Send message"}</button>
                </form>
              ) : <p className="tc-closed">This conversation has been closed by the buyer.</p>}
            </>
          ) : (
            <div className="tc-empty tc-select"><MessageSquareText size={36} /><strong>Select a conversation</strong><span>Choose a managed tender thread to read and send messages.</span></div>
          )}
        </section>
      </div>
    </div>
  );
}
