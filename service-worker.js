// App-shell precache (small, load-bearing files) + runtime cache-on-fetch
// for everything else (GameAssets/Assets are large and change per mission,
// so they're cached lazily as the player actually encounters them instead
// of being precached upfront).
// Bump this whenever the cache strategy itself changes (like this v2 bump)
// so activate() flushes anything stuck under the old name.
const CACHE_NAME = 'space-shooter-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './src/main.js',
  './src/config.js',
  './src/vendor/phaser.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Network-first, falling back to cache only when the network fetch itself
// fails (actually offline) -- a cache-first strategy here meant every code
// change kept serving the stale cached copy indefinitely, since nothing
// short of a hard refresh (which bypasses the SW entirely) or a CACHE_NAME
// bump would ever re-fetch it. This still gives full offline play (the
// fallback), it just no longer wins over a live, reachable server.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
