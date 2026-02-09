(() => {
    const DEFAULT_LIMIT = 50;

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

    function buildProdutoPayload(produto, user) {
        const nomeComercial = (produto?.nomeComercial || produto?.nome || '').toString().trim();
        const empresa = (produto?.empresa || produto?.marca || '').toString().trim();
        const tipoProduto = assertTipoProduto(produto?.tipoProduto);
        const phFispq = Number.isFinite(produto?.phFispq) ? produto.phFispq : null;
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

    async function searchUserProdutosByTerm(termo, { limit = DEFAULT_LIMIT } = {}) {
        const key = normalizeKey(termo);
        if (!key) {
            return [];
        }
        const produtos = await listUserProdutos({ limit });
        return produtos
            .filter((produto) => normalizeKey(produto.nomeComercial || '').includes(key))
            .slice(0, limit);
    }

    async function searchCatalogoProdutosByTerm(termo, { limit = DEFAULT_LIMIT } = {}) {
        const key = normalizeKey(termo);
        if (!key) {
            return [];
        }
        const produtos = await listCatalogoProdutos({ limit });
        return produtos
            .filter((produto) => normalizeKey(produto.nomeComercial || '').includes(key))
            .slice(0, limit);
    }

    window.productsService = {
        normalizeTexto,
        normalizeKey,
        saveUserProdutoRTDB,
        saveGlobalProdutoRTDB,
        listUserProdutos,
        listCatalogoProdutos,
        searchUserProdutosByTerm,
        searchCatalogoProdutosByTerm
    };
})();
