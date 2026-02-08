// CaldaCerta - Service Worker v1
const CACHE_NAME = "caldacerta-v1";

// Arquivos locais essenciais
const LOCAL_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/styles.css",
  "/firebase-config.js",
  "/api-config.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offline.html"
];

// CDN externos que devem ser cacheados na instalação
const CDN_ASSETS = [
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
];

// ============================================
// INSTALL: cachear tudo na primeira visita
// ============================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cachear arquivos locais (obrigatório)
      await cache.addAll(LOCAL_ASSETS);

      // Cachear CDN (melhor esforço - não bloqueia install se falhar)
      for (const url of CDN_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("[SW] Falha ao cachear CDN:", url, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// ============================================
// ACTIVATE: limpar caches antigos
// ============================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null))
      )
    )
  );
  self.clients.claim();
});

// ============================================
// FETCH: estratégias de cache
// ============================================
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorar requisições que não são GET
  if (req.method !== "GET") return;

  // Ignorar chamadas ao Firebase Auth / Realtime Database
  if (
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("identitytoolkit")
  ) {
    return;
  }

  // Ignorar chamadas à API do servidor (/api/)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Ignorar chamadas a APIs externas (INMET, Open-Meteo)
  if (
    url.hostname.includes("inmet.gov.br") ||
    url.hostname.includes("open-meteo.com")
  ) {
    return;
  }

  // ----- Navegação (HTML): Network-first com fallback -----
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((r) => r || caches.match("/offline.html"))
        )
    );
    return;
  }

  // ----- CDN e assets: Cache-first com atualização em background -----
  event.respondWith(
    caches.match(req).then((cached) => {
      // Atualiza em background (stale-while-revalidate)
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// ============================================
// SYNC: processar fila de dados pendentes
// ============================================
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-simulacoes") {
    event.waitUntil(syncPendingSimulations());
  }
});

async function syncPendingSimulations() {
  // Abre IndexedDB para ler fila pendente
  const db = await openSyncDB();
  const tx = db.transaction("pending-sync", "readwrite");
  const store = tx.objectStore("pending-sync");
  const allItems = await idbGetAll(store);

  for (const item of allItems) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body
      });
      if (res.ok) {
        const delTx = db.transaction("pending-sync", "readwrite");
        delTx.objectStore("pending-sync").delete(item.id);
        await idbComplete(delTx);
      }
    } catch (err) {
      console.warn("[SW] Sync failed for item:", item.id, err);
      // Será tentado novamente na próxima sync
    }
  }
}

// Helpers IndexedDB para o SW
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("caldacerta-sync", 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("pending-sync")) {
        db.createObjectStore("pending-sync", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
