"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, LockKeyhole, MessageSquareText, Send, ShieldCheck } from "lucide-react";
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
  const openedBid = useRef("");
  const end = useRef<HTMLDivElement>(null);

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
                <span className={`tc-status ${active.status}`}><LockKeyhole size={13} /> {active.status}</span>
              </div>
              <div className="tc-notice">This private thread belongs only to this BidScope-managed tender and bidding organisation. Keep decisions and formal submissions in the appropriate procurement workflow.</div>
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
