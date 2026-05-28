// ClearCRM Service Worker
const CACHE = "clearcrm-v1";

// Assets to cache immediately on install
const PRECACHE = [
  "/",
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/apple-touch-icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never intercept Firebase, Stripe, API, or non-GET requests
  if (
    e.request.method !== "GET" ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("stripe") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Navigation requests — serve index.html (SPA fallback)
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match("/").then((r) => r || fetch(e.request))
      )
    );
    return;
  }

  // Static assets — cache-first
  e.respondWith(
    caches.match(e.request).then(
      (cached) => cached || fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
