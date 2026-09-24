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
    result = useData<{
      data: Meeting[];
      settings: { max_duration_minutes: number } | null;
      googleConnected: boolean;
    }>("/api/meetings"),
    tenders = useData<{ data: ManagedTender[] }>(
      "/api/procurement?resource=tenders",
    ),
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
    if (!procurementTenderId) {
      setMessage("Select a BidScope-managed tender before scheduling this meeting.");
      return;
    }
    if (f.get("provider") === "google_meet" && !result.data?.googleConnected) {
      setMessage("Connect Google Calendar before scheduling a Google Meet.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/meetings", {
        title: f.get("title"),
        startsAt: new Date(String(f.get("startsAt"))).toISOString(),
        durationMinutes: Number(f.get("duration")),
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Accra",
        provider: f.get("provider"),
        meetingType: "tender",
        participantUserIds: [],
        guestEmails: String(f.get("guests") || "")
          .split(/[;,\n]/)
          .map((v) => v.trim())
          .filter(Boolean),
        relatedOpportunityId: null,
        agenda: f.get("agenda") || "",
        reminderMinutes: 30,
        recordingEnabled: false,
        transcriptionEnabled: false,
        waitingRoomEnabled: true,
        procurementTenderId,
        supplierBidId: params.get("bid"),
        supplierOrganizationId: params.get("supplier"),
        tenderLotId: params.get("lot"),
        procurementMeetingType: f.get("procurementMeetingType"),
        interviewQuestions: String(f.get("interviewQuestions") || "")
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
      });
      setMessage(
        "Procurement meeting scheduled and linked to the tender record.",
      );
      setOpen(false);
      invalidate();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
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
            disabled={tenders.loading || !managedTenders.length}
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
        {!tenders.loading && !managedTenders.length && (
          <p className="mt-3">
            Create a BidScope-managed tender before scheduling procurement meetings.
          </p>
        )}
      </div>
      {message && (
        <p className={/scheduled/.test(message) ? "pw-notice" : "pw-error"}>
          {message}
        </p>
      )}
      <section className="pw-card mt-5" id="procurement-calendar">
        <h2>Upcoming procurement events</h2>
        {result.loading ? (
          <p>Loading meetings…</p>
        ) : result.error ? (
          <p className="pw-error">{result.error}</p>
        ) : result.data?.data.filter(
            (m) =>
              m.procurement_tender_id && Date.parse(m.ends_at) > Date.now(),
          ).length ? (
          result.data.data
            .filter(
              (m) =>
                m.procurement_tender_id && Date.parse(m.ends_at) > Date.now(),
            )
            .map((m) => (
              <Link
                className="pw-row"
                href={`/procurement/meetings/${m.id}`}
                key={m.id}
              >
                <span>
                  <strong>{m.title}</strong>
                  <small>
                    {new Date(m.starts_at).toLocaleString("en-GB")} ·{" "}
                    {(
                      m.procurement_meeting_type || "procurement meeting"
                    ).replaceAll("_", " ")}
                  </small>
                </span>
                <Video size={17} />
              </Link>
            ))
        ) : (
          <div className="pw-empty">
            <CalendarDays size={30} />
            <h2>No supplier interviews scheduled</h2>
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
                </label>
                <label className="wide">
                  Title
                  <input required minLength={3} name="title" />
                </label>
                <label>
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
                </label>
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
