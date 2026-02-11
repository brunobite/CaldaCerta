(() => {
    const DEFAULT_LIMIT = 50;
    const MIN_WORD_LENGTH = 2;

    // Função de normalização ÚNICA
    function normalizeForSearch(text) {
        return (text || "")
            .toString()
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9 ]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    // Extrai palavras para busca
    function extractSearchWords(text) {
        const normalized = normalizeForSearch(text);
        return normalized.split(" ")
            .filter(word => word.length >= MIN_WORD_LENGTH)
            .filter((word, index, self) => self.indexOf(word) === index);
    }

    // Firebase helpers
    function getCurrentUser() {
        const user = window.firebase?.auth()?.currentUser;
        if (!user) {
            throw new Error("Usuário não autenticado");
        }
        return user;
    }

    function getDatabase() {
        return window.firebase.database();
    }

    // BUSCA SIMPLIFICADA - FUNÇÃO PRINCIPAL
    async function searchProducts(term, options = {}) {
        const { limit = DEFAULT_LIMIT, includeCatalog = true } = options;
        const user = getCurrentUser();
        const db = getDatabase();
        
        const searchWords = extractSearchWords(term);
        if (searchWords.length === 0) {
            return [];
        }

        // 1. Buscar produtos do usuário
        const userProducts = await searchUserProducts(searchWords, user.uid, limit);
        
        // 2. Buscar no catálogo se necessário
        let catalogProducts = [];
        if (userProducts.length < limit && includeCatalog) {
            catalogProducts = await searchCatalogProducts(searchWords, limit - userProducts.length);
        }

        // Combinar resultados (usuário primeiro)
        const combined = [...userProducts, ...catalogProducts];
        
        // Remover duplicatas
        const seen = new Set();
        const uniqueProducts = [];
        
        for (const produto of combined) {
            const key = `${produto.source}:${produto.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueProducts.push(produto);
            }
        }

        return uniqueProducts.slice(0, limit);
    }

    // Busca em produtos do usuário
    async function searchUserProducts(searchWords, uid, limit) {
        const db = getDatabase();
        const results = new Map();

        for (const word of searchWords) {
            const snapshot = await db.ref(`produtos_usuarios_busca/${uid}/${word}`).once("value");
            
            if (snapshot.exists()) {
                const productIds = Object.keys(snapshot.val());
                
                for (const productId of productIds) {
                    if (results.size >= limit) break;
                    
                    const productSnap = await db.ref(`produtos_usuarios/${uid}/${productId}`).once("value");
                    
                    if (productSnap.exists()) {
                        const produto = productSnap.val();
                        if (containsAllWords(produto, searchWords)) {
                            results.set(productId, {
                                id: productId,
                                ...produto,
                                source: "usuario"
                            });
                        }
                    }
                }
            }
        }

        return Array.from(results.values());
    }

    // Busca no catálogo global
    async function searchCatalogProducts(searchWords, limit) {
        const db = getDatabase();
        const results = new Map();

        for (const word of searchWords) {
            const snapshot = await db.ref(`produtos_catalogo_busca/${word}`).once("value");
            
            if (snapshot.exists()) {
                const productIds = Object.keys(snapshot.val());
                
                for (const productId of productIds) {
                    if (results.size >= limit) break;
                    
                    const productSnap = await db.ref(`produtos_catalogo/${productId}`).once("value");
                    
                    if (productSnap.exists()) {
                        const produto = productSnap.val();
                        if (containsAllWords(produto, searchWords)) {
                            results.set(productId, {
                                id: productId,
                                ...produto,
                                source: "catalogo"
                            });
                        }
                    }
                }
            }
        }

        return Array.from(results.values());
    }

    // Verifica se o produto contém todas as palavras
    function containsAllWords(produto, searchWords) {
        const searchText = normalizeForSearch(
            `${produto.nomeComercial || ""} ${produto.empresa || ""}`
        );
        
        return searchWords.every(word => searchText.includes(word));
    }

    // Salvar produto do usuário
    async function saveUserProduct(produto) {
        const user = getCurrentUser();
        const db = getDatabase();
        
        const productData = {
            nomeComercial: produto.nomeComercial || "",
            empresa: produto.empresa || "",
            tipoProduto: produto.tipoProduto || "Não informado",
            phFispq: parseFloat(produto.phFispq) || null,
            urlFispq: produto.urlFispq || "",
            nome_key: normalizeForSearch(produto.nomeComercial || ""),
            createdAt: Date.now(),
            createdBy: user.uid,
            createdByEmail: user.email || ""
        };
        
        const newRef = db.ref(`produtos_usuarios/${user.uid}`).push();
        await newRef.set(productData);
        
        await updateSearchIndex(user.uid, newRef.key, productData);
        
        return {
            id: newRef.key,
            ...productData,
            source: "usuario"
        };
    }

    // Atualizar índice de busca
    async function updateSearchIndex(uid, productId, productData) {
        const db = getDatabase();
        const searchText = normalizeForSearch(
            `${productData.nomeComercial} ${productData.empresa}`
        );
        const words = extractSearchWords(searchText);
        
        const updates = {};
        words.forEach(word => {
            updates[`produtos_usuarios_busca/${uid}/${word}/${productId}`] = true;
        });
        
        await db.ref().update(updates);
    }

    // Funções de compatibilidade (para código existente)
    async function searchUserProdutosByTerm(termo, { limit = DEFAULT_LIMIT } = {}) {
        return searchProducts(termo, { limit, includeCatalog: false });
    }

    async function searchCatalogoProdutosByTerm(termo, { limit = DEFAULT_LIMIT } = {}) {
        return searchProducts(termo, { limit, includeCatalog: true });
    }

    // Exportar para window
    window.productsService = {
        searchProducts,
        normalizeForSearch,
        saveUserProduct,
        extractSearchWords,
        containsAllWords,
        searchUserProdutosByTerm,
        searchCatalogoProdutosByTerm
    };
})();
