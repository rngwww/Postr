self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "TRIGGER_NOTIFICATION") {
    const { title, body, tag, icon, badge, data, actions } = event.data;
    self.registration.showNotification(title, {
      body: body,
      icon: icon || "icon.svg",
      badge: badge || "icon.svg",
      tag: tag || "postr_ping",
      renotify: true,
      requireInteraction: true,
      data: data || {},
      actions: actions || []
    });
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const action = e.action;
  const data = e.notification.data || {};

  if (action === "snooze_15" || action === "mark_done") {
    e.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        if (clientList.length > 0) {
          clientList[0].postMessage({
            type: action === "snooze_15" ? "NOTIFICATION_ACTION_SNOOZE" : "NOTIFICATION_ACTION_DONE",
            reminderId: data.reminderId
          });
        }
      })
    );
    return;
  }

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        clientList[0].focus();
        if (data.reminderId) {
          clientList[0].postMessage({
            type: "NOTIFICATION_CLICK_OPEN",
            reminderId: data.reminderId
          });
        }
        return;
      }
      return clients.openWindow("./index.html");
    })
  );
});
