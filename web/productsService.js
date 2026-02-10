(() => {
    const DEFAULT_LIMIT = 50;
    const MIN_TOKEN_LENGTH = 2;
    const DEFAULT_CONCURRENCY = 10;

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
            .replace(/\s+/g, ' ')
            .replace(/[^a-z0-9 ]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getDatabase() {
        const database = window.database;
        if (!database) {
            throw new Error('Realtime Database indisponível');
        }
        return database;
    }

    function getCurrentUser() {
        const user = window.auth?.currentUser;
        if (!user?.uid) {
            throw new Error('Usuário não autenticado');
        }
        return user;
    }

    function assertTipoProduto(tipoProduto) {
        const normalized = (tipoProduto || '').toString().trim();
        if (!normalized) {
            const error = new Error('Tipo de produto obrigatório');
            error.code = 'produto/tipo-obrigatorio';
            throw error;
        }
        return normalized;
    }

    function parsePhFispq(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }

        if (typeof value === 'string') {
            const normalized = value.trim().replace(',', '.');
            if (!normalized) {
                return null;
            }

            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : null;
        }

        return null;
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
            nomeNormalizado: normalizeTexto(nomeComercial),
            createdAt: Date.now(),
            createdBy: user.uid,
            createdByEmail: user.email || ''
        };
    }

    function buildSearchTokens(texto, { minLength = MIN_TOKEN_LENGTH } = {}) {
        const normalized = normalizeKey(texto);
        if (!normalized) {
            return [];
        }

        const tokens = new Set();
        const words = normalized.split(' ').filter(Boolean);
        words.forEach((word) => {
            if (word.length < minLength) {
                return;
            }
            for (let size = minLength; size <= word.length; size += 1) {
                tokens.add(word.slice(0, size));
            }
        });

        return [...tokens];
    }

    function getUserCatalogoRef(database, user) {
        return database.ref(`produtos_usuarios/${user.uid}`);
    }

    function getCatalogoGlobalRef(database) {
        return database.ref('produtos_catalogo');
    }

    async function saveUserProdutoRTDB(produto) {
        const user = getCurrentUser();
        const database = getDatabase();
        const payload = buildProdutoPayload(produto, user);
        const ref = getUserCatalogoRef(database, user).push();
        const path = ref.toString();
        try {
            await ref.set(payload);
            return { id: ref.key, ...payload };
        } catch (err) {
            console.error('[saveUserProduct] path=', path, 'uid=', user.uid, 'payload=', payload, 'err=', err);
            throw err;
        }
    }

    async function saveGlobalProdutoRTDB(produto) {
        const user = getCurrentUser();
        const database = getDatabase();
        const payload = buildProdutoPayload(produto, user);
        const ref = getCatalogoGlobalRef(database).push();
        await ref.set(payload);
        return { id: ref.key, ...payload };
    }

    async function listUserProdutos({ limit = DEFAULT_LIMIT } = {}) {
        const user = getCurrentUser();
        const database = getDatabase();
        const snapshot = await database
            .ref(`produtos_usuarios/${user.uid}`)
            .orderByChild('createdAt')
            .limitToLast(limit)
            .once('value');
        const data = snapshot.val() || {};
        return Object.entries(data).map(([id, produto]) => ({
            id,
            ...produto,
            source: 'usuario'
        }));
    }

    async function listCatalogoProdutos({ limit = DEFAULT_LIMIT } = {}) {
        const database = getDatabase();
        const snapshot = await database
            .ref('produtos_catalogo')
            .orderByChild('createdAt')
            .limitToLast(limit)
            .once('value');
        const data = snapshot.val() || {};
        return Object.entries(data).map(([id, produto]) => ({
            id,
            ...produto,
            source: 'catalogo'
        }));
    }

    async function readMapAtPath(path) {
        const snapshot = await getDatabase().ref(path).once('value');
        return snapshot.val() || {};
    }

    async function mapWithConcurrency(items, mapper, { concurrency = DEFAULT_CONCURRENCY } = {}) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }

        const results = [];
        for (let i = 0; i < items.length; i += concurrency) {
            const chunk = items.slice(i, i + concurrency);
            const chunkResults = await Promise.all(chunk.map(mapper));
            results.push(...chunkResults);
        }
        return results;
    }

    async function fetchProdutosByIds(ids, { source, uid }) {
        if (!ids || ids.length === 0) {
            return [];
        }

        return mapWithConcurrency(ids, async (id) => {
            const basePath = source === 'catalogo'
                ? `produtos_catalogo/${id}`
                : `produtos_usuarios/${uid}/${id}`;

            const value = await readMapAtPath(basePath);
            if (!value || typeof value !== 'object') {
                return null;
            }

            return {
                id,
                ...value,
                source
            };
        });
    }

    async function searchByMultipleTokens(termo, { limit = DEFAULT_LIMIT } = {}) {
        const key = normalizeKey(termo);
        if (!key || key.length < MIN_TOKEN_LENGTH) {
            return [];
        }

        const searchTokens = buildSearchTokens(key, { minLength: MIN_TOKEN_LENGTH });
        if (searchTokens.length === 0) {
            return [];
        }

        const database = getDatabase();
        const user = getCurrentUser();

        const catalogoIdsSet = new Set();
        const usuarioIdsSet = new Set();

        for (const token of searchTokens) {
            if (token.length < MIN_TOKEN_LENGTH) {
                continue;
            }

            const [catalogoIndex, usuarioIndex] = await Promise.all([
                database.ref(`produtos_catalogo_busca/${token}`).once('value'),
                database.ref(`produtos_usuarios_busca/${user.uid}/${token}`).once('value')
            ]);

            Object.keys(catalogoIndex.val() || {}).forEach((id) => catalogoIdsSet.add(id));
            Object.keys(usuarioIndex.val() || {}).forEach((id) => usuarioIdsSet.add(id));
        }

        const catalogoIds = [...catalogoIdsSet];
        const usuarioIds = [...usuarioIdsSet];

        const [catalogoProdutos, usuarioProdutos] = await Promise.all([
            fetchProdutosByIds(catalogoIds, { source: 'catalogo' }),
            fetchProdutosByIds(usuarioIds, { source: 'usuario', uid: user.uid })
        ]);

        const combined = [...usuarioProdutos, ...catalogoProdutos]
            .filter(Boolean)
            .filter((produto) => {
                const produtoKey = normalizeKey(produto.nomeComercial || produto.nome || '');
                return searchTokens.every((token) => produtoKey.includes(token));
            });

        const dedup = [];
        const seen = new Set();
        combined.forEach((produto) => {
            const dedupKey = `${produto.source}:${produto.id}`;
            if (!seen.has(dedupKey)) {
                seen.add(dedupKey);
                dedup.push(produto);
            }
        });

        return dedup.slice(0, limit);
    }

    async function searchByTokenIndex(termo, { limit = DEFAULT_LIMIT } = {}) {
        return searchByMultipleTokens(termo, { limit });
    }

    async function searchUserProdutosByTerm(termo, { limit = DEFAULT_LIMIT } = {}) {
        return searchByTokenIndex(termo, { limit });
    }

    async function searchCatalogoProdutosByTerm(termo, { limit = DEFAULT_LIMIT } = {}) {
        return searchByTokenIndex(termo, { limit });
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

        return () => {
            query.off('value', onValue);
        };
    }

    window.productsService = {
        normalizeTexto,
        normalizeKey,
        parsePhFispq,
        buildSearchTokens,
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
