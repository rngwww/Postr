self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "TRIGGER_NOTIFICATION") {
    const { title, body, tag, icon, badge } = event.data;
    self.registration.showNotification(title, {
      body: body,
      icon: icon || "icon.svg",
      badge: badge || "icon.svg",
      tag: tag || "postr_ping",
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200]
    });
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow("./index.html");
    })
  );
});
