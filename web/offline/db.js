(function () {
  'use strict';

  const DB_NAME = 'calda_certa';
  const DB_VERSION = 2;

  const STORES = {
    MIX_DRAFTS_LOCAL: 'mix_drafts_local',
    SIMULATIONS: 'simulations',
    PRODUCTS: 'products',
    USER_LIBRARIES: 'user_libraries',
    SETTINGS: 'settings',
    SYNC_QUEUE: 'sync_queue'
  };

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORES.MIX_DRAFTS_LOCAL)) {
          db.createObjectStore(STORES.MIX_DRAFTS_LOCAL, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.SIMULATIONS)) {
          const store = db.createObjectStore(STORES.SIMULATIONS, { keyPath: 'id' });
          store.createIndex('by_uid', 'uid', { unique: false });
          store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const store = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
          store.createIndex('by_uid', 'uid', { unique: false });
          store.createIndex('by_source', 'source', { unique: false });
          store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.USER_LIBRARIES)) {
          const store = db.createObjectStore(STORES.USER_LIBRARIES, { keyPath: 'id' });
          store.createIndex('by_uid', 'uid', { unique: false });
          store.createIndex('by_type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          store.createIndex('by_synced', 'synced', { unique: false });
          store.createIndex('by_timestamp', 'timestamp', { unique: false });
          store.createIndex('by_fingerprint', 'fingerprint', { unique: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function withStore(store, mode, executor) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const objectStore = tx.objectStore(store);
      const result = executor(objectStore, tx);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    }));
  }

  async function dbPut(store, value) {
    return withStore(store, 'readwrite', (objectStore) => {
      objectStore.put(value);
      return value;
    });
  }

  async function dbGet(store, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const request = tx.objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbDelete(store, key) {
    return withStore(store, 'readwrite', (objectStore) => {
      objectStore.delete(key);
    });
  }

  async function dbList(store) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const request = tx.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveSimulation(simulation) {
    if (!simulation || !simulation.id) return null;
    return dbPut(STORES.SIMULATIONS, {
      ...simulation,
      updatedAt: simulation.updatedAt || new Date().toISOString()
    });
  }

  async function saveSimulations(simulations) {
    if (!Array.isArray(simulations) || simulations.length === 0) return;
    await Promise.all(simulations.map(saveSimulation));
  }

  async function getSimulationsByUser(uid) {
    const all = await dbList(STORES.SIMULATIONS);
    return all.filter((item) => item.uid === uid);
  }

  async function saveProduct(product) {
    if (!product || !product.id) return null;
    return dbPut(STORES.PRODUCTS, {
      ...product,
      updatedAt: product.updatedAt || new Date().toISOString()
    });
  }

  async function saveProducts(products) {
    if (!Array.isArray(products) || products.length === 0) return;
    await Promise.all(products.map(saveProduct));
  }

  async function getProductsByUser(uid) {
    const all = await dbList(STORES.PRODUCTS);
    return all.filter((item) => item.uid === uid || item.source === 'catalogo');
  }

  async function saveSetting(id, value) {
    return dbPut(STORES.SETTINGS, { id, value, updatedAt: new Date().toISOString() });
  }

  async function getSetting(id, fallback = null) {
    const item = await dbGet(STORES.SETTINGS, id);
    return item ? item.value : fallback;
  }

  function buildFingerprint(item) {
    if (!item) return `fp-${Date.now()}`;
    if (item.fingerprint) return item.fingerprint;
    return `${item.type}:${item.path}:${JSON.stringify(item.payload || {})}`;
  }

  async function enqueueSync(item) {
    const queueItem = {
      id: item.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: item.type,
      path: item.path,
      payload: item.payload || {},
      timestamp: item.timestamp || Date.now(),
      synced: false,
      attempts: item.attempts || 0,
      fingerprint: buildFingerprint(item)
    };

    try {
      await dbPut(STORES.SYNC_QUEUE, queueItem);
      return queueItem;
    } catch (error) {
      if (error?.name === 'ConstraintError') {
        return null;
      }
      throw error;
    }
  }

  async function getPendingSyncItems() {
    const all = await dbList(STORES.SYNC_QUEUE);
    return all
      .filter((item) => !item.synced)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  async function markSyncItemDone(id) {
    const item = await dbGet(STORES.SYNC_QUEUE, id);
    if (!item) return;
    await dbPut(STORES.SYNC_QUEUE, { ...item, synced: true, syncedAt: Date.now() });
  }

  async function bumpSyncItemAttempt(id) {
    const item = await dbGet(STORES.SYNC_QUEUE, id);
    if (!item) return;
    await dbPut(STORES.SYNC_QUEUE, { ...item, attempts: (item.attempts || 0) + 1, lastErrorAt: Date.now() });
  }

  window.OfflineDB = {
    DB_NAME,
    DB_VERSION,
    STORES,
    openDb,
    dbPut,
    dbGet,
    dbDelete,
    dbList,
    saveSimulation,
    saveSimulations,
    getSimulationsByUser,
    saveProduct,
    saveProducts,
    getProductsByUser,
    saveSetting,
    getSetting,
    enqueueSync,
    getPendingSyncItems,
    markSyncItemDone,
    bumpSyncItemAttempt
  };
})();
