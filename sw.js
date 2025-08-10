// Simple service worker for offline app shell
const CACHE = 'lyrics-pwa-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (ASSETS.includes(url.pathname.replace(/.*\//,'')) || ASSETS.includes(url.pathname.replace(/.*\//,'./'))) {
    event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
  }
});
