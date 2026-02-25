// Versão: 4
// Stores obrigatórias:
//   mix_drafts_local     keyPath:"mixId"  indices: kind, status, updatedAt
//   mix_items_local      keyPath:[mixId,itemId]  índice: mixId
//   mix_index_local      keyPath:"mixId"  índices: clienteNome, dataAplicacao, kind
//   mix_agua_local       keyPath:"mixId"  (NOVA — Etapa 3)
//   outbox_local         keyPath:"id" autoIncrement  índices: status, createdAt
//   products_local       keyPath:"prodId"  índice: nome_key
//   meteo_cache_local    keyPath:[lat,lon,date]
//   clientes_local       keyPath:"clienteId"

const DB_NAME = 'calda_certa';
const DB_VERSION = 4;

let dbPromise;
let openDBPromise;

function createStoreIfMissing(db, name, options) {
  if (!db.objectStoreNames.contains(name)) {
    return db.createObjectStore(name, options);
  }
  return null;
}

function createIndexIfMissing(store, name, keyPath, options) {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath, options);
  }
}

function ensureDraftIndices(store) {
  createIndexIfMissing(store, 'kind', 'kind');
  createIndexIfMissing(store, 'status', 'status');
  createIndexIfMissing(store, 'updatedAt', 'updatedAt');
}

async function migrateLegacyDraftStoreIfNeeded(db, transaction) {
  if (!db.objectStoreNames.contains('mix_drafts_local')) {
    return;
  }

  const drafts = transaction.objectStore('mix_drafts_local');

  if (drafts.keyPath !== 'id') {
    ensureDraftIndices(drafts);
    return;
  }

  const legacyDrafts = await drafts.getAll();

  db.deleteObjectStore('mix_drafts_local');

  const migratedDrafts = db.createObjectStore('mix_drafts_local', { keyPath: 'mixId' });
  ensureDraftIndices(migratedDrafts);

  for (const draft of legacyDrafts) {
    const mixId = draft?.mixId ?? draft?.id;
    if (!mixId) {
      continue;
    }

    const next = { ...draft, mixId };
    delete next.id;
    await migratedDrafts.put(next);
  }
}

async function resolveOpenDB() {
  if (openDBPromise) {
    return openDBPromise;
  }

  openDBPromise = (async () => {
    if (typeof window !== 'undefined' && window.idb && typeof window.idb.openDB === 'function') {
      return window.idb.openDB;
    }

    try {
      const idbModule = await import('idb');
      if (idbModule && typeof idbModule.openDB === 'function') {
        return idbModule.openDB;
      }
    } catch (_) {
      // noop: fallback below with explicit error
    }

    throw new Error(
      'idb indisponível. Use o módulo "idb" ou carregue o CDN UMD: ' +
      'https://cdn.jsdelivr.net/npm/idb@8/build/umd.js'
    );
  })();

  return openDBPromise;
}

export async function getDb() {
  if (dbPromise) {
    return dbPromise;
  }

  const openDB = await resolveOpenDB();

  dbPromise = openDB(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, transaction) {
      switch (oldVersion) {
        case 0: {
          const drafts = createStoreIfMissing(db, 'mix_drafts_local', { keyPath: 'mixId' });
          if (drafts) {
            ensureDraftIndices(drafts);
          }

          const items = createStoreIfMissing(db, 'mix_items_local', { keyPath: ['mixId', 'itemId'] });
          if (items) {
            createIndexIfMissing(items, 'mixId', 'mixId');
          }

          const mixIndex = createStoreIfMissing(db, 'mix_index_local', { keyPath: 'mixId' });
          if (mixIndex) {
            createIndexIfMissing(mixIndex, 'clienteNome', 'clienteNome');
            createIndexIfMissing(mixIndex, 'dataAplicacao', 'dataAplicacao');
            createIndexIfMissing(mixIndex, 'kind', 'kind');
          }
        }
        // falls through
        case 1: {
          await migrateLegacyDraftStoreIfNeeded(db, transaction);

          const outbox = createStoreIfMissing(db, 'outbox_local', {
            keyPath: 'id',
            autoIncrement: true
          });
          if (outbox) {
            createIndexIfMissing(outbox, 'status', 'status');
            createIndexIfMissing(outbox, 'createdAt', 'createdAt');
          }

          const products = createStoreIfMissing(db, 'products_local', { keyPath: 'prodId' });
          if (products) {
            createIndexIfMissing(products, 'nome_key', 'nome_key');
          }
        }
        // falls through
        case 2: {
          createStoreIfMissing(db, 'meteo_cache_local', { keyPath: ['lat', 'lon', 'date'] });
          createStoreIfMissing(db, 'clientes_local', { keyPath: 'clienteId' });
        }
        // falls through
        case 3: {
          createStoreIfMissing(db, 'mix_agua_local', { keyPath: 'mixId' });
          break;
        }
        default:
          break;
      }
    }
  });

  return dbPromise;
}

export async function saveDraft(mixId, sectionKey, data) {
  const db = await getDb();
  const existing = (await db.get('mix_drafts_local', mixId)) || { mixId, sections: {} };
  const sections = { ...(existing.sections || {}) };
  sections[sectionKey] = data;

  const next = {
    ...existing,
    mixId,
    sections,
    updatedAt: new Date().toISOString()
  };

  if (sectionKey === 'kind' || sectionKey === 'status') {
    next[sectionKey] = data;
  }

  await db.put('mix_drafts_local', next);
  return next;
}

export async function loadDraft(mixId) {
  const db = await getDb();
  return (await db.get('mix_drafts_local', mixId)) || null;
}

export async function loadSection(mixId, sectionKey) {
  const draft = await loadDraft(mixId);
  if (!draft || !draft.sections) {
    return null;
  }
  return draft.sections[sectionKey] ?? null;
}

export async function saveAguaQualidade(mixId, data) {
  const db = await getDb();
  const payload = {
    mixId,
    ...(data || {}),
    updatedAt: new Date().toISOString()
  };
  await db.put('mix_agua_local', payload);
  return payload;
}

export async function loadAguaQualidade(mixId) {
  const db = await getDb();
  return (await db.get('mix_agua_local', mixId)) || null;
}
