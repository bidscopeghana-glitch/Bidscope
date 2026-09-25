"use client";
/* eslint-disable react-hooks/purity -- the current timestamp is used only to filter already-ended meetings in this view */
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Check, ExternalLink, Plus, Video } from "lucide-react";
import { api, invalidate, useData } from "@/components/customer/data";
import { MeetingsWorkspace } from "@/components/meetings/meetings-workspace";

type Meeting = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  provider: string;
  status: string;
  procurement_tender_id?: string | null;
  procurement_meeting_type?: string | null;
  organizer_user_id: string;
  participants?: Array<{ user_id: string | null; guest_email: string | null }>;
};
type ManagedTender = {
  id: string;
  title: string;
  reference_number: string;
  status: string;
};
export function ProcurementMeetings({ meetingId }: { meetingId?: string }) {
  if (meetingId) return <MeetingsWorkspace meetingId={meetingId} />;
  return <ProcurementMeetingList />;
}

function ProcurementMeetingList() {
  const params = useSearchParams(),
    [open, setOpen] = useState(params.has("tender")),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [meetingKind, setMeetingKind] = useState(params.has("tender") ? "tender" : "team"),
    [view, setView] = useState<"upcoming" | "today" | "past" | "cancelled">("upcoming"),
    result = useData<{
      data: Meeting[];
      settings: { max_duration_minutes: number } | null;
      googleConnected: boolean;
    }>("/api/meetings"),
    tenders = useData<{ data: ManagedTender[] }>(
      "/api/procurement?resource=tenders",
    ),
    team = useData<{ data: { members: Array<{ user_id: string; profile: { full_name: string; email: string } | null }> } }>("/api/team"),
    managedTenders = (tenders.data?.data || []).filter(
      (tender) => tender.status !== "cancelled",
    );
  async function connectGoogle() {
    try {
      const response = await api<{ data: { url: string } }>(
        "/api/meetings/google/connect",
        { returnPath: "/procurement/meetings" },
      );
      window.location.assign(response.data.url);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const f = new FormData(event.currentTarget);
    const procurementTenderId = String(f.get("tenderId") || "");
    if (meetingKind === "tender" && !procurementTenderId) {
      setMessage("Select a BidScope-managed tender before scheduling this meeting.");
      return;
    }
    if (f.get("provider") === "google_meet" && !result.data?.googleConnected) {
      setMessage("Connect Google Calendar before scheduling a Google Meet.");
      return;
    }
    setBusy(true);
    try {
      const scheduled = await api<{data:{id:string;status:string;failedInvitations?:number};error?:string}>("/api/meetings", {
        title: f.get("title"),
        startsAt: new Date(String(f.get("startsAt"))).toISOString(),
        durationMinutes: Number(f.get("duration")),
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Accra",
        provider: f.get("provider"),
        meetingType: meetingKind,
        participantUserIds: f.getAll("participants"),
        guestEmails: String(f.get("guests") || "")
          .split(/[;,\n]/)
          .map((v) => v.trim())
          .filter(Boolean),
        relatedOpportunityId: null,
        agenda: f.get("agenda") || "",
        reminderMinutes: Number(f.get("reminder")),
        recordingEnabled: false,
        transcriptionEnabled: false,
        waitingRoomEnabled: true,
        procurementTenderId: meetingKind === "tender" ? procurementTenderId : null,
        supplierBidId: meetingKind === "tender" ? params.get("bid") : null,
        supplierOrganizationId: meetingKind === "tender" ? params.get("supplier") : null,
        tenderLotId: meetingKind === "tender" ? params.get("lot") : null,
        procurementMeetingType: meetingKind === "tender" ? f.get("procurementMeetingType") : null,
        interviewQuestions: meetingKind === "tender" ? String(f.get("interviewQuestions") || "")
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean) : [],
      });
      setMessage(scheduled.data.status === "provider_failed"
        ? scheduled.error || "Meeting saved, but the room needs attention."
        : scheduled.data.failedInvitations
          ? `Meeting scheduled, but ${scheduled.data.failedInvitations} invitation${scheduled.data.failedInvitations === 1 ? "" : "s"} could not be delivered. Contact the attendee directly.`
          : meetingKind === "tender" ? "Procurement meeting scheduled and linked to the tender record." : "Meeting scheduled and invitations sent.");
      setOpen(false);
      invalidate();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const now = Date.now();
  const visible = (result.data?.data || []).filter((meeting) => {
    const start = Date.parse(meeting.starts_at), end = Date.parse(meeting.ends_at);
    const today = new Date(start).toDateString() === new Date(now).toDateString();
    if (view === "cancelled") return meeting.status === "cancelled";
    if (meeting.status === "cancelled") return false;
    if (view === "today") return today;
    if (view === "past") return end <= now;
    return end > now;
  });
  return (
    <>
      <div className="pw-hero pw-hero-collaboration">
        <p className="pw-eyebrow">BIDSCOPE MEET · PROCUREMENT</p>
        <h1>Procurement meetings</h1>
        <p>
          Supplier interviews, presentations, clarifications, negotiations and
          committee meetings stay linked to the tender and bid.
        </p>
        <div className="pw-actions mt-5">
          <button
            className="pw-button gold"
            onClick={() => setOpen(true)}
          >
            <Plus size={15} />
            Schedule meeting
          </button>
          <a className="pw-button" href="#procurement-calendar">
            Open procurement calendar
          </a>
          <button className="pw-button" onClick={connectGoogle}>
            {result.data?.googleConnected ? (
              <><Check size={15} /> Google Calendar connected</>
            ) : (
              <>Connect Google Calendar <ExternalLink size={14} /></>
            )}
          </button>
        </div>
        {!tenders.loading && !managedTenders.length && <p className="mt-3">You can schedule internal or general meetings now. Tender-linked meetings require a BidScope-managed tender.</p>}
      </div>
      {message && (
        <p className={/scheduled/.test(message) ? "pw-notice" : "pw-error"}>
          {message}
        </p>
      )}
      <section className="pw-card mt-5" id="procurement-calendar">
        <h2>Buyer meetings</h2>
        <div className="pw-subnav" role="group" aria-label="Meeting status">{(["upcoming","today","past","cancelled"] as const).map(item => <button className="pw-button" aria-pressed={view === item} key={item} onClick={() => setView(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}</div>
        {result.loading ? (
          <p>Loading meetings…</p>
        ) : result.error ? (
          <p className="pw-error">{result.error}</p>
        ) : visible.length ? (
          visible.map((m) => (
              <div className="pw-row" key={m.id}>
                <span>
                  <strong>{m.title}</strong>
                  <small>
                    {new Date(m.starts_at).toLocaleString("en-GB")} ·{" "}
                    {(
                      m.procurement_meeting_type || (m.procurement_tender_id ? "tender meeting" : "team meeting")
                    ).replaceAll("_", " ")}
                  </small>
                  <small>{m.participants?.length || 0} participant(s)</small>
                </span>
                <Link className="pw-button" href={`/procurement/meetings/${m.id}`}><Video size={17} /> View</Link>
              </div>
            ))
        ) : (
          <div className="pw-empty">
            <CalendarDays size={30} />
            <h2>No upcoming meetings</h2>
            <p>
              Schedule from a shortlisted supplier or create a procurement
              committee meeting.
            </p>
          </div>
        )}
      </section>
      {open && (
        <div className="pw-modal" role="dialog" aria-modal="true">
          <form className="pw-form" onSubmit={schedule}>
            <section className="pw-form-section">
              <h2>Schedule procurement meeting</h2>
              <div className="pw-fields">
                <label className="wide">
                  Meeting purpose
                  <select value={meetingKind} onChange={(event) => setMeetingKind(event.target.value)}>
                    <option value="team">Internal or general procurement meeting</option>
                    <option value="tender" disabled={!managedTenders.length}>BidScope-managed tender meeting</option>
                  </select>
                </label>
                {meetingKind === "tender" && <label className="wide">
                  Managed tender
                  <select
                    name="tenderId"
                    required
                    defaultValue={params.get("tender") || ""}
                  >
                    <option value="" disabled>
                      Select a BidScope-managed tender
                    </option>
                    {managedTenders.map((tender) => (
                      <option value={tender.id} key={tender.id}>
                        {tender.title} · {tender.reference_number} · {tender.status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>}
                <label className="wide">
                  Title
                  <input required minLength={3} name="title" />
                </label>
                {meetingKind === "tender" && <label>
                  Meeting type
                  <select name="procurementMeetingType">
                    <option value="supplier_interview">
                      Supplier Interview
                    </option>
                    <option value="supplier_presentation">
                      Supplier Presentation
                    </option>
                    <option value="clarification">Clarification Meeting</option>
                    <option value="negotiation">Negotiation Meeting</option>
                    <option value="evaluation_committee">
                      Evaluation Committee Meeting
                    </option>
                  </select>
                </label>}
                <label>
                  Date and time
                  <input required type="datetime-local" name="startsAt" />
                </label>
                <label>
                  Duration
                  <select name="duration" defaultValue="60">
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                  </select>
                </label>
                <label>
                  Platform
                  <select name="provider">
                    <option value="daily">BidScope Meet</option>
                    <option value="google_meet" disabled={!result.data?.googleConnected}>
                      {result.data?.googleConnected ? "Google Meet" : "Google Meet — connect Calendar first"}
                    </option>
                  </select>
                </label>
                <label className="wide">
                  Supplier attendees
                  <textarea
                    name="guests"
                    rows={2}
                    placeholder="One or more email addresses"
                  />
                </label>
                <label className="wide">Internal attendees
                  <select name="participants" multiple size={Math.min(5,Math.max(2,team.data?.data.members.length || 2))}>{team.data?.data.members.map(member => <option value={member.user_id} key={member.user_id}>{member.profile?.full_name || member.profile?.email || "Workspace member"}</option>)}</select>
                  <small>Hold Ctrl or Command to select multiple people.</small>
                </label>
                <label>Reminder
                  <select name="reminder" defaultValue="30"><option value="10">10 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select>
                </label>
                <label className="wide">
                  Agenda
                  <textarea name="agenda" rows={4} />
                </label>
                <label className="wide">
                  Interview questions
                  <textarea
                    name="interviewQuestions"
                    rows={5}
                    placeholder="One private panel question per line"
                  />
                </label>
              </div>
              <div className="pw-actions">
                <button
                  type="button"
                  className="pw-button"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button disabled={busy} className="pw-button primary">
                  {busy ? "Scheduling…" : "Schedule and invite"}
                </button>
              </div>
            </section>
          </form>
        </div>
      )}
    </>
  );
}
