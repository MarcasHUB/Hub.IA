const VERSION = 'supplyhub-pwa-v3';

// The App Campo is installable, but application bundles are intentionally
// network-only. Vite filenames are content-hashed and must never fall back to
// cached HTML after a deployment.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('supplyhub-pwa-'))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Keep a fetch handler so the installed PWA remains controlled, but never
// cache or replace JS/CSS/assets with the SPA HTML shell.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(fetch(event.request));
});
