/* ReGain service worker. The build script injects the version hash and the precache list. */
const VERSION = '__VERSION__';
const CACHE = `regain-${VERSION}`;
const ASSETS = __ASSETS__;

self.addEventListener('install', (event) => {
  // Precache the whole app shell so it opens offline. `cache: 'reload'` bypasses the HTTP cache.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('regain-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: serve the precached shell of THIS version (offline-safe, and never mixes
  // a new index.html with old cached modules). New versions arrive via a new sw.js.
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((cached) => cached || fetch(req)));
    return;
  }

  // Static assets: cache-first (versioned cache), fall back to network.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
