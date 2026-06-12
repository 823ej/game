// Simple passthrough service worker for PWA installability.
// Bump the cache version whenever static assets (HUD/UI, styles, scripts) change.
const CACHE_NAME = 'midnight-shell-v4.48';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css?v=10',
  './game.js?v=10',
  './data.js?v=10',
  './dungeon.js?v=10',
  './story.js?v=10',
  './manifest.webmanifest?v=10'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).catch(() => {})
  );
  clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
