// Atlas PWA shell — network-first SW. Backend API calls bypass cache.
const CACHE_NAME = "atlas-shell-v33";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./design/bmh-design.css?v=1",
  "./static/companion-icon-32.png",
  "./static/companion-icon-192.png",
  "./static/companion-icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) =>
      Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "no-cache" })).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Cross-origin (Mac backend) — never touch cache, never intercept
  if (url.origin !== location.origin) return;
  // Same-origin shell — network-first, fall back to cache when offline
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match("./")))
  );
});

// ── Web Push: display incoming reminders ─────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Atlas", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Atlas";
  const options = {
    body: data.body || "",
    icon: data.icon || "./static/companion-icon-192.png",
    badge: data.badge || "./static/companion-icon-192.png",
    tag: data.tag || "atlas",
    requireInteraction: !!data.requireInteraction,
    data: { url: data.url || "./", approval: data.approval || null },
  };
  // Approval pushes carry Approve/Deny action buttons (on Android they sit
  // under the notification's expand chevron).
  if (data.kind === "approval" && Array.isArray(data.actions)) {
    options.actions = data.actions;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification tap: answer an approval, or focus/open the Atlas PWA ────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const approval = d.approval;

  // Approve/Deny button tap → POST the decision straight from the SW.
  // The payload carries the callback URL + a single-use token for this
  // approval only — no stored credentials involved.
  if (approval && (event.action === "approve" || event.action === "deny")) {
    const decision = event.action;
    const note = (title, body) =>
      self.registration.showNotification(title, {
        body: body,
        tag: event.notification.tag,
        icon: "./static/companion-icon-192.png",
        badge: "./static/companion-icon-192.png",
      });
    event.waitUntil(
      fetch(approval.decide_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: decision, token: approval.token }),
      })
        .then(async (r) => {
          if (r.ok) {
            return note(decision === "approve" ? "Approved ✓" : "Denied ✗",
                        "The session has its answer.");
          }
          // 409 = the approval was already settled — on this or another device,
          // or it expired. The body carries the real status; say so truthfully
          // instead of blaming the network.
          if (r.status === 409) {
            let s = "";
            try { s = (await r.json()).status || ""; } catch (e) { /* ignore */ }
            if (s === "expired") {
              return note("Too late — expired",
                          "This approval lapsed; the session fell back to a terminal prompt.");
            }
            return note("Already " + (s || "decided"),
                        "This approval was already answered on another device.");
          }
          // 401 = token rejected (shouldn't happen from a real push); other
          // non-OK = Atlas reachable but erroring.
          return note("Couldn't send decision",
                      "Atlas is reachable but rejected it — open the Atlas app to decide.");
        })
        .catch(() =>
          // True network failure — this is the only case that is actually
          // "check your connection".
          note("Couldn't reach Atlas",
               "No route to base — check Tailscale is up, then decide from the Atlas app.")
        )
    );
    return;
  }

  // Plain tap → focus or open the app.
  const url = d.url || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes(self.registration.scope) && "focus" in c) {
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
