const CACHE_NAME = 'calda-certa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/app.js',
  '/api-config.js',
  '/firebase-config.js',
  '/productsService.js',
  '/utils.js',
  '/offline/autosave.js',
  '/offline/db.js',
  '/styles.css',
  '/navbar-clean.css',
  '/layout-integration.css',
  '/manifest.json',
  '/manifest.webmanifest'
];

const LOCAL_ASSET_PATHS = new Set(ASSETS_TO_CACHE);

function isFirebaseOrGoogleApiRequest(url) {
  return url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('googleapis.com');
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (isFirebaseOrGoogleApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  if (isSameOrigin && (LOCAL_ASSET_PATHS.has(url.pathname) || request.mode === 'navigate')) {
    event.respondWith(cacheFirst(request));
  }
});
