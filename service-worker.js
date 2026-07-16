// App-shell precache (small, load-bearing files) + runtime cache-on-fetch
// for everything else (GameAssets/Assets are large and change per mission,
// so they're cached lazily as the player actually encounters them instead
// of being precached upfront).
const CACHE_NAME = 'space-shooter-v1';
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
