/* ============================================================
   CaldaCerta - app.js (busca abrangente por tokens no RTDB)
   ============================================================
   O que este app.js entrega:
   - productsService com:
     - normalizeTexto / normalizeKey
     - tokenize() e buildSearchTokens()
     - saveGlobalProdutoRTDB / saveUserProdutoRTDB (atualiza índice invertido)
     - searchCatalogoProdutosByTerm / searchUserProdutosByTerm (por tokens)
   - Mantém compatibilidade com seu UI que chama:
     window.productsService.searchUserProdutosByTerm(...)
     window.productsService.searchCatalogoProdutosByTerm(...)
     window.productsService.saveUserProdutoRTDB(...)
     window.productsService.saveGlobalProdutoRTDB(...)
*/

(function () {
  'use strict';

  // =========================
  // Helpers de normalização
  // =========================
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

  // =========================
  // Tokenização (busca ampla)
  // =========================
  const STOPWORDS = new Set([
    'de','da','do','das','dos','e','em','para','por','com','sem',
    'a','o','as','os','um','uma','uns','umas',
    'lt','l','kg','g','ml','sc','sl','ec','wp','wg','gr','cs',
    'nao','não','informado','n','nd'
  ]);

  function tokenize(text) {
    const base = normalizeKey(text);
    if (!base) return [];

    const parts = base.split(' ').filter(Boolean);

    // Regras extras: quebrar "24d" em ["24d","24","d"] etc (ajustável)
    const tokens = [];
    for (const p of parts) {
      if (!p) continue;
      if (STOPWORDS.has(p)) continue;

      tokens.push(p);

      // quebra alfanumérica (ex: "24d" -> "24", "d")
      const alpha = p.replace(/[0-9]/g, '');
      const nums = p.replace(/[^0-9]/g, '');
      if (nums && nums.length >= 1) tokens.push(nums);
      if (alpha && alpha.length >= 1) tokens.push(alpha);
    }

    // remover duplicados e tokens muito curtos
    const unique = Array.from(new Set(tokens))
      .filter(t => t.length >= 2 || /^[0-9]+$/.test(t)); // aceita números puros

    return unique.slice(0, 10); // evita “explodir” tokens (ajustável)
  }

  function buildSearchTokens(produto) {
    // Aqui você decide o que entra na busca ampla.
    // Como você disse “muitos princípios ativos”, já deixo campos preparados.
    const fields = [
      produto?.nomeComercial,
      produto?.empresa,
      produto?.marca,
      produto?.principiosAtivos,     // se existir no seu modelo
      produto?.principioAtivo,       // variação
      produto?.ingredientesAtivos,   // variação
      produto?.tipoProduto,
      produto?.formulacao,
      produto?.nome_key,
    ].filter(Boolean);

    const joined = fields.join(' ');
    return tokenize(joined);
  }

  // =========================
  // RTDB helpers
  // =========================
  function getDB() {
    const db = window.database || window.db || (window.firebase && window.firebase.database && window.firebase.database());
    if (!db) throw new Error('Realtime Database indisponível (window.database não encontrado).');
    return db;
  }

  async function safeOnce(ref) {
    const snap = await ref.once('value');
    return snap.val();
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // =========================
  // Índices no RTDB (paths)
  // =========================
  const PATHS = {
    catalogo: 'produtos_catalogo',
    usuarios: 'produtos_usuarios',
    catalogoBusca: 'produtos_catalogo_busca',
    usuariosBusca: 'produtos_usuarios_busca',
  };

  // =========================
  // productsService
  // =========================
  const productsService = {
    normalizeTexto,
    normalizeKey,

    // ------------------------------------------------------------
    // Salvar produto (usuário)
    // ------------------------------------------------------------
    async saveUserProdutoRTDB(produto) {
      const db = getDB();
      const authUser = window.currentUserData || null;
      const uid = authUser?.uid || window.currentUserData?.uid;

      if (!uid) throw new Error('Usuário não autenticado');

      const now = Date.now();

      const nomeComercial = (produto?.nomeComercial || '').toString().trim();
      const empresa = (produto?.empresa || '').toString().trim();
      const tipoProduto = (produto?.tipoProduto || '').toString().trim();

      if (!nomeComercial || !empresa) throw new Error('Informe nomeComercial e empresa');
      if (!tipoProduto) throw new Error('Informe tipoProduto');

      const payload = {
        nomeComercial,
        empresa,
        tipoProduto,
        phFispq: produto?.phFispq ?? null,
        urlFispq: produto?.urlFispq || '',
        createdAt: now,
        createdBy: uid,
        nome_key: normalizeKey(nomeComercial),
        empresa_key: normalizeKey(empresa),
        // campos “livres” se existirem
        principiosAtivos: produto?.principiosAtivos || produto?.principioAtivo || produto?.ingredientesAtivos || '',
      };

      const ref = db.ref(`${PATHS.usuarios}/${uid}`).push();
      const id = ref.key;

      // escreve produto + índice em um update multi-path (atômico)
      const tokens = buildSearchTokens(payload);
      const updates = {};
      updates[`${PATHS.usuarios}/${uid}/${id}`] = payload;

      // índice por token
      for (const t of tokens) {
        updates[`${PATHS.usuariosBusca}/${uid}/${t}/${id}`] = true;
      }

      await db.ref().update(updates);

      return { id, ...payload };
    },

    // ------------------------------------------------------------
    // Salvar produto (catálogo global) - admin
    // ------------------------------------------------------------
    async saveGlobalProdutoRTDB(produto) {
      const db = getDB();
      const now = Date.now();

      const nomeComercial = (produto?.nomeComercial || '').toString().trim();
      const empresa = (produto?.empresa || '').toString().trim();
      const tipoProduto = (produto?.tipoProduto || '').toString().trim();

      if (!nomeComercial || !empresa) throw new Error('Informe nomeComercial e empresa');
      if (!tipoProduto) throw new Error('Informe tipoProduto');

      const payload = {
        nomeComercial,
        empresa,
        tipoProduto,
        phFispq: produto?.phFispq ?? null,
        urlFispq: produto?.urlFispq || '',
        createdAt: now,
        nome_key: normalizeKey(nomeComercial),
        empresa_key: normalizeKey(empresa),
        principiosAtivos: produto?.principiosAtivos || produto?.principioAtivo || produto?.ingredientesAtivos || '',
      };

      const ref = db.ref(PATHS.catalogo).push();
      const id = ref.key;

      const tokens = buildSearchTokens(payload);
      const updates = {};
      updates[`${PATHS.catalogo}/${id}`] = payload;

      for (const t of tokens) {
        updates[`${PATHS.catalogoBusca}/${t}/${id}`] = true;
      }

      await db.ref().update(updates);

      return { id, ...payload };
    },

    // ------------------------------------------------------------
    // Busca (catálogo) por tokens (ampla) + fallback prefixo
    // ------------------------------------------------------------
    async searchCatalogoProdutosByTerm(termo, opts = {}) {
      const db = getDB();
      const limit = Number(opts.limit || 200); // mais abrangente
      const term = normalizeTexto(termo);

      if (!term || term.length < 2) return [];

      const tokens = tokenize(term);
      if (!tokens.length) return [];

      // Estratégia:
      // 1) pega candidatos pelo 1º token (maior retorno)
      // 2) filtra/rankeia pelos demais tokens
      const primary = tokens[0];
      const bucketRef = db.ref(`${PATHS.catalogoBusca}/${primary}`).limitToFirst(Math.max(limit, 200));
      const bucket = await safeOnce(bucketRef);

      const ids = bucket ? Object.keys(bucket) : [];
      if (!ids.length) {
        // fallback prefixo por nome_key (funciona bem quando usuário digita início do nome)
        return this._searchCatalogoByPrefix(term, opts);
      }

      // Carregar produtos por ID (em lotes)
      const idBatches = chunk(ids.slice(0, limit), 50);
      const products = [];
      for (const batch of idBatches) {
        const batchReads = batch.map(async (id) => {
          const val = await safeOnce(db.ref(`${PATHS.catalogo}/${id}`));
          if (!val) return null;
          return { id, source: 'catalogo', ...val };
        });
        const res = await Promise.all(batchReads);
        res.filter(Boolean).forEach(p => products.push(p));
      }

      // filtrar/rankeia por tokens
      const scored = products.map(p => {
        const hay = normalizeTexto(
          `${p.nomeComercial || ''} ${p.empresa || ''} ${p.principiosAtivos || ''} ${p.tipoProduto || ''} ${p.formulacao || ''} ${p.nome_key || ''}`
        );
        let score = 0;
        for (const t of tokens) {
          if (hay.includes(t)) score += 1;
        }
        // bonus: match no nome_key
        if (p.nome_key && p.nome_key.includes(normalizeKey(term))) score += 2;
        return { p, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

      return scored.map(x => x.p).slice(0, limit);
    },

    // fallback: prefixo em nome_key (precisa .indexOn ["nome_key"])
    async _searchCatalogoByPrefix(termo, opts = {}) {
      const db = getDB();
      const limit = Number(opts.limit || 100);
      const key = normalizeKey(termo);
      if (!key) return [];

      const ref = db.ref(PATHS.catalogo)
        .orderByChild('nome_key')
        .startAt(key)
        .endAt(key + '\uf8ff')
        .limitToFirst(limit);

      const data = await safeOnce(ref);
      if (!data) return [];

      return Object.entries(data).map(([id, p]) => ({ id, source: 'catalogo', ...p }));
    },

    // ------------------------------------------------------------
    // Busca (usuário) por tokens (ampla) + fallback prefixo
    // ------------------------------------------------------------
    async searchUserProdutosByTerm(termo, opts = {}) {
      const db = getDB();
      const limit = Number(opts.limit || 200);
      const term = normalizeTexto(termo);

      const authUser = window.currentUserData || null;
      const uid = authUser?.uid || window.currentUserData?.uid;
      if (!uid) return [];

      if (!term || term.length < 2) return [];

      const tokens = tokenize(term);
      if (!tokens.length) return [];

      const primary = tokens[0];
      const bucketRef = db.ref(`${PATHS.usuariosBusca}/${uid}/${primary}`).limitToFirst(Math.max(limit, 200));
      const bucket = await safeOnce(bucketRef);

      const ids = bucket ? Object.keys(bucket) : [];
      if (!ids.length) {
        return this._searchUserByPrefix(uid, term, opts);
      }

      const idBatches = chunk(ids.slice(0, limit), 50);
      const products = [];
      for (const batch of idBatches) {
        const batchReads = batch.map(async (id) => {
          const val = await safeOnce(db.ref(`${PATHS.usuarios}/${uid}/${id}`));
          if (!val) return null;
          return { id, source: 'usuario', ...val };
        });
        const res = await Promise.all(batchReads);
        res.filter(Boolean).forEach(p => products.push(p));
      }

      const scored = products.map(p => {
        const hay = normalizeTexto(
          `${p.nomeComercial || ''} ${p.empresa || ''} ${p.principiosAtivos || ''} ${p.tipoProduto || ''} ${p.formulacao || ''} ${p.nome_key || ''}`
        );
        let score = 0;
        for (const t of tokens) {
          if (hay.includes(t)) score += 1;
        }
        if (p.nome_key && p.nome_key.includes(normalizeKey(term))) score += 2;
        return { p, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

      return scored.map(x => x.p).slice(0, limit);
    },

    async _searchUserByPrefix(uid, termo, opts = {}) {
      const db = getDB();
      const limit = Number(opts.limit || 100);
      const key = normalizeKey(termo);
      if (!key) return [];

      const ref = db.ref(`${PATHS.usuarios}/${uid}`)
        .orderByChild('nome_key')
        .startAt(key)
        .endAt(key + '\uf8ff')
        .limitToFirst(limit);

      const data = await safeOnce(ref);
      if (!data) return [];

      return Object.entries(data).map(([id, p]) => ({ id, source: 'usuario', ...p }));
    }
  };

  // expor global
  window.productsService = productsService;

  // debug útil
  console.log('✅ productsService (busca por tokens) carregado');

})();
