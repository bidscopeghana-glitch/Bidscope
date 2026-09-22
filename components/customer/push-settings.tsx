"use client";

import { useCallback, useEffect, useState } from "react";

type Device = { id: string; browser: string | null; platform: string | null; enabled: boolean; created_at: string; endpointFingerprint: string };
type PreferenceResponse = { events: Array<{ event_key: string; enabled: boolean }>; channels: Array<{ event_key: string; enabled: boolean }>; availableEvents: string[] };
const groups: Array<[string, string[]]> = [
  ["Tender notifications", ["matching_tender", "public_tender", "private_tender", "tender_deadline", "tender_amendment", "saved_tender_reminder"]],
  ["Supplier notifications", ["bid_submitted", "bid_status", "bid_shortlisted", "bid_accepted", "bid_rejected", "clarification_requested"]],
  ["Buyer and procurement", ["new_bid", "supplier_question", "evaluation_reminder", "procurement_task", "tender_approval"]],
  ["Communication", ["new_message", "team_mention", "meeting_invitation", "meeting_reminder", "meeting_changed", "meeting_cancelled"]],
  ["Account", ["billing", "security", "verification", "account"]],
];
function authHeaders(json = false) {
  const token = localStorage.getItem("bidscope_access_token");
  return { Authorization: `Bearer ${token || ""}`, ...(json ? { "Content-Type": "application/json" } : {}) };
}
function browserStatus() {
  if (typeof window === "undefined") return "loading";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (ios && !standalone) return "ios_install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" ? "granted" : "available";
}
function decodeKey(key: string) {
  const padded = key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - key.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
async function endpointFingerprint(endpoint: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

export function PushSettings() {
  const [status, setStatus] = useState("loading");
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentFingerprint, setCurrentFingerprint] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<PreferenceResponse | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [snoozed, setSnoozed] = useState(false);

  const load = useCallback(async () => {
    setStatus(browserStatus());
    setSnoozed(Number(localStorage.getItem("bidscope_push_snooze_until") || "0") > Date.now());
    const [subscriptionResponse, preferenceResponse] = await Promise.all([
      fetch("/api/push/subscriptions", { headers: authHeaders() }),
      fetch("/api/push/preferences", { headers: authHeaders() }),
    ]);
    if (subscriptionResponse.ok) {
      const result = await subscriptionResponse.json() as { configured: boolean; publicKey: string | null; devices: Device[] };
      setConfigured(result.configured); setPublicKey(result.publicKey); setDevices(result.devices);
    }
    if (preferenceResponse.ok) setPreferences(await preferenceResponse.json() as PreferenceResponse);
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      setCurrentFingerprint(subscription ? await endpointFingerprint(subscription.endpoint) : null);
    }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function enable() {
    if (!configured || !publicKey || busy) return;
    if (browserStatus() === "ios_install") { setStatus("ios_install"); return; }
    setBusy(true); setMessage("");
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") { setStatus(permission === "denied" ? "blocked" : "available"); setMessage("Notifications were not enabled. You can try again whenever you are ready."); return; }
      const registration = await navigator.serviceWorker.register("/bidscope-push-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("This browser did not provide a usable push subscription.");
      const response = await fetch("/api/push/subscriptions", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, browser: navigator.userAgent.slice(0, 120), platform: navigator.platform?.slice(0, 120) || "Browser" }) });
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || "Could not save this device."); }
      localStorage.removeItem("bidscope_push_snooze_until");
      setStatus("granted"); setMessage("Push notifications are enabled on this device.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not enable notifications."); }
    finally { setBusy(false); }
  }

  async function disable(device: Device) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/push/subscriptions", { method: "DELETE", headers: authHeaders(true), body: JSON.stringify({ id: device.id }) });
      if (!response.ok) throw new Error("Could not disable this device.");
      if (device.endpointFingerprint === currentFingerprint) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        await (await registration?.pushManager.getSubscription())?.unsubscribe();
      }
      setMessage("Device disabled."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not disable this device."); }
    finally { setBusy(false); }
  }

  async function savePreference(action: "all" | "event", enabled: boolean, eventKey?: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/push/preferences", { method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ action, enabled, ...(eventKey ? { eventKey } : {}) }) });
      if (!response.ok) throw new Error("Could not save this preference.");
      setMessage("Push preferences saved."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this preference."); }
    finally { setBusy(false); }
  }

  async function sendTest() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/push/test", { method: "POST", headers: authHeaders(true) });
      const result = await response.json() as { acceptedByPushService?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "The test could not be sent.");
      setMessage(result.acceptedByPushService ? "The push service accepted the test. Check your device notification settings if it does not appear." : "The push service did not accept the test.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The test could not be sent."); }
    finally { setBusy(false); }
  }

  const active = devices.some((device) => device.enabled && device.endpointFingerprint === currentFingerprint);
  const allDisabled = preferences?.channels.some((channel) => channel.event_key === "__all__" && !channel.enabled) || false;
  return <section className="cc-editor" aria-label="Push notifications">
    <div className="cc-section-heading"><div><p className="cc-eyebrow">Browser and phone alerts</p><h2>Never miss an opportunity</h2></div><span className="cc-badge positive">{!configured ? "Setup required" : active ? "Enabled on this device" : status === "ios_install" ? "iPhone installation required" : status === "blocked" ? "Browser permission blocked" : status === "unsupported" ? "Unsupported browser" : "Available"}</span></div>
    <p className="cc-quiet">Get alerts when tenders match your business, bids change, messages arrive and deadlines approach. Private details stay inside your signed-in BidScope workspace.</p>
    {message && <p role="status" className="cc-quiet">{message}</p>}
    {status === "ios_install" && <p className="cc-quiet">On iPhone or iPad, tap Share → Add to Home Screen, open BidScope from the new icon, sign in, then enable notifications here.</p>}
    {status === "blocked" && <p className="cc-quiet">Allow notifications for BidScope in your browser and device settings, then return here.</p>}
    {status === "unsupported" && <p className="cc-quiet">This browser does not support Web Push. In-app and email alerts remain available.</p>}
    <div className="flex flex-wrap gap-3 py-4">
      {!active && !snoozed && configured && !["ios_install", "blocked", "unsupported"].includes(status) && <><button type="button" className="cc-button primary" disabled={busy} onClick={() => void enable()}>Enable notifications</button><button type="button" className="cc-button" onClick={() => { localStorage.setItem("bidscope_push_snooze_until", String(Date.now() + 14 * 86400000)); setSnoozed(true); }}>Maybe later</button></>}
      {active && <button type="button" className="cc-button" disabled={busy} onClick={() => { const device = devices.find((item) => item.enabled && item.endpointFingerprint === currentFingerprint); if (device) void disable(device); }}>Turn off on this device</button>}
      {active && <button type="button" className="cc-button primary" disabled={busy} onClick={() => void sendTest()}>Send test notification</button>}
      {configured && <><button type="button" className="cc-button" disabled={busy} onClick={() => void savePreference("all", true)}>Enable all push notifications</button><button type="button" className="cc-button" disabled={busy} onClick={() => void savePreference("all", false)}>Disable push notifications</button></>}
    </div>
    {allDisabled && <p className="cc-quiet">All push categories are currently off.</p>}
    {configured && preferences && <div className="grid gap-5 md:grid-cols-2">{groups.map(([group, keys]) => <div key={group} className="rounded-2xl border border-[#17362d]/10 bg-white p-4"><h3 className="font-semibold text-[#17362d]">{group}</h3><div className="mt-3 grid gap-2">{keys.map((key) => { const enabled = preferences.events.find((item) => item.event_key === key)?.enabled !== false && !allDisabled; return <label key={key} className="flex items-center gap-2 text-sm text-[#36554a]"><input type="checkbox" disabled={busy || allDisabled} checked={enabled} onChange={(event) => void savePreference("event", event.target.checked, key)} />{key.replaceAll("_", " ")}</label>; })}</div></div>)}</div>}
    <div className="mt-6"><h3 className="font-semibold text-[#17362d]">Devices receiving notifications</h3><div className="mt-2 grid gap-2">{devices.filter((device) => device.enabled).length ? devices.filter((device) => device.enabled).map((device) => <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 text-sm"><span>{device.platform || device.browser || "Browser"} {device.endpointFingerprint === currentFingerprint ? "· This device" : "· Another device"}</span><button type="button" disabled={busy} className="font-semibold text-[#116149]" onClick={() => void disable(device)}>Disable</button></div>) : <p className="cc-quiet">No devices are enabled yet.</p>}</div></div>
  </section>;
}
