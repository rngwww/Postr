const BUILD_VERSION = "20260929-v11";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      return self.clients.matchAll({ type: "window" }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({ type: "POSTR_UPDATE_READY", version: BUILD_VERSION });
        });
      });
    })
  );
});

// Always force-reload network for app files, bypassing browser HTTP disk cache completely
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // If navigation (loading index.html) or app code files (js, css, html, json)
  const isAppFile = req.mode === "navigate" ||
                    url.pathname.endsWith(".html") ||
                    url.pathname.endsWith(".js") ||
                    url.pathname.endsWith(".css") ||
                    url.pathname.endsWith(".json");

  if (isAppFile && req.method === "GET") {
    event.respondWith(
      fetch(new Request(req, { cache: "reload" }))
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

self.addEventListener("message", (event) => {
  if (event.data && (event.data.type === "SKIP_WAITING" || event.data.type === "FORCE_UPDATE")) {
    self.skipWaiting();
  }
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
