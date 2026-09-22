/* BidScope only uses this worker for push. It does not cache authenticated pages. */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === "string" ? data.title.slice(0, 100) : "BidScope notification";
  const body = typeof data.body === "string" ? data.body.slice(0, 220) : "An update is waiting in BidScope.";
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") && !data.url.includes("\\") ? data.url : "/notifications";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/brand/icons/icon-192.png",
    badge: "/brand/icons/favicon-48x48.png",
    tag: typeof data.notificationId === "string" ? data.notificationId : undefined,
    data: { url, type: data.type || "account", notificationId: data.notificationId || null, tenderId: data.tenderId || null, bidId: data.bidId || null, meetingId: data.meetingId || null, conversationId: data.conversationId || null },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/notifications";
  const target = new URL(path, self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if ("navigate" in existing) await existing.navigate(target.href);
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});
