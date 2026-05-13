/* eslint-disable */
// Simple SW for SPA offline shell.
// Intentionally minimal: caches built assets and falls back to index.html for navigations.

const CACHE_NAME = "survey-constructor-v1";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only same-origin.
  if (url.origin !== self.location.origin) return;

  // SPA navigations: network-first, fallback to cached index.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match("/index.html")) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: cache-first.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      const res = await fetch(req);
      if (res && res.ok && (req.destination === "script" || req.destination === "style" || req.destination === "image" || req.destination === "font")) {
        cache.put(req, res.clone());
      }
      return res;
    })()
  );
});

