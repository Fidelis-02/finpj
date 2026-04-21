const CACHE_NAME = 'finpj-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/favicon.svg',
  '/logo.svg',
  '/manifest.json',
  '/tax/tables.js',
  '/tax/utils.js',
  '/tax/regimes/simplesNacional.js',
  '/tax/regimes/lucroPresumido.js',
  '/tax/regimes/lucroReal.js',
  '/tax/index.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});
