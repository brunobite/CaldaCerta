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
        const formulacao = (produto?.formulacao || '').toString().trim();

        return {
            nomeComercial,
            empresa,
            formulacao,
            tipoProduto,
            phFispq,
            urlFispq,
            nome_key: normalizeKey(nomeComercial),
            nomeNormalizado: normalizeTexto(nomeComercial),
            createdAt: Date.now(),
            createdBy: user.uid
        };
    }

    async function saveProdutoRTDB(produto) {
        const user = getCurrentUser();
        const database = getDatabase();
        const payload = buildProdutoPayload(produto, user);
        const ref = database.ref('produtos').push();
        await ref.set(payload);
        return { id: ref.key, ...payload };
    }

    async function listUserProdutos({ limit = DEFAULT_LIMIT } = {}) {
        const user = getCurrentUser();
        const database = getDatabase();
        const snapshot = await database
            .ref('produtos')
            .orderByChild('createdBy')
            .equalTo(user.uid)
            .limitToLast(limit)
            .once('value');
        const data = snapshot.val() || {};
        return Object.entries(data).map(([id, produto]) => ({
            id,
            ...produto,
            source: 'usuario'
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

    window.productsService = {
        normalizeTexto,
        normalizeKey,
        saveProdutoRTDB,
        listUserProdutos,
        searchUserProdutosByTerm
    };
})();
