/* Service worker: caches the app shell so the app works offline.
   Bump CACHE when you change any file, so phones pick up the new version. */
const CACHE = 'keepers-voyage-v2-tunes';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './assets/char_ready.png',
  './assets/char_save.png',
  './assets/char_win.png',
  './assets/char_bounce.png',
  './assets/char_fishing.png',
  './assets/char_study.png',
  './assets/char_calm.png',
  './assets/crest.png',
  './assets/chest.png',
  './assets/wheel.png',
  './assets/method_rig.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle our own files. External links (YouTube, iPlayer) go straight to the network.
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
    })
  );
});
