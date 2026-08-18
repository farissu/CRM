// Minimal service worker: no caching, no offline fallback. Its only job is to
// satisfy the browser's "has a fetch handler" PWA installability requirement
// so the app is installable on a phone home screen. Conversation data must
// always come from the network — never served stale from a cache here.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
