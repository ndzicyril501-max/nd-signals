// Handles Web Push for the desktop PWA. Entirely separate from the mobile
// app's Expo push flow -- expo-notifications doesn't run in a service
// worker at all, so this is hand-authored against the standard Push API.

self.addEventListener("push", (event) => {
  let payload = { title: "ND Signals", body: "New signal", signal_id: null };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    // Non-JSON push payload -- fall back to the defaults above rather than
    // dropping the notification entirely.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      data: { signal_id: payload.signal_id },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const signalId = event.notification.data && event.notification.data.signal_id;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => "focus" in c);

      if (existing) {
        await existing.focus();
        if (signalId != null) {
          existing.postMessage({ type: "nd-signal-notification-click", signal_id: signalId });
        }
        return;
      }

      // No window open yet -- launch one straight to the signal via a query
      // param the app reads on startup (see notificationListener.ts).
      const url = signalId != null ? `./?signal=${signalId}` : "./";
      await self.clients.openWindow(url);
    })()
  );
});
