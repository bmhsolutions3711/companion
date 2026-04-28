// Voice Companion PWA shell — network-first SW. Backend API calls bypass cache.
const CACHE_NAME = "comp-shell-v5";
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
