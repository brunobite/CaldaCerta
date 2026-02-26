/* global firebase */
(() => {
  const DEFAULT_LIMIT = 50;
  const MIN_WORD_LENGTH = 2;
  const DEFAULT_CONCURRENCY = 10;

  const offlineDb = window.OfflineDB;

  async function cacheProducts(products) {
    if (!offlineDb || !Array.isArray(products) || products.length === 0) return;
    try {
      await offlineDb.saveProducts(products);
    } catch (error) {
      console.warn('[productsService] Falha ao salvar cache local:', error);
    }
  }

  async function getOfflineProducts(uid) {
    if (!offlineDb) return [];
    try {
      return await offlineDb.getProductsByUser(uid);
    } catch (error) {
      console.warn('[productsService] Falha ao ler cache local:', error);
      return [];
    }
  }

  // --- helpers base (assumidos no app) ---
  function getDatabase() {
    const database = window.database || (firebase && firebase.database && firebase.database());
    if (!database) throw new Error('Realtime Database indisponível (window.database/fb).');
    return database;
  }


  function logCatalogSource(source, meta = {}) {
    const details = Object.entries(meta)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');
    console.info(`[productsService] catalog source: ${source}${details ? ` ${details}` : ''}`);
  }

  function getCurrentUser() {
    const user = window.currentUser || (firebase && firebase.auth && firebase.auth().currentUser);
    if (!user) throw new Error('Usuário não autenticado.');
    return user;
  }

  function normalizeTexto(valor) {
    return (valor || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeKey(valor) {
    return (valor || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parsePhFispq(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const s = String(value).trim();
    if (!s) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function assertTipoProduto(tipo) {
    const v = (tipo || '').toString().trim();
    return v || 'Não informado';
  }

  function buildProdutoPayload(produto, user) {
    const nomeComercial = (produto?.nomeComercial || produto?.nome || '').toString().trim();
    const empresa = (produto?.empresa || produto?.marca || '').toString().trim();
    const tipoProduto = assertTipoProduto(produto?.tipoProduto);
    const phFispq = parsePhFispq(produto?.phFispq);
    const urlFispq = (produto?.urlFispq || '').toString().trim();

    return {
      nomeComercial,
      empresa,
      tipoProduto,
      phFispq,
      urlFispq,
      nome_key: normalizeKey(nomeComercial),
      createdAt: Date.now(),
      createdBy: user?.uid || 'system',
      createdByEmail: user?.email || 'system@caldacerta.com'
    };
  }

  function getUserCatalogoRef(database, user) {
    return database.ref(`produtos_usuarios/${user.uid}`);
  }

  function getCatalogoGlobalRef(database) {
    return database.ref('produtos_catalogo');
  }

  // --- concurrency helper ---
  async function mapWithConcurrency(items, mapper, { concurrency = DEFAULT_CONCURRENCY } = {}) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      // eslint-disable-next-line no-await-in-loop
      const chunkResults = await Promise.all(chunk.map(mapper));
      results.push(...chunkResults);
    }
    return results;
  }

  async function readMapAtPath(path) {
    const snapshot = await getDatabase().ref(path).once('value');
    return snapshot.val() || {};
  }

  async function fetchProdutosByIds(ids, { source, uid }) {
    if (!ids || ids.length === 0) return [];

    return mapWithConcurrency(ids, async (id) => {
      const basePath =
        source === 'catalogo'
          ? `produtos_catalogo/${id}`
          : `produtos_usuarios/${uid}/${id}`;

      const value = await readMapAtPath(basePath);
      if (!value || typeof value !== 'object') return null;

      return { id, ...value, source };
    });
  }

  // =========================================================
  // BUSCA NOVA (ÍNDICE POR PALAVRAS COMPLETAS)
  // - catálogo: produtos_catalogo_busca/{palavra}/{id}=true
  // - usuário:  produtos_usuarios_busca/{uid}/{palavra}/{id}=true (se existir)
  // =========================================================
  function extractWords(term) {
    const key = normalizeKey(term);
    if (!key) return [];
    const words = key.split(' ').filter(Boolean);
    const filtered = words.filter((w) => w.length >= MIN_WORD_LENGTH);
    return [...new Set(filtered)];
  }

  function intersectSets(sets) {
    if (!sets.length) return new Set();
    let acc = sets[0];
    for (let i = 1; i < sets.length; i += 1) {
      acc = new Set([...acc].filter((id) => sets[i].has(id)));
      if (acc.size === 0) return acc;
    }
    return acc;
  }

  async function searchByWordIndex(term, { limit = DEFAULT_LIMIT } = {}) {
    const words = extractWords(term);
    if (words.length === 0) return [];

    const user = getCurrentUser();
    if (!navigator.onLine) {
      logCatalogSource('local-cache', { reason: 'offline-search', uid: user.uid });
      const local = await getOfflineProducts(user.uid);
      return local.filter((produto) => {
        const hay = normalizeKey(`${produto.nomeComercial || produto.nome || ''} ${produto.empresa || ''} ${produto.tipoProduto || ''}`);
        return words.every((w) => hay.includes(w));
      }).slice(0, limit);
    }

    const database = getDatabase();

    // 1) lê índices por palavra (catálogo + usuário)
    let catalogoSnaps;
    let usuarioSnaps;
    try {
      [catalogoSnaps, usuarioSnaps] = await Promise.all([
        Promise.all(words.map((w) => database.ref(`produtos_catalogo_busca/${w}`).once('value'))),
        Promise.all(words.map((w) => database.ref(`produtos_usuarios_busca/${user.uid}/${w}`).once('value'))),
      ]);
      logCatalogSource('remote', { reason: 'online-search', uid: user.uid });
    } catch (error) {
      console.warn('[productsService] Falha na busca remota, usando cache local:', error);
      logCatalogSource('local-cache', { reason: 'remote-search-failed', uid: user.uid });
      const local = await getOfflineProducts(user.uid);
      return local.filter((produto) => {
        const hay = normalizeKey(`${produto.nomeComercial || produto.nome || ''} ${produto.empresa || ''} ${produto.tipoProduto || ''}`);
        return words.every((w) => hay.includes(w));
      }).slice(0, limit);
    }

    const catalogoSets = catalogoSnaps.map((s) => new Set(Object.keys(s.val() || {})));
    const usuarioSets = usuarioSnaps.map((s) => new Set(Object.keys(s.val() || {})));

    // Se catálogo não tem nada para alguma palavra, já é vazio.
    if (catalogoSets.some((set) => set.size === 0) && usuarioSets.every((set) => set.size === 0)) {
      return [];
    }

    const catalogoIds = [...intersectSets(catalogoSets)];
    const usuarioIds = [...intersectSets(usuarioSets)];

    // 2) busca detalhes
    const [catalogoProdutos, usuarioProdutos] = await Promise.all([
      fetchProdutosByIds(catalogoIds.slice(0, limit), { source: 'catalogo' }),
      fetchProdutosByIds(usuarioIds.slice(0, limit), { source: 'usuario', uid: user.uid }),
    ]);

    // 3) mescla priorizando usuário
    const combined = [...usuarioProdutos, ...catalogoProdutos].filter(Boolean);

    // 4) filtro extra (garante que palavras aparecem no texto)
    const filtered = combined.filter((produto) => {
      const hay = normalizeKey(`${produto.nomeComercial || produto.nome || ''} ${produto.empresa || ''} ${produto.tipoProduto || ''}`);
      return words.every((w) => hay.includes(w));
    });

    // 5) dedup
    const seen = new Set();
    const dedup = [];
    for (const p of filtered) {
      const k = `${p.source}:${p.id}`;
      if (!seen.has(k)) {
        seen.add(k);
        dedup.push(p);
      }
      if (dedup.length >= limit) break;
    }

    return dedup;
  }

  // --- API pública (compatível) ---
  async function saveUserProdutoRTDB(produto) {
    const user = getCurrentUser();
    const database = getDatabase();
    const payload = buildProdutoPayload(produto, user);
    const ref = database.ref(`produtos_usuarios/${user.uid}`).push();
    const result = { id: ref.key, uid: user.uid, ...payload, source: 'usuario' };

    if (!navigator.onLine) {
      await cacheProducts([result]);
      await offlineDb?.enqueueSync({
        type: 'create',
        path: `produtos_usuarios/${user.uid}/${ref.key}`,
        payload: result
      });
      return result;
    }

    await ref.set(payload);
    await cacheProducts([result]);
    return result;
  }

  async function saveGlobalProdutoRTDB(produto) {
    const user = getCurrentUser();
    const database = getDatabase();
    const payload = buildProdutoPayload(produto, user);
    const ref = getCatalogoGlobalRef(database).push();
    await ref.set(payload);
    return { id: ref.key, ...payload, source: 'catalogo' };
  }

  async function listUserProdutos({ limit = DEFAULT_LIMIT } = {}) {
    const user = getCurrentUser();

    if (!navigator.onLine) {
      logCatalogSource('local-cache', { reason: 'offline-user-list', uid: user.uid });
      const local = await getOfflineProducts(user.uid);
      return local.filter((p) => p.source === 'usuario').slice(0, limit);
    }

    const database = getDatabase();
    const snapshot = await database
      .ref(`produtos_usuarios/${user.uid}`)
      .orderByChild('createdAt')
      .limitToLast(limit)
      .once('value');
    const data = snapshot.val() || {};
    const items = Object.entries(data).map(([id, produto]) => ({ id, uid: user.uid, ...produto, source: 'usuario' }));
    logCatalogSource('user-library', { reason: 'online-user-list', uid: user.uid, count: items.length });
    await cacheProducts(items);
    return items;
  }

  async function listCatalogoProdutos({ limit = DEFAULT_LIMIT } = {}) {
    const user = getCurrentUser();

    if (!navigator.onLine) {
      logCatalogSource('local-cache', { reason: 'offline-catalog-list', uid: user.uid });
      const local = await getOfflineProducts(user.uid);
      return local.filter((p) => p.source === 'catalogo').slice(0, limit);
    }

    const database = getDatabase();
    const snapshot = await database
      .ref('produtos_catalogo')
      .orderByChild('createdAt')
      .limitToLast(limit)
      .once('value');
    const data = snapshot.val() || {};
    const items = Object.entries(data).map(([id, produto]) => ({ id, uid: user.uid, ...produto, source: 'catalogo' }));
    logCatalogSource('remote', { reason: 'online-catalog-list', uid: user.uid, count: items.length });
    await cacheProducts(items);
    return items;
  }

  // Mantemos nomes esperados pela main, mas apontando pra busca nova
  async function searchByMultipleTokens(termo, { limit = DEFAULT_LIMIT } = {}) {
    return searchByWordIndex(termo, { limit });
  }

  async function searchByTokenIndex(termo, { limit = DEFAULT_LIMIT } = {}) {
    return searchByWordIndex(termo, { limit });
  }

  async function searchUserProdutosByTerm(termo, { limit = DEFAULT_LIMIT } = {}) {
    return searchByWordIndex(termo, { limit });
  }

  async function searchCatalogoProdutosByTerm(termo, { limit = DEFAULT_LIMIT } = {}) {
    return searchByWordIndex(termo, { limit });
  }

  function subscribeUserProdutos(callback, { limit = DEFAULT_LIMIT } = {}) {
    if (typeof callback !== 'function') {
      throw new Error('Callback obrigatório para subscribeUserProdutos');
    }

    const user = getCurrentUser();
    const database = getDatabase();
    const query = getUserCatalogoRef(database, user)
      .orderByChild('createdAt')
      .limitToLast(limit);

    const onValue = (snapshot) => {
      const data = snapshot.val() || {};
      const produtos = Object.entries(data).map(([id, produto]) => ({
        id,
        ...produto,
        source: 'usuario'
      }));
      callback(produtos);
    };

    query.on('value', onValue);

    return () => query.off('value', onValue);
  }

  window.productsService = {
    normalizeTexto,
    normalizeKey,
    parsePhFispq,
    searchByMultipleTokens,
    saveUserProdutoRTDB,
    saveGlobalProdutoRTDB,
    listUserProdutos,
    listCatalogoProdutos,
    searchByTokenIndex,
    searchUserProdutosByTerm,
    searchCatalogoProdutosByTerm,
    subscribeUserProdutos
  };
})();
