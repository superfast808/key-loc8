// keylocate service worker v5 — no caching at all
// Acts purely as a pass-through to the network.
// Eliminates all stale-cache issues that affected production.

const SW_VERSION = 'v5';

self.addEventListener('install', () => {
  // Activate immediately — do not cache anything
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Delete ALL caches from previous versions
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// No fetch handler — all requests go directly to the network
