// ============================================
// PRODUCTS SERVICE (RTDB) - BUSCA ABRANGENTE
// Indexa tokens em:
// - /produtos_busca/{token}/{produtoId} = true
// - /produtos_usuarios_busca/{uid}/{token}/{produtoId} = true
// ============================================
(function () {
  const db = () => window.database;

  function normalizeTexto(valor) {
    return (valor || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(valor) {
    return (valor || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Tokens com prefixos (abamectin -> ab, aba, abam, abamec...)
  function tokenize(valor) {
    const base = normalizeKey(valor);
    if (!base) return [];
    const words = base.split(" ").filter(Boolean);

    const tokens = new Set();
    for (const w of words) {
      if (w.length < 2) continue;
      tokens.add(w);

      const maxPref = Math.min(10, w.length);
      for (let i = 2; i <= maxPref; i++) tokens.add(w.slice(0, i));
    }
    return Array.from(tokens);
  }

  function buildSearchText(produto) {
    // >>> AJUSTE AQUI se seus campos tiverem outros nomes <<<
    const nome = produto?.nomeComercial || produto?.nome || "";
    const empresa = produto?.empresa || produto?.marca || "";
    const tipo = produto?.tipoProduto || produto?.tipo || "";

    // Variações comuns para princípio ativo
    const ativos =
      produto?.principiosAtivos ||
      produto?.principioAtivo ||
      produto?.ingredienteAtivo ||
      produto?.ingrediente_ativo ||
      produto?.ativo ||
      produto?.ia ||
      "";

    const formulacao = produto?.formulacao || "";

    return normalizeTexto([nome, empresa, tipo, formulacao, ativos].filter(Boolean).join(" "));
  }

  async function upsertGlobalSearchIndex(produtoId, produto) {
    const tokens = tokenize(buildSearchText(produto));
    if (!tokens.length) return;

    const updates = {};
    for (const t of tokens) updates[`produtos_busca/${t}/${produtoId}`] = true;
    await db().ref().update(updates);
  }

  async function upsertUserSearchIndex(uid, produtoId, produto) {
    const tokens = tokenize(buildSearchText(produto));
    if (!tokens.length) return;

    const updates = {};
    for (const t of tokens) updates[`produtos_usuarios_busca/${uid}/${t}/${produtoId}`] = true;
    await db().ref().update(updates);
  }

  async function getIdsFromIndex(refPath, tokens, limit) {
    const first = tokens[0];
    if (!first) return [];

    const snap = await db()
      .ref(`${refPath}/${first}`)
      .limitToFirst(Math.max(120, limit || 120))
      .once("value");

    const obj = snap.val() || {};
    let ids = Object.keys(obj);

    // Interseção opcional para refinar (somente se o conjunto não for gigante)
    for (let i = 1; i < tokens.length && ids.length > 0 && ids.length <= 600; i++) {
      const t = tokens[i];
      const s2 = await db().ref(`${refPath}/${t}`).once("value");
      const o2 = s2.val() || {};
      const set2 = new Set(Object.keys(o2));
      ids = ids.filter((id) => set2.has(id));
    }

    if (limit && ids.length > limit) ids = ids.slice(0, limit);
    return ids;
  }

  async function fetchProdutosByIds(basePath, ids) {
    if (!ids.length) return [];
    const results = [];

    for (const id of ids) {
      const snap = await db().ref(`${basePath}/${id}`).once("value");
      const val = snap.val();
      if (val) results.push({ id, ...val });
    }
    return results;
  }

  function localFilterAndRank(produtos, termo) {
    const f = normalizeTexto(termo);
    if (!f) return produtos;

    const ranked = [];
    for (const p of produtos) {
      const text = buildSearchText(p);
      if (!text.includes(f)) continue;

      const nome = normalizeTexto(p.nomeComercial || p.nome || "");
      const empresa = normalizeTexto(p.empresa || p.marca || "");

      let score = 0;
      if (nome.startsWith(f)) score += 10;
      if (nome.includes(f)) score += 6;
      if (empresa.includes(f)) score += 3;
      if (text.includes(f)) score += 1;

      ranked.push({ p, score });
    }

    ranked.sort((a, b) => b.score - a.score);
    return ranked.map((x) => x.p);
  }

  async function searchGlobalBroad(term, { limit = 80 } = {}) {
    const tokens = tokenize(term);
    if (!tokens.length) return [];

    const ids = await getIdsFromIndex("produtos_busca", tokens, limit * 2);
    const produtos = await fetchProdutosByIds("produtos_catalogo", ids);

    const filtered = localFilterAndRank(produtos, term).slice(0, limit);
    return filtered.map((p) => ({
      ...p,
      nomeComercial: p.nomeComercial || p.nome || "",
      empresa: p.empresa || p.marca || "",
      phFispq: p.phFispq ?? p.ph ?? null,
      urlFispq: p.urlFispq || p.url_fispq || "",
      source: "catalogo",
    }));
  }

  async function searchUserBroad(uid, term, { limit = 80 } = {}) {
    const tokens = tokenize(term);
    if (!tokens.length) return [];

    const ids = await getIdsFromIndex(`produtos_usuarios_busca/${uid}`, tokens, limit * 2);
    const produtos = await fetchProdutosByIds(`produtos_usuarios/${uid}`, ids);

    const filtered = localFilterAndRank(produtos, term).slice(0, limit);
    return filtered.map((p) => ({
      ...p,
      nomeComercial: p.nomeComercial || p.nome || "",
      empresa: p.empresa || p.marca || "",
      phFispq: p.phFispq ?? p.ph ?? null,
      urlFispq: p.urlFispq || p.url_fispq || "",
      source: "usuario",
    }));
  }

  async function saveUserProdutoRTDB(produto) {
    const user = window.auth?.currentUser;
    if (!user) throw new Error("Usuário não autenticado");
    const uid = user.uid;

    const now = new Date().toISOString();
    const nomeComercial = (produto?.nomeComercial || "").trim();
    const empresa = (produto?.empresa || "").trim();
    if (!nomeComercial || !empresa) throw new Error("Nome/empresa obrigatórios");

    const payload = {
      ...produto,
      nomeComercial,
      empresa,
      nome_key: normalizeKey(nomeComercial),
      createdAt: now,
      createdBy: uid,
    };

    const ref = db().ref(`produtos_usuarios/${uid}`).push();
    await ref.set(payload);
    await upsertUserSearchIndex(uid, ref.key, payload);

    return { id: ref.key, ...payload };
  }

  async function saveGlobalProdutoRTDB(produto) {
    const user = window.auth?.currentUser;
    if (!user) throw new Error("Usuário não autenticado");

    const now = new Date().toISOString();
    const nomeComercial = (produto?.nomeComercial || "").trim();
    const empresa = (produto?.empresa || "").trim();
    if (!nomeComercial || !empresa) throw new Error("Nome/empresa obrigatórios");

    const payload = {
      ...produto,
      nomeComercial,
      empresa,
      nome_key: normalizeKey(nomeComercial),
      createdAt: now,
      createdBy: user.uid,
    };

    const ref = db().ref("produtos_catalogo").push();
    await ref.set(payload);
    await upsertGlobalSearchIndex(ref.key, payload);

    return { id: ref.key, ...payload };
  }

  window.productsService = window.productsService || {};
  window.productsService.normalizeTexto = normalizeTexto;
  window.productsService.normalizeKey = normalizeKey;

  window.productsService.searchCatalogoProdutosByTermBroad = searchGlobalBroad;
  window.productsService.searchUserProdutosByTermBroad = async (term, opts) => {
    const uid = window.auth?.currentUser?.uid;
    if (!uid) return [];
    return searchUserBroad(uid, term, opts);
  };

  // Compat
  window.productsService.searchCatalogoProdutosByTerm = (term, opts) =>
    searchGlobalBroad(term, opts);

  window.productsService.searchUserProdutosByTerm = async (term, opts) => {
    const uid = window.auth?.currentUser?.uid;
    if (!uid) return [];
    return searchUserBroad(uid, term, opts);
  };

  window.productsService.saveUserProdutoRTDB = saveUserProdutoRTDB;
  window.productsService.saveGlobalProdutoRTDB = saveGlobalProdutoRTDB;

  console.log("✅ productsService (busca abrangente) carregado");
})();