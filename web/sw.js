const STATIC_CACHE = 'caldacerta-static-v1';
const DATA_CACHE = 'caldacerta-data-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/utils.js',
  '/api-config.js',
  '/firebase-config.js',
  '/productsService.js',
  '/offline/db.js',
  '/offline/autosave.js',
  '/styles.css',
  '/navbar-clean.css',
  '/layout-integration.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/logo-wordmark.png'
];

function isFirebaseRequest(url) {
  return (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('identitytoolkit')
  );
}

function isApiRequest(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/api/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ offline: true, message: 'Sem conexão no momento.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isFirebaseRequest(url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          if (cached) return cached;
          return Response.error();
        })
    );
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  const isSameOriginAsset = url.origin === self.location.origin;
  if (isSameOriginAsset) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
