// Minimal service worker required for PWA installability in Chrome
const CACHE_NAME = "conceptmachine-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass through all requests — no caching strategy needed
  event.respondWith(fetch(event.request));
});
