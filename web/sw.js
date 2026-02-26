// ATENÇÃO: Incrementar CACHE_VERSION a cada deploy, junto com BUILD_NUMBER em app.js
const CACHE_VERSION = 5; // ← INCREMENTAR A CADA DEPLOY
const CACHE_NAME = `calda-certa-v${CACHE_VERSION}`;
const APP_SHELL = '/index.html';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/offline.html',
  '/app.js',
  '/api-config.js',
  '/firebase-config.js',
  '/productsService.js',
  '/utils.js',
  '/displayPdf.js',
  '/offline/autosave.js',
  '/offline/db.js',
  '/styles.css',
  '/navbar-clean.css',
  '/layout-integration.css',
  '/manifest.json',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/logo-caldacerta.png',
  '/icons/logo-caldacerta.jpg',
  '/icons/logo-wordmark.png',
  '/historico/lista.html'
];

function isFirebaseCdnRequest(url) {
  return url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
}

function isFirebaseOrGoogleApiRequest(url) {
  return url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('googleapis.com');
}

function isStaticCdnRequest(url) {
  const staticHosts = [
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ];
  return staticHosts.includes(url.hostname);
}

async function cacheFirstWithFallback(request, fallbackPath = APP_SHELL) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const fallback = await caches.match(fallbackPath);
    if (fallback) return fallback;
    throw error;
  }
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
    if (cachedResponse) return cachedResponse;

    const shell = await caches.match(APP_SHELL);
    if (shell) return shell;
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

  if (isFirebaseCdnRequest(url) || isStaticCdnRequest(url)) {
    event.respondWith(cacheFirstWithFallback(request));
    return;
  }

  if (isFirebaseOrGoogleApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(cacheFirstWithFallback(request, APP_SHELL));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstWithFallback(request));
  }
});
