// ============================================
// CaldaCerta Pro - Aplicação Principal
// Firebase é inicializado em firebase-config.js
// ============================================
const APP_VERSION = 'v1.2.1';
const BUILD_NUMBER = 2; // ← INCREMENTAR A CADA DEPLOY
const APP_FULL_VERSION = `${APP_VERSION}-build${BUILD_NUMBER}`;
console.log(`🌿 CaldaCerta ${APP_FULL_VERSION} iniciando...`);

document.addEventListener('DOMContentLoaded', () => {
    const versionText = APP_FULL_VERSION;
    const loginVersionEl = document.getElementById('login-version-display');
    if (loginVersionEl) loginVersionEl.textContent = versionText;
    const appVersionEl = document.getElementById('app-version-display');
    if (appVersionEl) appVersionEl.textContent = versionText;
});

(function() {
    'use strict';

    // Referências Firebase (inicializadas em firebase-config.js)
    const auth = window.auth;
    const db = window.database;

    const offlineDb = window.OfflineDB;

    async function persistSimulationLocal(record) {
        if (!offlineDb || !record?.id) return;
        try {
            await offlineDb.saveSimulation(record);
        } catch (error) {
            console.warn('Falha ao persistir simulação local:', error);
        }
    }

    async function enqueueSyncQueue(type, path, payload) {
        if (!offlineDb) return;
        try {
            await offlineDb.enqueueSync({ type, path, payload, synced: false });
        } catch (error) {
            console.warn('Falha ao enfileirar sincronização:', error);
        }
    }

    async function syncPendingData() {
        if (!offlineDb || !navigator.onLine || !db) return 0;
        const queue = await offlineDb.getPendingSyncItems();
        if (!queue.length) return 0;

        let synced = 0;
        for (const item of queue) {
            try {
                if (item.type === 'create' || item.type === 'update') {
                    await db.ref(item.path).set(item.payload);
                } else if (item.type === 'delete') {
                    await db.ref(item.path).remove();
                }
                await offlineDb.markSyncItemDone(item.id);
                synced += 1;
            } catch (error) {
                await offlineDb.bumpSyncItemAttempt(item.id);
                console.warn('[SyncQueue] Item mantido para próxima tentativa:', item.id, error);
            }
        }

        if (synced > 0 && typeof showToast === 'function') {
            showToast(`✅ ${synced} item(ns) offline sincronizado(s)`, 'success');
        }
        return synced;
    }

    function handleOfflineMode() {
        console.log('[Offline] Modo offline ativo');
    }

    // Objeto API mock para não quebrar código legado
    window.API = window.API || {};
    if (typeof window.API_BASE === 'undefined') {
        window.API_BASE = '';
    }

    // Utilitários de segurança (definidos em utils.js, carregado antes)
    const escapeHtml = window.escapeHtml;
    const sanitizeUrl = window.sanitizeUrl;

    // ============================================
    // DADOS MOCK DE CLIMA (fallback único)
    // ============================================
    const MOCK_DELTA_T = [
        2, 3, 5, 6, 4, 3, 2, 4, 5, 4, 3, 2,
        3, 4, 5, 6, 7, 6, 5, 4, 3, 3, 2, 2,
        2, 3, 5, 6, 4, 3, 2, 4, 5, 4, 3, 2,
        3, 4, 5, 6, 7, 6, 5, 4, 3, 3, 2, 2
    ];
    const MOCK_TEMPS = [18,17,16,16,17,19,21,24,27,29,31,32,33,33,32,31,29,27,25,23,22,21,20,19];
    const MOCK_HUMIDITY = [85,88,90,91,89,85,78,70,60,52,45,40,38,37,40,45,52,60,68,74,78,82,84,85];
    const MOCK_WIND = [5,4,3,3,4,6,8,10,12,14,15,16,16,15,14,12,10,8,7,6,5,5,4,4];
    const MOCK_RAIN = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

        let products = [];
        let historicalData = [];
        let currentStepIdx = 0;
        const steps = ['menu', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6'];
        let climateData = null;
        let currentEditingSimulation = null;
        let simulationDraftManager = null;

        const DRAFT_FIELD_IDS = [
            'id_cliente', 'id_propriedade', 'id_talhao', 'id_area', 'id_data',
            'id_responsavel', 'id_cultura', 'id_objetivo', 'eq_tanque', 'eq_vazao',
            'eq_operador', 'agua_ph', 'agua_dureza', 'agua_origem', 'agua_obs',
            'clima_lat', 'clima_lon', 'jarra_vol', 'orderMode', 'respeitarHierarquia',
            'criterioOrdenacao', 'calda_ph'
        ];

        // Bancos de dados (carregados da API)
        let bancoProdutos = [];
        let bancoClientes = [];
        let bancoPropriedades = [];
        let bancoTalhoes = [];
        let bancoResponsaveis = [];
        let bancoOperadores = [];

        const PRODUCT_TYPE_OPTIONS = [
            { value: 'calcita', label: 'Corretivo / Calcita' },
            { value: 'fertilizante', label: 'Fertilizante' },
            { value: 'adjuvante', label: 'Adjuvante' },
            { value: 'herbicida', label: 'Herbicida' },
            { value: 'fungicida', label: 'Fungicida' },
            { value: 'inseticida', label: 'Inseticida' },
            { value: 'acaricida', label: 'Acaricida' },
            { value: 'biologico', label: 'Biológico' },
            { value: 'oleo', label: 'Óleo Mineral/Vegetal' },
            { value: 'outros', label: 'Outros' }
        ];

        const PRODUCT_TYPE_LABELS = PRODUCT_TYPE_OPTIONS.reduce((acc, item) => {
            acc[item.value] = item.label;
            return acc;
        }, {});

        const LEGACY_TYPE_MAP = {
            ADJUVANTE: 'adjuvante',
            ESPALHANTE: 'adjuvante',
            ANTIESPUMA: 'adjuvante',
            FERTILIZANTE: 'fertilizante',
            OLEO: 'oleo',
            PRODUTO: 'outros'
        };

        function shouldUseRemoteApi() {
            const base = (window.API_BASE || '').toLowerCase();
            return Boolean(base) && !base.includes('localhost') && !base.includes('127.0.0.1');
        }

        function normalizeProdutoTipo(value) {
            if (!value) return '';
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed) return '';
                if (LEGACY_TYPE_MAP[trimmed]) return LEGACY_TYPE_MAP[trimmed];
                const normalized = trimmed
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase();
                if (PRODUCT_TYPE_LABELS[normalized]) return normalized;
            }
            return '';
        }

        function getProdutoTipoLabel(value) {
            const normalized = normalizeProdutoTipo(value);
            return normalized ? PRODUCT_TYPE_LABELS[normalized] : 'Não informado';
        }

        function resolveProdutoTipo(produto) {
            return normalizeProdutoTipo(produto?.tipoProduto || produto?.tipo);
        }

        function updateProdutoNovoSaveState() {
            const select = document.getElementById('novo_produto_tipo');
            const btn = document.getElementById('btn-salvar-produto');
            const error = document.getElementById('novo_produto_tipo_error');
            if (!select || !btn) return;
            const hasValue = !!select.value;
            btn.disabled = !hasValue;
            if (error) {
                const touched = select.dataset.touched === 'true';
                error.classList.toggle('hidden', hasValue || !touched);
            }
        }

        function maybeWarnProdutoTipoMissing(produtos) {
            const missing = produtos.some((produto) => !resolveProdutoTipo(produto));
            if (missing) {
                showToast('⚠️ Alguns produtos estão sem tipo. Edite ou selecione o tipo para evitar inconsistências.', 'warning');
            }
        }

        // ✅ MODO API: leitura / badge / toggle

        function getSimulationDraftPayload() {
            const fields = {};
            DRAFT_FIELD_IDS.forEach((id) => {
                const element = document.getElementById(id);
                if (!element) return;
                if (element.type === 'checkbox') {
                    fields[id] = !!element.checked;
                } else {
                    fields[id] = element.value;
                }
            });

            return {
                fields,
                products: products.map((product) => ({ ...product })),
                currentStep: steps[currentStepIdx] || '2-1'
            };
        }

        function applySimulationDraftPayload(payload) {
            if (!payload) return;

            const fields = payload.fields || {};
            Object.entries(fields).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (!element) return;
                if (element.type === 'checkbox') {
                    element.checked = !!value;
                } else {
                    element.value = value ?? '';
                }
            });

            if (Array.isArray(payload.products)) {
                products = payload.products.map((item) => ({ ...item }));
                renderProductList();
            }

            calcRendimento();
            if (typeof toggleHierarchyOptions === 'function') {
                toggleHierarchyOptions();
            }
            if (typeof renderOrdem === 'function') {
                renderOrdem();
            }
        }

        function updateConnectionStatusBadge(online, firebaseConnected) {
            const badge = document.getElementById('connection-status-badge');
            if (!badge) return;

            const isConnected = online && firebaseConnected !== false;
            badge.classList.toggle('connection-status-online', isConnected);
            badge.classList.toggle('connection-status-offline', !isConnected);
            badge.textContent = isConnected ? 'Online' : 'Offline (modo campo)';
        }

        function initConnectionStatusBadge() {
            let firebaseConnected = true;
            const syncBadge = () => updateConnectionStatusBadge(navigator.onLine, firebaseConnected);

            window.addEventListener('online', syncBadge);
            window.addEventListener('offline', syncBadge);
            document.addEventListener('firebase-connection', (event) => {
                if (typeof event?.detail?.connected === 'boolean') {
                    firebaseConnected = event.detail.connected;
                    syncBadge();
                }
            });
            syncBadge();
        }

        function initDraftAutosave() {
            if (!window.OfflineAutosave) {
                return;
            }

            simulationDraftManager = window.OfflineAutosave.createManager({
                draftId: 'lastDraft',
                debounceMs: 600,
                getPayload: getSimulationDraftPayload,
                applyPayload: applySimulationDraftPayload
            });

            const root = document.getElementById('main-app');
            if (root) {
                const handler = (event) => {
                    const target = event.target;
                    if (!(target instanceof Element)) return;
                    if (!target.closest('[id^="step-2-"]')) return;
                    simulationDraftManager.scheduleSave();
                };

                root.addEventListener('input', handler);
                root.addEventListener('change', handler);
            }

            simulationDraftManager.loadAndApply().catch((error) => {
                console.warn('[Autosave] Não foi possível restaurar draft:', error);
            });
        }

        // Inicializar bancos de dados da API
        async function initBancosDados() {
            try {
                bancoProdutos = [];

                // Listas padrão (podem ser expandidas conforme necessário)
                bancoClientes = [];
                bancoResponsaveis = [];
                bancoOperadores = [];

                console.log('✅ Usando API como banco de produtos');

                preencherDatalist('clientes-list', bancoClientes);
                preencherDatalist('propriedades-list', bancoPropriedades);
                preencherDatalist('talhoes-list', bancoTalhoes);
                preencherDatalist('responsaveis-list', bancoResponsaveis);
                preencherDatalist('operadores-list', bancoOperadores);

                setupProdutoSearch();
                renderProdutoResultados([], '', false);

                console.log('✅ Bancos de dados Firebase carregados!');
            } catch (error) {
                console.error('❌ Erro ao carregar do Firebase:', error);
            }
        }

        function preencherDatalist(elementId, dados) {
            const datalist = document.getElementById(elementId);
            if (!datalist) return;
            datalist.innerHTML = dados.map(item => `<option value="${escapeHtml(item)}">`).join('');
        }

        function preencherSelectProdutos() {
            bancoProdutos = [];
            renderProdutoResultados([], '', false);
        }

        let produtoResultados = [];
        let produtoSearchInitialized = false;
        let produtoSearchTimeout = null;

        let produtoSelecionado = null;

        function setProdutoDetalhesReadonly(isReadonly) {
            const fields = [
                document.getElementById('p_nome'),
                document.getElementById('p_marca'),
                document.getElementById('p_ph'),
                document.getElementById('p_url_fispq')
            ];
            fields.forEach((field) => {
                if (!field) return;
                field.readOnly = isReadonly;
                field.classList.toggle('input-readonly', isReadonly);
            });
            const tipoSelect = document.getElementById('p_tipo');
            if (tipoSelect) {
                tipoSelect.disabled = false;
                tipoSelect.classList.remove('input-readonly');
            }
            const hint = document.getElementById('produto-detalhes-readonly');
            if (hint) {
                hint.classList.toggle('hidden', !isReadonly);
            }
            const editBtn = document.getElementById('produto-editar-btn');
            if (editBtn) {
                editBtn.disabled = !isReadonly;
            }
        }

        function limparCamposProduto() {
            document.getElementById('p_nome').value = '';
            document.getElementById('p_marca').value = '';
            document.getElementById('p_dose').value = '';
            document.getElementById('p_ph').value = '';
            document.getElementById('p_url_fispq').value = '';
            document.getElementById('p_formulacao').selectedIndex = 0;
            document.getElementById('p_tipo').selectedIndex = 0;
            updateFispqLink();
            produtoSelecionado = null;
            setProdutoDetalhesReadonly(false);
        }

        window.selecionarProdutoResultado = (index) => {
            const produto = produtoResultados[index];
            if (!produto) {
                return;
            }

            document.getElementById('p_nome').value = produto.nomeComercial || '';
            document.getElementById('p_marca').value = produto.empresa || '';
            document.getElementById('p_ph').value = formatPhValue(produto.phFispq);
            document.getElementById('p_url_fispq').value = produto.urlFispq || '';
            updateFispqLink();

            const tipoProduto = resolveProdutoTipo(produto);
            const tipoSelect = document.getElementById('p_tipo');
            if (tipoSelect) {
                tipoSelect.value = tipoProduto || '';
            }
            produtoSelecionado = produto;
            setProdutoDetalhesReadonly(true);

            const searchInput = document.getElementById('p_banco_busca');
            if (searchInput) {
                searchInput.value = `${produto.nomeComercial || ''}${produto.empresa ? ` (${produto.empresa})` : ''}`;
            }
            const resultados = document.getElementById('p_banco_resultados');
            if (resultados) {
                resultados.classList.add('hidden');
            }

            document.getElementById('p_dose').value = '';
            setTimeout(() => { document.getElementById('p_dose').focus(); }, 100);

            const hasPh = Number.isFinite(parsePhValue(produto.phFispq));
            if (!hasPh && !produto.urlFispq) {
                buscarPhFispqPorNome(produto.nomeComercial || '');
            }
        };

        window.editarProdutoSelecionado = () => {
            produtoSelecionado = null;
            setProdutoDetalhesReadonly(false);
        };

        function setupProdutoSearch() {
            if (produtoSearchInitialized) {
                return;
            }
            const searchInput = document.getElementById('p_banco_busca');
            if (!searchInput) {
                return;
            }
            produtoSearchInitialized = true;

            searchInput.addEventListener('input', () => {
                if (produtoSearchTimeout) {
                    clearTimeout(produtoSearchTimeout);
                }
                if (!searchInput.value.trim() && produtoSelecionado) {
                    produtoSelecionado = null;
                    setProdutoDetalhesReadonly(false);
                }
                produtoSearchTimeout = setTimeout(() => {
                    buscarProdutosTypeahead(searchInput.value);
                }, 350);
            });

            searchInput.addEventListener('focus', () => {
                if (searchInput.value.trim()) {
                    buscarProdutosTypeahead(searchInput.value);
                } else {
                    renderProdutoResultados([], '', false);
                }
            });

            document.addEventListener('click', (event) => {
                const container = document.getElementById('produto-banco');
                const resultados = document.getElementById('p_banco_resultados');
                if (!container || !resultados) {
                    return;
                }
                if (!container.contains(event.target)) {
                    resultados.classList.add('hidden');
                }
            });
        }

        const { normalizeKey, normalizeTexto } = window.productsService || {};

        function parsePhValue(rawValue) {
            if (rawValue === null || rawValue === undefined) {
                return null;
            }
            const normalized = rawValue.toString().replace(',', '.').trim();
            const value = Number(normalized);
            return Number.isFinite(value) ? value : null;
        }

        function formatPhValue(value) {
            return Number.isFinite(value) ? value.toFixed(1) : '';
        }

        function logPhLookupServer(payload) {
            if (!shouldUseRemoteApi()) {
                return;
            }
            const base = getApiBase();
            if (!base) {
                return;
            }
            fetch(`${base}/api/produtos/ph-lookup-log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }).catch(() => {});
        }

        async function buscarPhFispqPorNome(nome) {
            if (!shouldUseRemoteApi()) {
                return;
            }
            const base = getApiBase();
            if (!base || !normalizeKey) {
                return;
            }
            const key = normalizeKey(nome);
            console.log('[PH] nome=', nome, 'key=', key);

            if (!key) {
                return;
            }

            try {
                const url = `${base}/api/produtos?query=${encodeURIComponent(nome)}`;
                const response = await fetch(url, {
                    headers: {
                        Accept: 'application/json'
                    }
                });
                const contentType = response.headers.get('content-type') || '';
                const rawText = await response.text();

                if (contentType.includes('text/html') || rawText.trim().toLowerCase().startsWith('<!doctype') || rawText.trim().toLowerCase().startsWith('<html')) {
                    throw new Error('API retornou HTML');
                }

                if (!response.ok) {
                    throw new Error(`Erro ao acessar API: ${response.status}`);
                }

                const produtos = rawText ? JSON.parse(rawText) : [];
                const match = produtos.find((produto) => normalizeKey(produto.nomeComercial || '') === key);

                logPhLookupServer({
                    nome,
                    key,
                    total: produtos.length
                });

                if (!match) {
                    document.getElementById('p_ph').value = '';
                    showToast('Produto não localizado no banco', 'warning');
                    return;
                }

                const phValue = parsePhValue(match.phFispq);
                document.getElementById('p_ph').value = formatPhValue(phValue);

                if (match.urlFispq) {
                    document.getElementById('p_url_fispq').value = match.urlFispq;
                }
                updateFispqLink();

                if (!Number.isFinite(phValue)) {
                    showToast('Produto encontrado sem pH', 'warning');
                }
            } catch (error) {
                console.error('❌ Erro ao buscar pH FISPQ:', error);
            }
        }

        async function fetchProdutosByTerm(termo) {
            if (!window.productsService?.searchByTokenIndex) {
                return [];
            }

            if (!navigator.onLine) {
                showToast('offline: busca completa requer internet', 'warning');
                return [];
            }

            try {
                return await window.productsService.searchByTokenIndex(termo, { limit: 50 });
            } catch (error) {
                console.warn('⚠️ Falha ao carregar busca abrangente:', error);
                return [];
            }
        }

        async function buscarProdutosTypeahead(termo) {
            const searchInput = document.getElementById('p_banco_busca');
            const filtro = normalizeTexto(termo);

            if (!filtro || filtro.length < 2) {
                renderProdutoResultados([], '', false);
                return;
            }

            try {
                renderProdutoResultados([], 'Carregando...', true);
                produtoResultados = await fetchProdutosByTerm(filtro);
                renderProdutoResultados(produtoResultados, 'Nenhum produto encontrado', true);

                const resultados = document.getElementById('p_banco_resultados');
                if (resultados && searchInput && searchInput.value.trim()) {
                    resultados.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Erro ao buscar produtos:', error);
                renderProdutoResultados([], 'Nenhum produto encontrado', true);
            }
        }

        function renderProdutoResultados(resultados, mensagemVazia = 'Nenhum produto encontrado', mostrar = true) {
            const container = document.getElementById('p_banco_resultados');
            if (!container) {
                return;
            }

            const items = [];
            items.push(`
                <button type="button" class="produto-resultado-item produto-resultado-novo" onclick="openProdutoNovoModal()">
                    <span>+ Produto novo</span>
                </button>
            `);

            if (!resultados || resultados.length === 0) {
                items.push(`<div class="produto-resultado-empty">${mensagemVazia}</div>`);
            } else {
                items.push(
                    resultados.map((produto, idx) => {
                        const tipoLabel = getProdutoTipoLabel(produto.tipoProduto || produto.tipo);
                        return `
                        <button type="button" class="produto-resultado-item" onclick="selecionarProdutoResultado(${idx})">
                            <div>
                                <strong>${produto.nomeComercial || 'Produto'}</strong>
                                ${produto.empresa ? `<span class="produto-resultado-empresa">${produto.empresa}</span>` : ''}
                                <div class="text-xs text-slate-500 mt-1">Tipo: ${tipoLabel}</div>
                            </div>
                            <span class="produto-resultado-badge ${produto.source === 'usuario' ? 'badge-user' : 'badge-catalogo'}">
                                ${produto.source === 'usuario' ? 'Meu produto' : 'Catálogo'}
                            </span>
                        </button>
                    `;
                    }).join('')
                );
            }

            container.innerHTML = items.join('');
            if (mostrar) {
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        }

        window.openProdutoNovoModal = () => {
            const modal = document.getElementById('modal-produto-novo');
            if (!modal) return;
            document.getElementById('novo_produto_nome').value = '';
            document.getElementById('novo_produto_empresa').value = '';
            document.getElementById('novo_produto_tipo').value = '';
            document.getElementById('novo_produto_ph').value = '';
            document.getElementById('novo_produto_url').value = '';
            modal.classList.remove('hidden');
            updateProdutoNovoSaveState();
            document.getElementById('novo_produto_nome').focus();

            const tipoSelect = document.getElementById('novo_produto_tipo');
            if (tipoSelect && !tipoSelect.dataset.listener) {
                tipoSelect.addEventListener('change', updateProdutoNovoSaveState);
                tipoSelect.addEventListener('change', () => {
                    tipoSelect.dataset.touched = 'true';
                });
                tipoSelect.dataset.listener = 'true';
            }
            if (tipoSelect) {
                tipoSelect.dataset.touched = 'false';
            }
        };

        window.closeProdutoNovoModal = () => {
            const modal = document.getElementById('modal-produto-novo');
            if (!modal) return;
            modal.classList.add('hidden');
        };

        window.salvarProdutoUsuario = async () => {
            if (!currentUserData?.uid) {
                showToast('❌ Faça login para salvar produtos', 'error');
                return;
            }

            const nome = document.getElementById('novo_produto_nome').value.trim();
            const empresa = document.getElementById('novo_produto_empresa').value.trim();
            const tipoProduto = document.getElementById('novo_produto_tipo').value.trim();
            const phValor = parsePhValue(document.getElementById('novo_produto_ph').value);
            const urlFispq = document.getElementById('novo_produto_url').value.trim();

            if (!nome || !empresa) {
                showToast('❌ Informe nome comercial e empresa', 'error');
                return;
            }
            if (!tipoProduto) {
                const tipoSelect = document.getElementById('novo_produto_tipo');
                if (tipoSelect) {
                    tipoSelect.dataset.touched = 'true';
                }
                updateProdutoNovoSaveState();
                showToast('❌ Selecione o tipo de produto', 'error');
                return;
            }
            if (Number.isFinite(phValor) && (phValor < 0 || phValor > 14)) {
                showToast('❌ O pH do produto deve estar entre 0 e 14', 'error');
                return;
            }

            try {
                await window.productsService.saveUserProdutoRTDB({
                    nomeComercial: nome,
                    empresa: empresa,
                    tipoProduto: tipoProduto,
                    phFispq: Number.isFinite(phValor) ? phValor : null,
                    urlFispq: urlFispq || ''
                });

                showToast('✅ Produto salvo no seu catálogo pessoal', 'success');

                if (isUserAdmin) {
                    try {
                        await window.productsService.saveGlobalProdutoRTDB({
                            nomeComercial: nome,
                            empresa: empresa,
                            tipoProduto: tipoProduto,
                            phFispq: Number.isFinite(phValor) ? phValor : null,
                            urlFispq: urlFispq || ''
                        });
                        showToast('✅ Produto salvo no catálogo global', 'success');
                    } catch (error) {
                        console.error('Erro ao salvar no catálogo global:', error);
                        showToast('❌ Erro ao salvar no catálogo global', 'error');
                    }
                } else {
                    showToast('⚠️ Sem permissão para salvar no catálogo global', 'warning');
                }

                document.getElementById('p_nome').value = nome;
                document.getElementById('p_marca').value = empresa;
                const tipoSelect = document.getElementById('p_tipo');
                if (tipoSelect) {
                    tipoSelect.value = tipoProduto;
                }
                document.getElementById('p_ph').value = formatPhValue(phValor);
                document.getElementById('p_url_fispq').value = urlFispq;
                updateFispqLink();

                const searchInput = document.getElementById('p_banco_busca');
                if (searchInput) {
                    if (!searchInput.value.trim()) {
                        searchInput.value = `${nome} (${empresa})`;
                    }
                    buscarProdutosTypeahead(searchInput.value);
                }

                document.getElementById('novo_produto_nome').value = '';
                document.getElementById('novo_produto_empresa').value = '';
                document.getElementById('novo_produto_tipo').value = '';
                document.getElementById('novo_produto_ph').value = '';
                document.getElementById('novo_produto_url').value = '';
                updateProdutoNovoSaveState();
                closeProdutoNovoModal();
            } catch (error) {
                const errorCode = (error?.code || error?.name || 'erro').toString();
                const shortCode = errorCode.replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase() || 'erro';
                const isPermission = errorCode.toUpperCase().includes('PERMISSION');
                if (isPermission) {
                    showToast('❌ Sem permissão para gravar no banco', 'error');
                } else {
                    showToast(`❌ Erro ao salvar produto. Verifique conexão/permissões. (${shortCode})`, 'error');
                }
                console.error('Erro ao salvar produto:', error);
            }
        };

        window.updateFispqLink = () => {
            const url = document.getElementById('p_url_fispq')?.value?.trim();
            const container = document.getElementById('p_fispq_link');
            if (!container) return;

            const safeUrl = sanitizeUrl(url);
            if (safeUrl) {
                container.innerHTML = `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">FISPQ</a>`;
            } else {
                container.textContent = 'FISPQ: não informado';
            }
        };

        function getApiBase() {
            if (!shouldUseRemoteApi()) {
                return '';
            }
            return window.API_BASE || '';
        }

        async function fetchJson(url, options = {}) {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`Erro ao acessar ${url}: ${response.status}`);
            }
            return response.json();
        }

        // ============================================
        // OUTBOX LOCAL (IndexedDB) PARA SYNC FIREBASE
        // ============================================
        const OutboxSync = {
            DB_NAME: 'caldacerta-outbox',
            DB_VERSION: 1,
            STORE_NAME: 'outbox_local',

            _openDB() {
                return new Promise((resolve, reject) => {
                    const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
                    req.onupgradeneeded = (event) => {
                        const localDb = event.target.result;
                        if (!localDb.objectStoreNames.contains(this.STORE_NAME)) {
                            const store = localDb.createObjectStore(this.STORE_NAME, {
                                keyPath: 'id',
                                autoIncrement: true
                            });
                            store.createIndex('status', 'status', { unique: false });
                            store.createIndex('createdAt', 'createdAt', { unique: false });
                        }
                    };
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
            },

            async addToOutbox(operationType, payload) {
                const localDb = await this._openDB();
                return new Promise((resolve, reject) => {
                    const tx = localDb.transaction(this.STORE_NAME, 'readwrite');
                    tx.objectStore(this.STORE_NAME).add({
                        operationType,
                        payload,
                        status: 'pending',
                        createdAt: new Date().toISOString(),
                        attempts: 0
                    });
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
            },

            async _getPendingItems() {
                const localDb = await this._openDB();
                return new Promise((resolve, reject) => {
                    const tx = localDb.transaction(this.STORE_NAME, 'readonly');
                    const store = tx.objectStore(this.STORE_NAME);
                    const index = store.indexNames.contains('status') ? store.index('status') : null;
                    const req = index
                        ? index.getAll('pending')
                        : store.getAll();

                    req.onsuccess = () => {
                        const result = req.result || [];
                        resolve(index ? result : result.filter((item) => item.status === 'pending'));
                    };
                    req.onerror = () => reject(req.error);
                });
            },

            async countPendingItems() {
                const localDb = await this._openDB();
                return new Promise((resolve, reject) => {
                    const tx = localDb.transaction(this.STORE_NAME, 'readonly');
                    const store = tx.objectStore(this.STORE_NAME);
                    const index = store.indexNames.contains('status') ? store.index('status') : null;
                    const req = index ? index.count('pending') : store.getAll();

                    req.onsuccess = () => {
                        if (index) {
                            resolve(req.result || 0);
                            return;
                        }

                        const allItems = req.result || [];
                        resolve(allItems.filter((item) => item.status === 'pending').length);
                    };
                    req.onerror = () => reject(req.error);
                });
            },

            async sendToFirebase(operationType, payload) {
                if (!payload?.uid || !payload?.mixId) {
                    throw new Error('Payload inválido para sincronização');
                }

                const { uid, mixId, data } = payload;
                if (operationType === 'UPSERT_MISTURA') {
                    await db.ref(`/usuarios/${uid}/misturas/${mixId}`).set(data);
                    return;
                }

                if (operationType === 'UPSERT_SNAPSHOT') {
                    await db.ref(`/usuarios/${uid}/misturas/${mixId}/reportSnapshot`).set(data);
                    return;
                }

                if (operationType === 'UPSERT_INDEX') {
                    await db.ref(`/usuarios/${uid}/mix_index/${mixId}`).set(data);
                    return;
                }

                throw new Error(`Tipo de operação não suportado: ${operationType}`);
            },

            async processOutbox() {
                if (!navigator.onLine) {
                    document.dispatchEvent(new CustomEvent('outbox-processed'));
                    return 0;
                }

                const pending = await this._getPendingItems();
                if (!pending.length) {
                    document.dispatchEvent(new CustomEvent('outbox-processed'));
                    return 0;
                }

                const localDb = await this._openDB();
                let doneCount = 0;

                for (const item of pending) {
                    try {
                        await this.sendToFirebase(item.operationType, item.payload);
                        const tx = localDb.transaction(this.STORE_NAME, 'readwrite');
                        tx.objectStore(this.STORE_NAME).put({ ...item, status: 'done' });
                        await new Promise((resolve, reject) => {
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => reject(tx.error);
                        });
                        doneCount++;
                    } catch (_) {
                        const attempts = (item.attempts || 0) + 1;
                        const status = attempts >= 5 ? 'failed' : 'pending';
                        const tx = localDb.transaction(this.STORE_NAME, 'readwrite');
                        tx.objectStore(this.STORE_NAME).put({ ...item, attempts, status });
                        await new Promise((resolve, reject) => {
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => reject(tx.error);
                        });
                    }
                }

                document.dispatchEvent(new CustomEvent('outbox-processed'));
                return doneCount;
            }
        };

        async function updateSyncIndicator() {
            const icon = document.getElementById('sync-status-icon');
            if (!icon) return;

            let pending = 0;
            try {
                pending = await OutboxSync.countPendingItems();
            } catch (_) {
                pending = 0;
            }

            if (!navigator.onLine) {
                icon.textContent = '✗';
                icon.style.color = '#B71C1C';
                icon.title = 'Sem internet';
            } else if (pending > 0) {
                icon.textContent = '⏳';
                icon.style.color = '#E65100';
                icon.title = `${pending} pendentes`;
            } else {
                icon.textContent = '☁';
                icon.style.color = '#2E7D32';
                icon.title = 'Sincronizado';
            }
        }

        function initSyncIndicator() {
            updateSyncIndicator();
            setInterval(updateSyncIndicator, 5000);
            window.addEventListener('online', updateSyncIndicator);
            window.addEventListener('offline', updateSyncIndicator);
            document.addEventListener('outbox-processed', updateSyncIndicator);
        }

        async function enqueueSimulationOutbox(mixId, payload) {
            if (!currentUserData?.uid || !mixId) return;

            const indexPayload = {
                mixId,
                clienteNome: payload?.cliente || '',
                dataAplicacao: payload?.data_aplicacao || '',
                status: 'finalized',
                updatedAt: new Date().toISOString()
            };

            const snapshotPayload = payload?.reportSnapshot || null;

            await OutboxSync.addToOutbox('UPSERT_MISTURA', {
                uid: currentUserData.uid,
                mixId,
                data: payload
            });

            await OutboxSync.addToOutbox('UPSERT_INDEX', {
                uid: currentUserData.uid,
                mixId,
                data: indexPayload
            });

            if (snapshotPayload) {
                await OutboxSync.addToOutbox('UPSERT_SNAPSHOT', {
                    uid: currentUserData.uid,
                    mixId,
                    data: snapshotPayload
                });
            }
        }

        // ============================================
        // OFFLINE SYNC QUEUE (IndexedDB)
        // ============================================
        const OfflineSync = {
            DB_NAME: 'caldacerta-sync',
            DB_VERSION: 1,
            STORE_NAME: 'pending-sync',

            _openDB() {
                return new Promise((resolve, reject) => {
                    const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
                    req.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                            db.createObjectStore(this.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                        }
                    };
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
            },

            async enqueue(url, method, headers, body) {
                const db = await this._openDB();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(this.STORE_NAME, 'readwrite');
                    tx.objectStore(this.STORE_NAME).add({
                        url,
                        method,
                        headers,
                        body,
                        createdAt: new Date().toISOString()
                    });
                    tx.oncomplete = () => {
                        console.log('[OfflineSync] Requisição enfileirada:', method, url);
                        resolve();
                    };
                    tx.onerror = () => reject(tx.error);
                });
            },

            async getPendingCount() {
                const db = await this._openDB();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(this.STORE_NAME, 'readonly');
                    const req = tx.objectStore(this.STORE_NAME).count();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
            },

            async processQueue() {
                const db = await this._openDB();
                const tx = db.transaction(this.STORE_NAME, 'readonly');
                const store = tx.objectStore(this.STORE_NAME);

                const items = await new Promise((resolve, reject) => {
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                if (items.length === 0) return 0;

                console.log(`[OfflineSync] Processando ${items.length} requisições pendentes...`);
                let synced = 0;

                for (const item of items) {
                    try {
                        const res = await fetch(item.url, {
                            method: item.method,
                            headers: item.headers,
                            body: item.body
                        });
                        if (res.ok) {
                            const delTx = db.transaction(this.STORE_NAME, 'readwrite');
                            delTx.objectStore(this.STORE_NAME).delete(item.id);
                            await new Promise((r) => { delTx.oncomplete = r; });
                            synced++;
                        }
                    } catch (err) {
                        console.warn('[OfflineSync] Falha ao sincronizar item:', item.id, err);
                    }
                }

                if (synced > 0) {
                    console.log(`[OfflineSync] ${synced} requisições sincronizadas com sucesso`);
                    if (typeof showToast === 'function') {
                        showToast(`✅ ${synced} simulação(ões) sincronizada(s) com o servidor`, 'success');
                    }
                    if (typeof loadHistory === 'function') {
                        loadHistory();
                    }
                }
                return synced;
            }
        };

        // Sincronizar quando voltar online
        window.addEventListener('online', async () => {
            console.log('[Offline] Conexão restaurada - sincronizando...');
            await syncPendingData();
            await OfflineSync.processQueue();
            await OutboxSync.processOutbox();
        });

        window.addEventListener('offline', () => {
            handleOfflineMode();
        });

        document.addEventListener('DOMContentLoaded', async () => {
            if (navigator.onLine) {
                await syncPendingData();
                await OutboxSync.processOutbox();
            }
        });

        async function loadHistoryFromServer() {
            if (!shouldUseRemoteApi()) {
                return [];
            }
            const base = getApiBase();
            const uidParam = !isUserAdmin && currentUserData ? `?uid=${encodeURIComponent(currentUserData.uid)}` : '';
            const url = `${base}/api/simulacoes${uidParam}`;
            const data = await fetchJson(url);
            if (!Array.isArray(data)) {
                throw new Error('Resposta inválida da API de simulações');
            }
            return data;
        }

        async function loadHistoryFromFirebase() {
            if (!currentUserData) {
                return [];
            }

            if (isUserAdmin) {
                const histRef = db.ref('simulacoes');
                const snapshot = await histRef.once('value');
                const data = snapshot.val() || {};
                const allItems = [];

                Object.entries(data).forEach(([uid, sims]) => {
                    if (!sims || typeof sims !== 'object') return;
                    Object.entries(sims).forEach(([id, sim]) => {
                        if (!sim || typeof sim !== 'object') return;
                        allItems.push({
                            id,
                            uid,
                            ...sim
                        });
                    });
                });

                console.log(`✅ ${allItems.length} simulações carregadas (modo admin)`);
                return allItems;
            }

            const histRef = db.ref('simulacoes/' + currentUserData.uid);
            const snapshot = await histRef.once('value');
            const data = snapshot.val() || {};
            const items = Object.keys(data).map(key => ({
                id: key,
                uid: currentUserData.uid,
                ...data[key]
            }));

            if (items.length > 0) {
                console.log(`✅ ${items.length} simulações carregadas do Firebase`);
                return items;
            }

            const legacyRef = db.ref('simulacoes');
            const legacySnapshot = await legacyRef.once('value');
            const legacyData = legacySnapshot.val() || {};
            const legacyItems = Object.entries(legacyData)
                .filter(([, sim]) => sim && typeof sim === 'object' && (sim.userEmail || sim.uid))
                .filter(([, sim]) => sim.userEmail === currentUserData.email || sim.uid === currentUserData.uid)
                .map(([id, sim]) => ({
                    id,
                    uid: sim.uid || '',
                    ...sim
                }));

            console.log(`✅ ${legacyItems.length} simulações carregadas do Firebase (legacy)`);
            return legacyItems;
        }

        async function loadHistory() {
            try {
                if (!currentUserData) {
                    historicalData = [];
                    renderHistoryList(historicalData);
                    return;
                }

                // Firebase é a fonte primária de dados
                try {
                    historicalData = await loadHistoryFromFirebase();
                    console.log(`✅ ${historicalData.length} simulações carregadas do Firebase`);
                    if (offlineDb && historicalData.length > 0) {
                        await offlineDb.saveSimulations(historicalData);
                    }
                } catch (error) {
                    console.warn('⚠️ Falha ao carregar do Firebase:', error);
                    historicalData = [];
                }

                if (historicalData.length === 0 && offlineDb) {
                    historicalData = await offlineDb.getSimulationsByUser(currentUserData.uid);
                    if (historicalData.length > 0) {
                        console.log(`✅ ${historicalData.length} simulações carregadas do IndexedDB`);
                    }
                }

                // Se Firebase vazio, tentar servidor como fallback
                if (historicalData.length === 0) {
                    try {
                        const serverData = await loadHistoryFromServer();
                        if (serverData.length > 0) {
                            console.log(`✅ ${serverData.length} simulações encontradas no servidor (fallback)`);
                            historicalData = serverData;
                        }
                    } catch (e) {
                        console.warn('⚠️ Servidor indisponível:', e.message);
                    }
                }

                // Ordenar por data mais recente
                historicalData.sort((a, b) => {
                    const dateA = new Date(a.updatedAt || a.createdAt || a.data_aplicacao || 0);
                    const dateB = new Date(b.updatedAt || b.createdAt || b.data_aplicacao || 0);
                    return dateB - dateA;
                });

                renderHistoryList(historicalData);
            } catch (e) {
                console.error('Erro ao carregar histórico:', e);
                historicalData = [];
                renderHistoryList(historicalData);
            }
        }

        function sortProductsByHierarchy(products, criterio = 'tipo') {
            const hierarchy = {
                'adjuvante': 1,
                'calcita': 2,
                'fertilizante': 3,
                'oleo': 4,
                'outros': 2,
                'herbicida': 2,
                'fungicida': 2,
                'inseticida': 2,
                'acaricida': 2,
                'biologico': 2
            };

            return [...products].sort((a, b) => {
                const tipoA = resolveProdutoTipo(a);
                const tipoB = resolveProdutoTipo(b);
                const prioA = hierarchy[tipoA] || hierarchy[a.tipo] || hierarchy[a.formulacao] || 2;
                const prioB = hierarchy[tipoB] || hierarchy[b.tipo] || hierarchy[b.formulacao] || 2;

                if (prioA !== prioB) return prioA - prioB;

                if (prioA === 2 && prioB === 2) {
                    if (criterio === 'ph-crescente') {
                        const phA = a.ph || 7;
                        const phB = b.ph || 7;
                        return phA - phB;
                    } else if (criterio === 'ph-decrescente') {
                        const phA = a.ph || 7;
                        const phB = b.ph || 7;
                        return phB - phA;
                    } else {
                        return (a.formulacao || '').localeCompare(b.formulacao || '');
                    }
                }

                return 0;
            });
        }

        function sortProductsByFispq(products) {
            return [...products].sort((a, b) => {
                const phA = Number.isFinite(Number(a?.ph)) ? Number(a.ph) : Number.POSITIVE_INFINITY;
                const phB = Number.isFinite(Number(b?.ph)) ? Number(b.ph) : Number.POSITIVE_INFINITY;
                if (phA !== phB) return phA - phB;
                return (a?.nome || '').localeCompare(b?.nome || '');
            });
        }

        function getCurrentOrderMode() {
            const mode = document.getElementById('orderMode')?.value;
            if (mode === 'auto' || mode === 'manual' || mode === 'fispq') {
                return mode;
            }
            const legacy = document.getElementById('respeitarHierarquia');
            return legacy?.checked ? 'auto' : 'manual';
        }

        function getDisplayProductsByMode(mode) {
            const criterio = document.getElementById('criterioOrdenacao').value;
            if (mode === 'auto') {
                return sortProductsByHierarchy(products, criterio);
            }
            if (mode === 'fispq') {
                return sortProductsByFispq(products);
            }
            return [...products];
        }

        function syncLegacyHierarchyFlag(mode) {
            const legacy = document.getElementById('respeitarHierarquia');
            if (legacy) legacy.checked = mode === 'auto';
        }

        window.toggleHierarchyOptions = () => {
            const mode = getCurrentOrderMode();
            syncLegacyHierarchyFlag(mode);
            const options = document.getElementById('hierarchyOptions');
            options.style.display = mode === 'auto' ? 'block' : 'none';
            renderOrdem();
        };

        function validateRequiredField(id, message) {
            const field = document.getElementById(id);
            if (!field) return true;
            if (!field.value || field.value.toString().trim() === '') {
                showToast(message, 'error');
                field.focus();
                return false;
            }
            return true;
        }

        function validatePositiveNumber(id, message) {
            const field = document.getElementById(id);
            if (!field) return true;
            const value = parseFloat(field.value);
            if (!Number.isFinite(value) || value <= 0) {
                showToast(message, 'error');
                field.focus();
                return false;
            }
            return true;
        }

        function validateRange(id, min, max, message) {
            const field = document.getElementById(id);
            if (!field) return true;
            const value = parseFloat(field.value);
            if (!Number.isFinite(value)) return true;
            if (value < min || value > max) {
                showToast(message, 'error');
                field.focus();
                return false;
            }
            return true;
        }

        function syncProductObservationsFromDom() {
            const inputs = document.querySelectorAll('.observacao-input');
            if (!inputs.length) return;

            inputs.forEach(input => {
                const productId = input.dataset.productId;
                const product = products.find(p => String(p.id) === String(productId));
                if (product) {
                    product.observacao = input.value;
                }
            });
        }

        async function saveSimulationToServer(payload) {
            if (!shouldUseRemoteApi()) {
                return { skipped: true };
            }
            const base = getApiBase();
            const now = new Date().toISOString();
            const body = {
                ...payload,
                uid: currentUserData?.uid || null,
                userEmail: currentUserData?.email || '',
                updatedAt: now,
                createdAt: now
            };

            const url = `${base}/api/simulacoes`;
            const headers = { 'Content-Type': 'application/json' };
            const bodyStr = JSON.stringify(body);

            // Se estiver offline, enfileirar para sincronização posterior (backup silencioso)
            if (!navigator.onLine) {
                await OfflineSync.enqueue(url, 'POST', headers, bodyStr);
                return { queued: true };
            }

            return fetchJson(url, { method: 'POST', headers, body: bodyStr });
        }

        // Função interna para construir o payload do formulário
        function _buildSimulationPayload() {
            syncProductObservationsFromDom();
            return {
                cliente: document.getElementById('id_cliente').value,
                propriedade: document.getElementById('id_propriedade').value,
                talhao: document.getElementById('id_talhao').value,
                cultura: document.getElementById('id_cultura').value,
                data_aplicacao: document.getElementById('id_data').value,
                area: parseFloat(document.getElementById('id_area').value) || 0,
                responsavel: document.getElementById('id_responsavel').value,
                objetivo: document.getElementById('id_objetivo').value,
                tanque_capacidade: parseFloat(document.getElementById('eq_tanque').value) || 0,
                vazao: parseFloat(document.getElementById('eq_vazao').value) || 0,
                operador: document.getElementById('eq_operador').value,
                rendimento: parseFloat(document.getElementById('res_rendimento').innerText) || 0,
                agua_ph: parseFloat(document.getElementById('agua_ph').value) || null,
                agua_dureza: parseFloat(document.getElementById('agua_dureza').value) || null,
                agua_origem: document.getElementById('agua_origem').value,
                agua_observacoes: document.getElementById('agua_obs').value,
                calda_ph: parseFloat(document.getElementById('calda_ph').value) || null,
                jarra_volume: parseInt(document.getElementById('jarra_vol').value),
                order_mode: getCurrentOrderMode(),
                respeitar_hierarquia: getCurrentOrderMode() === 'auto' ? 1 : 0,
                criterio_ordenacao: document.getElementById('criterioOrdenacao').value,
                produtos: products
            };
        }

        // Função interna para salvar payload no Firebase (fonte primária)
        async function _savePayloadToFirebase(payload) {
            if (!currentUserData) {
                throw new Error('Usuário não autenticado');
            }

            const now = new Date().toISOString();
            const isEditing = currentEditingSimulation &&
                (isUserAdmin || currentEditingSimulation.uid === currentUserData.uid);
            const mixId = (isEditing && currentEditingSimulation?.id)
                ? currentEditingSimulation.id
                : db.ref(`usuarios/${currentUserData.uid}/misturas`).push().key;

            const localSimulationRecord = {
                id: mixId,
                uid: currentUserData.uid,
                userEmail: currentUserData.email,
                ...payload,
                updatedAt: now,
                createdAt: currentEditingSimulation?.createdAt || now
            };

            if (!navigator.onLine) {
                await persistSimulationLocal(localSimulationRecord);
                await enqueueSimulationOutbox(mixId, payload);
                await enqueueSyncQueue(isEditing ? 'update' : 'create', `simulacoes/${currentUserData.uid}/${mixId}`, localSimulationRecord);
                currentEditingSimulation = null;
                return;
            }

            if (isEditing && currentEditingSimulation?.id) {
                const editUid = currentEditingSimulation.uid || currentUserData.uid;
                await db.ref(`simulacoes/${editUid}/${currentEditingSimulation.id}`).update({
                    ...payload,
                    userEmail: currentEditingSimulation.userEmail || currentUserData.email,
                    updatedAt: now,
                    createdAt: currentEditingSimulation.createdAt || now
                });
            } else {
                await db.ref(`simulacoes/${currentUserData.uid}/${mixId}`).set(localSimulationRecord);
            }

            await persistSimulationLocal(localSimulationRecord);
            currentEditingSimulation = null;

            try {
                await OutboxSync.sendToFirebase('UPSERT_MISTURA', {
                    uid: currentUserData.uid,
                    mixId,
                    data: payload
                });

                await OutboxSync.sendToFirebase('UPSERT_INDEX', {
                    uid: currentUserData.uid,
                    mixId,
                    data: {
                        mixId,
                        clienteNome: payload?.cliente || '',
                        dataAplicacao: payload?.data_aplicacao || '',
                        status: 'finalized',
                        updatedAt: now
                    }
                });

                if (payload?.reportSnapshot) {
                    await OutboxSync.sendToFirebase('UPSERT_SNAPSHOT', {
                        uid: currentUserData.uid,
                        mixId,
                        data: payload.reportSnapshot
                    });
                }
            } catch (syncError) {
                console.warn('⚠️ Falha no sync secundário de usuários. Enfileirando:', syncError);
                await enqueueSimulationOutbox(mixId, payload);
            }

            // Tentar salvar no servidor também como backup (não bloqueia)
            saveSimulationToServer(payload).catch(e => {
                console.warn('⚠️ Backup no servidor falhou (Firebase é primário):', e.message);
            });
        }

        // Validação dos campos do formulário
        function _validateSimulationFields() {
            if (!validateRequiredField('id_cliente', '❌ Preencha o nome do cliente')) return false;
            if (!validateRequiredField('id_cultura', '❌ Selecione a cultura')) return false;
            if (!validatePositiveNumber('id_area', '❌ Informe uma área válida')) return false;
            if (!validatePositiveNumber('eq_tanque', '❌ Informe a capacidade do tanque')) return false;
            if (!validatePositiveNumber('eq_vazao', '❌ Informe a vazão do equipamento')) return false;
            if (!validateRange('agua_ph', 0, 14, '❌ O pH da água deve estar entre 0 e 14')) return false;
            if (!validateRange('calda_ph', 0, 14, '❌ O pH da calda deve estar entre 0 e 14')) return false;
            if (products.length === 0) {
                showToast('❌ Adicione pelo menos um produto', 'error');
                return false;
            }
            if (!currentUserData) {
                showToast('❌ Você precisa estar logado!', 'error');
                return false;
            }
            return true;
        }

        window.saveSimulation = async () => {
            if (!_validateSimulationFields()) return;

            const btn = document.getElementById('btn-save-cloud');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

            try {
                const payload = _buildSimulationPayload();

                // Firebase é a fonte primária de dados
                await _savePayloadToFirebase(payload);

                showToast('✅ Simulação salva com sucesso!', 'success');
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvo com Sucesso';
                btn.classList.add('opacity-50');

                await loadHistory();
                await initBancosDados();
            } catch (e) {
                console.error('Erro ao salvar:', e);
                showToast('❌ Erro ao salvar simulação', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-save text-xl"></i> Salvar Simulação';
            }
        };

        function getProdutoCount(item) {
            if (item.produtos_nomes) {
                return item.produtos_nomes.split('|').length;
            }
            if (Array.isArray(item.produtos)) {
                return item.produtos.length;
            }
            return 0;
        }

        function renderHistoryList(data) {
            const list = document.getElementById('history-list');
            const empty = document.getElementById('history-empty');

            if (data.length === 0) {
                list.innerHTML = '';
                empty.classList.remove('hidden');
                return;
            }

            empty.classList.add('hidden');
            list.innerHTML = data.map(item => {
                const date = item.data_aplicacao ? new Date(item.data_aplicacao).toLocaleDateString('pt-BR') : 'Data não informada';
                const prodCount = getProdutoCount(item);
                const safeId = escapeHtml(item.id);
                const safeUid = escapeHtml(item.uid || '');
                const adminInfo = isUserAdmin ? `<span class="badge badge-accent">Usuário: ${escapeHtml(item.userEmail || item.uid || 'N/D')}</span>` : '';

                // Todos os usuários podem editar suas próprias simulações
                const editButton = `
                    <button class="btn btn-secondary text-xs" onclick="event.stopPropagation(); viewSimulation('${safeId}', '${safeUid}')">
                        <i class="fa-solid fa-pen mr-1"></i> Editar
                    </button>
                `;

                return `
                    <div class="card card-medium history-card" onclick="viewSimulation('${safeId}', '${safeUid}')">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h4 class="font-black text-xl text-slate-800 mb-1">${escapeHtml(item.cliente || 'Sem cliente')}</h4>
                                <p class="text-sm text-slate-600">${escapeHtml(item.propriedade || '')} - ${escapeHtml(item.talhao || '')}</p>
                            </div>
                            <div class="flex flex-col items-end gap-2">
                                <span class="badge badge-primary">${escapeHtml(item.cultura || 'N/D')}</span>
                                ${editButton}
                            </div>
                        </div>
                        <div class="history-meta text-sm text-slate-500">
                            <span><i class="fa-solid fa-calendar mr-1"></i>${escapeHtml(date)}</span>
                            <span><i class="fa-solid fa-map-marked-alt mr-1"></i>${escapeHtml(String(item.area || 0))} ha</span>
                            <span><i class="fa-solid fa-box mr-1"></i>${prodCount} produto${prodCount !== 1 ? 's' : ''}</span>
                        </div>
                        ${adminInfo ? `<div class="mt-2 text-xs text-slate-500">${adminInfo}</div>` : ''}
                    </div>
                `;
            }).join('');
        }

        window.filterHistory = () => {
            const query = document.getElementById('search-history').value.toLowerCase();
            const filtered = historicalData.filter(item => {
                const cliente = (item.cliente || '').toLowerCase();
                const propriedade = (item.propriedade || '').toLowerCase();
                const cultura = (item.cultura || '').toLowerCase();
                const talhao = (item.talhao || '').toLowerCase();
                const usuario = (item.userEmail || item.uid || '').toLowerCase();
                return cliente.includes(query) || propriedade.includes(query) || cultura.includes(query) || talhao.includes(query) || usuario.includes(query);
            });
            renderHistoryList(filtered);
        };

        async function fetchSimulationFromServer(id, uidOverride = '') {
            if (!shouldUseRemoteApi()) {
                return null;
            }
            const base = getApiBase();
            const uidParam = uidOverride ? `?uid=${encodeURIComponent(uidOverride)}` : '';
            const url = `${base}/api/simulacoes/${id}${uidParam}`;
            return fetchJson(url);
        }

        window.viewSimulation = async (id, uidOverride = '') => {
            try {
                if (!currentUserData) {
                    showToast('❌ Você precisa estar logado!', 'error');
                    return;
                }

                const ownerUid = uidOverride || currentUserData.uid;
                let item = null;

                // Firebase é a fonte primária
                if (navigator.onLine) {
                    const simRef = db.ref('simulacoes/' + ownerUid + '/' + id);
                    const snapshot = await simRef.once('value');
                    item = snapshot.val();
                }

                if (!item && offlineDb) {
                    item = await offlineDb.dbGet(offlineDb.STORES.SIMULATIONS, id);
                }

                // Fallback: estrutura legada
                if (!item) {
                    const legacyRef = db.ref('simulacoes/' + id);
                    const legacySnapshot = await legacyRef.once('value');
                    item = legacySnapshot.val();
                }

                // Fallback: servidor
                if (!item) {
                    try {
                        item = await fetchSimulationFromServer(id, ownerUid);
                    } catch (error) {
                        console.warn('⚠️ Servidor indisponível:', error.message);
                    }
                }

                if (!item) {
                    showToast('❌ Simulação não encontrada', 'error');
                    return;
                }

                document.getElementById('id_cliente').value = item.cliente;
                document.getElementById('id_propriedade').value = item.propriedade;
                document.getElementById('id_talhao').value = item.talhao || '';
                document.getElementById('id_area').value = item.area;
                document.getElementById('id_data').value = item.data_aplicacao;
                document.getElementById('id_cultura').value = item.cultura;
                document.getElementById('id_responsavel').value = item.responsavel || '';
                document.getElementById('id_objetivo').value = item.objetivo || '';
                document.getElementById('eq_tanque').value = item.tanque_capacidade;
                document.getElementById('eq_vazao').value = item.vazao;
                document.getElementById('eq_operador').value = item.operador || '';
                document.getElementById('jarra_vol').value = item.jarra_volume || 1000;
                const orderMode = item.order_mode || (item.respeitar_hierarquia ? 'auto' : 'manual');
                document.getElementById('orderMode').value = orderMode;
                const legacyHierarchy = document.getElementById('respeitarHierarquia');
                if (legacyHierarchy) legacyHierarchy.checked = !!item.respeitar_hierarquia;
                document.getElementById('criterioOrdenacao').value = item.criterio_ordenacao || 'tipo';

                document.getElementById('agua_ph').value = item.agua_ph || '';
                document.getElementById('agua_dureza').value = item.agua_dureza || '';
                document.getElementById('agua_origem').value = item.agua_origem || 'Poço';
                document.getElementById('agua_obs').value = item.agua_observacoes || '';
                document.getElementById('calda_ph').value = item.calda_ph || '';

                products = (item.produtos || []).map(p => ({
                    id: p.id || (Date.now() + Math.random()),
                    nome: p.produto_nome || p.nome,
                    marca: p.produto_marca || p.marca,
                    dose: p.dose,
                    formulacao: p.formulacao,
                    tipoProduto: resolveProdutoTipo(p),
                    tipo: resolveProdutoTipo(p) || p.tipo,
                    ph: p.ph,
                    urlFispq: p.urlFispq || p.url_fispq || '',
                    observacao: p.observacao || p.observacoes || ''
                }));

                currentEditingSimulation = {
                    id,
                    uid: ownerUid,
                    userEmail: item.userEmail || '',
                    createdAt: item.createdAt || '',
                    source: 'firebase'
                };

                renderProductList();
                maybeWarnProdutoTipoMissing(products);
                calcRendimento();
                toggleHierarchyOptions();
                navTo('2-6');
            } catch (e) {
                console.error('Erro ao carregar simulação:', e);
                showToast('❌ Erro ao carregar simulação', 'error');
            }
        };

        // Navegação
        window.navTo = (id) => {
            currentStepIdx = steps.indexOf(id.replace('step-',''));

            document.querySelectorAll('.step-content').forEach(s => s.classList.remove('active'));
            const target = id === 'history' ? 'step-history' : `step-${steps[currentStepIdx]}`;
            document.getElementById(target).classList.add('active');

            const footer = document.getElementById('app-nav');
            const isMenu = id === 'menu' || id === 'history';
            const isLast = steps[currentStepIdx] === '2-6';

            footer.classList.toggle('hidden', isMenu || isLast);
            document.getElementById('btn-prev').classList.toggle('hidden', currentStepIdx <= 1);

            if (steps[currentStepIdx] === '2-4') {
                initCharts();
                renderClimateTables();
            }
            if (steps[currentStepIdx] === '2-6') {
                const btnSave = document.getElementById('btn-save-cloud');
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.innerHTML = '<i class="fa-solid fa-save text-xl"></i> <span class="font-bold">Salvar</span>';
                    btnSave.classList.remove('opacity-50');
                }
                renderOrdem();
            }

            simulationDraftManager?.scheduleSave?.();
            window.scrollTo({top: 0, behavior: 'smooth'});
        };

        window.handleNext = () => {
            if (currentStepIdx === 1) {
                if (!validateRequiredField('id_cliente', '❌ Preencha o nome do cliente')) {
                    return;
                }
                if (!validateRequiredField('id_cultura', '❌ Selecione a cultura')) {
                    return;
                }
                if (!validatePositiveNumber('id_area', '❌ Informe uma área válida')) {
                    return;
                }
            }

            if (currentStepIdx === 2) {
                if (!validatePositiveNumber('eq_tanque', '❌ Preencha os dados do equipamento')) {
                    return;
                }
                if (!validatePositiveNumber('eq_vazao', '❌ Preencha os dados do equipamento')) {
                    return;
                }
            }

            if (currentStepIdx === 5) {
                if (products.length === 0) {
                    showToast('❌ Adicione pelo menos um produto', 'error');
                    return;
                }
            }

            if (currentStepIdx < steps.length - 1) navTo(steps[currentStepIdx + 1]);
        };

        window.handlePrev = () => {
            if (currentStepIdx > 1) navTo(steps[currentStepIdx - 1]);
        };

        window.startNewSimulation = () => {
            products = [];
            currentEditingSimulation = null;
            renderProductList();
            document.querySelectorAll('input').forEach(i => {
                if (i.type !== 'date' && i.type !== 'checkbox') i.value = "";
            });
            document.querySelectorAll('textarea').forEach(t => t.value = "");
            document.getElementById('id_data').value = new Date().toISOString().split('T')[0];
            document.getElementById('id_cultura').selectedIndex = 0;
            document.getElementById('id_objetivo').selectedIndex = 0;
            document.getElementById('res_rendimento').innerText = "0.0";
            document.getElementById('orderMode').value = 'auto';
            const legacyHierarchy = document.getElementById('respeitarHierarquia');
            if (legacyHierarchy) legacyHierarchy.checked = true;
            navTo('2-1');
            simulationDraftManager?.saveNow?.().catch(() => {});
        };

        // Produtos
        window.addProduto = async () => {
            const nome = document.getElementById('p_nome').value;
            const dose = parseFloat(document.getElementById('p_dose').value);
            const formulacao = document.getElementById('p_formulacao').value;
            const marca = document.getElementById('p_marca').value;
            const tipo = document.getElementById('p_tipo').value;
            const ph = parsePhValue(document.getElementById('p_ph').value);
            const urlFispq = document.getElementById('p_url_fispq').value.trim();

            if (!nome || !Number.isFinite(dose) || dose <= 0) {
                showToast('❌ Preencha nome e dose do produto', 'error');
                return;
            }
            if (ph !== null && (ph < 0 || ph > 14)) {
                showToast('❌ O pH do produto deve estar entre 0 e 14', 'error');
                return;
            }
            if (!tipo) {
                showToast('❌ Selecione o tipo de produto', 'error');
                return;
            }

            const p = {
                id: Date.now(),
                nome: nome,
                marca: marca || 'Não informada',
                dose: dose,
                formulacao: formulacao,
                tipoProduto: tipo,
                tipo: tipo,
                ph: ph,
                urlFispq: urlFispq || ''
            };

            products.push(p);
            renderProductList();

            document.getElementById('p_nome').value = "";
            document.getElementById('p_marca').value = "";
            document.getElementById('p_dose').value = "";
            document.getElementById('p_ph').value = "";
            document.getElementById('p_url_fispq').value = "";
            document.getElementById('p_formulacao').selectedIndex = 0;
            document.getElementById('p_tipo').selectedIndex = 0;
            updateFispqLink();

            const searchInput = document.getElementById('p_banco_busca');
            if (searchInput) {
                searchInput.value = '';
            }
            renderProdutoResultados([], '', false);

            showToast('✅ Produto adicionado à lista', 'success');
            simulationDraftManager?.scheduleSave?.();
        };

        function renderProductList() {
            const lista = document.getElementById('lista-produtos');
            const empty = document.getElementById('produtos-empty');

            if (products.length === 0) {
                lista.innerHTML = '';
                empty.classList.remove('hidden');
                return;
            }

            empty.classList.add('hidden');
            lista.innerHTML = products.map((p, idx) => {
                const safeUrl = sanitizeUrl(p.urlFispq);
                const fispqLink = safeUrl
                    ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">FISPQ</a>`
                    : `<span class="text-xs text-slate-400">FISPQ: não informado</span>`;

                return `
                <div class="product-item">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="badge badge-accent">${idx + 1}</span>
                            <h4 class="font-bold text-slate-800">${escapeHtml(p.nome)}</h4>
                            <span class="badge badge-primary text-xs">${escapeHtml(p.formulacao)}</span>
                        </div>
                        <p class="text-sm text-slate-600">
                            ${escapeHtml(p.marca)} · <span class="font-semibold">${escapeHtml(String(p.dose))}</span> L-Kg/ha
                        </p>
                        <p class="text-sm text-slate-500 mt-1">Tipo: ${escapeHtml(getProdutoTipoLabel(p.tipoProduto || p.tipo))}</p>
                        <p class="text-sm text-slate-600 mt-1">${fispqLink}</p>
                    </div>
                    <button onclick="removeProduct(${p.id})" class="btn btn-icon">
                        <i class="fa-solid fa-trash text-lg"></i>
                    </button>
                </div>
            `;
            }).join('');
        }

        window.removeProduct = (id) => {
            products = products.filter(p => p.id !== id);
            renderProductList();
            showToast('🗑️ Produto removido', 'success');
            simulationDraftManager?.scheduleSave?.();
        };

        // Cálculos
        window.calcRendimento = () => {
            const tanque = parseFloat(document.getElementById('eq_tanque').value) || 0;
            const vazao = parseFloat(document.getElementById('eq_vazao').value) || 0;
            const rendimento = vazao > 0 ? (tanque / vazao).toFixed(2) : "0.0";
            document.getElementById('res_rendimento').innerText = rendimento;
        };

        // Alerta de dureza da água
        window.checkWaterHardness = () => {
            const container = document.getElementById('dureza-alert-container');
            const dureza = parseFloat(document.getElementById('agua_dureza').value);
            if (!container) return;

            if (!Number.isFinite(dureza) || dureza <= 0) {
                container.innerHTML = '';
                return;
            }

            let alertClass, icon, title, message;

            if (dureza <= 150) {
                alertClass = 'alert-success';
                icon = 'fa-circle-check';
                title = 'ÁGUA MOLE (0–150 µS/cm)';
                message = 'Água com baixa condutividade. Condição favorável para a maioria das aplicações de defensivos.';
            } else if (dureza <= 300) {
                alertClass = 'alert-warning';
                icon = 'fa-exclamation-circle';
                title = 'ÁGUA COM CONDUTIVIDADE MODERADA (150–300 µS/cm)';
                message = 'Condutividade moderada. Pode reduzir a eficácia de alguns herbicidas (ex: glifosato). Considere o uso de adjuvantes sequestrantes.';
            } else if (dureza <= 500) {
                alertClass = 'alert-warning';
                icon = 'fa-triangle-exclamation';
                title = 'ÁGUA COM ALTA CONDUTIVIDADE (300–500 µS/cm)';
                message = 'Água dura detectada. Recomenda-se uso de condicionadores de água ou adjuvantes para evitar perda de eficácia dos produtos.';
            } else {
                alertClass = 'alert-danger';
                icon = 'fa-triangle-exclamation';
                title = 'ÁGUA COM CONDUTIVIDADE MUITO ALTA (>500 µS/cm)';
                message = 'Condutividade muito alta! Alto risco de redução na eficácia dos defensivos. Uso de condicionador/adjuvante sequestrante é indispensável.';
            }

            container.innerHTML = `
                <div class="alert ${alertClass}">
                    <i class="fa-solid ${icon} alert-icon"></i>
                    <div>
                        <h4 class="font-bold mb-1">${title}</h4>
                        <p style="font-size: 0.8rem;">${message}</p>
                    </div>
                </div>
            `;
        };

        // Atualizar observação do produto
        window.updateProductObservation = (productId, observacao) => {
            const product = products.find(p => p.id === productId);
            if (product) {
                product.observacao = observacao;
                simulationDraftManager?.scheduleSave?.();
            }
        };

        window.renderOrdem = () => {
            const jarra = parseFloat(document.getElementById('jarra_vol').value);
            const vazao = parseFloat(document.getElementById('eq_vazao').value) || 100;
            const tanque = parseFloat(document.getElementById('eq_tanque').value) || 2000;
            const area = parseFloat(document.getElementById('id_area').value) || 10;
            const container = document.getElementById('ordem-container');
            const mode = getCurrentOrderMode();
            const isManualMode = mode === 'manual';

            if (products.length === 0) {
                container.innerHTML = '<div class="empty-state"><p class="text-slate-500">Nenhum produto adicionado</p></div>';
                return;
            }

            const displayProducts = getDisplayProductsByMode(mode);

            container.innerHTML = displayProducts.map((p, i) => {
                const doseJarra = vazao > 0 ? ((p.dose * jarra) / vazao).toFixed(2) : '0.00';
                const doseTanque = vazao > 0 ? ((p.dose * tanque) / vazao).toFixed(2) : '0.00';
                const volumeTotal = (p.dose * area).toFixed(2);
                const phDisplay = p.ph ? `pH FISPQ: ${p.ph}` : '';
                const observacao = p.observacao || '';

                return `
                    <div class="product-item ordem-card" data-id="${p.id}">
                        <div class="flex-1">
                            <div class="ordem-card-header flex justify-between items-center mb-3">
                                <div class="ordem-card-badges flex items-center gap-3">
                                    <span class="badge badge-primary">Ordem ${i+1}</span>
                                    <span class="badge badge-accent">${escapeHtml(p.formulacao)}</span>
                                    ${phDisplay ? `<span class="badge badge-success">${escapeHtml(phDisplay)}</span>` : ''}
                                </div>
                                ${isManualMode ? `
                                    <div class="flex items-center gap-2">
                                        <button type="button" class="btn btn-secondary ordem-move-up" data-product-id="${p.id}" aria-label="Mover produto para cima" ${i === 0 ? 'disabled' : ''}>
                                            <i class="fa-solid fa-arrow-up"></i>
                                        </button>
                                        <button type="button" class="btn btn-secondary ordem-move-down" data-product-id="${p.id}" aria-label="Mover produto para baixo" ${i === displayProducts.length - 1 ? 'disabled' : ''}>
                                            <i class="fa-solid fa-arrow-down"></i>
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="ordem-card-content">
                                <div class="ordem-card-info">
                                    <h4 class="text-lg font-black text-slate-800 mb-1">${escapeHtml(p.nome)}</h4>
                                    <p class="text-sm text-slate-600">${escapeHtml(p.marca)}</p>
                                </div>
                                <div class="ordem-card-obs">
                                    <textarea
                                        class="observacao-input"
                                        placeholder="Observações do produto..."
                                        data-product-id="${p.id}"
                                        oninput="updateProductObservation('${p.id}', this.value)"
                                    >${observacao}</textarea>
                                </div>
                            </div>
                            <div class="grid gap-2" style="margin-top: 0.75rem;">
                                <div class="dose-box" style="padding: 0.5rem;">
                                    <p class="dose-label" style="font-size: 0.65rem;">Jarra (${jarra}ml)</p>
                                    <p class="dose-value" style="font-size: 1.25rem;">${doseJarra} ml</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.ordem-move-up, .ordem-move-down').forEach(button => {
                button.addEventListener('click', (event) => {
                    const productId = event.currentTarget.dataset.productId;
                    const currentIndex = products.findIndex(item => item.id === productId);
                    if (currentIndex === -1) {
                        return;
                    }

                    const direction = event.currentTarget.classList.contains('ordem-move-up') ? -1 : 1;
                    const newIndex = currentIndex + direction;
                    if (newIndex < 0 || newIndex >= products.length) {
                        return;
                    }

                    const movedItem = products.splice(currentIndex, 1)[0];
                    products.splice(newIndex, 0, movedItem);
                    renderOrdem();
                    simulationDraftManager?.scheduleSave?.();
                    showToast('📦 Ordem atualizada', 'success');
                });
            });
        };

        // Clima
        function checkClimateConditions(deltaTValues) {
            const alertContainer = document.getElementById('alert-container');
            const deltaT = deltaTValues && deltaTValues.length ? deltaTValues : MOCK_DELTA_T;
            const maxDelta = Math.max(...deltaT);
            const minDelta = Math.min(...deltaT);

            let alertHTML = '';

            if (maxDelta > 10) {
                alertHTML += `
                    <div class="alert alert-danger">
                        <i class="fa-solid fa-triangle-exclamation alert-icon"></i>
                        <div>
                            <h4 class="font-bold mb-1">⚠️ CONDIÇÃO CRÍTICA PARA APLICAÇÃO</h4>
                            <p>Delta T acima de 10°C detectado (máx: ${maxDelta}°C). <strong>Não recomendado aplicar!</strong> Alto risco de deriva e evaporação.</p>
                        </div>
                    </div>
                `;
            } else if (maxDelta > 8) {
                alertHTML += `
                    <div class="alert alert-warning">
                        <i class="fa-solid fa-exclamation-circle alert-icon"></i>
                        <div>
                            <h4 class="font-bold mb-1">⚠️ ATENÇÃO: Condição Marginal</h4>
                            <p>Delta T entre 8-10°C (máx: ${maxDelta}°C). Aplicação com cautela. Monitorar ventos e umidade.</p>
                        </div>
                    </div>
                `;
            } else if (minDelta < 2) {
                alertHTML += `
                    <div class="alert alert-warning">
                        <i class="fa-solid fa-exclamation-circle alert-icon"></i>
                        <div>
                            <h4 class="font-bold mb-1">⚠️ ATENÇÃO: Delta T Muito Baixo</h4>
                            <p>Delta T abaixo de 2°C (mín: ${minDelta}°C). Risco de inversão térmica. Evitar aplicação.</p>
                        </div>
                    </div>
                `;
            } else {
                alertHTML += `
                    <div class="alert alert-success">
                        <i class="fa-solid fa-circle-check alert-icon"></i>
                        <div>
                            <h4 class="font-bold mb-1">✅ CONDIÇÃO IDEAL PARA APLICAÇÃO</h4>
                            <p>Delta T entre 2-8°C. Condições favoráveis para pulverização com baixo risco de deriva.</p>
                        </div>
                    </div>
                `;
            }

            const windAlert = buildWindAlert(climateData?.winds);
            if (windAlert) {
                alertHTML += windAlert;
            }

            const windowMessage = buildBestApplicationWindows(climateData?.deltaT, climateData?.labels);
            alertHTML += `
                <div class="alert alert-info">
                    <i class="fa-solid fa-clock alert-icon"></i>
                    <div>
                        <h4 class="font-bold mb-1">⏱️ MELHORES HORÁRIOS PREVISTOS</h4>
                        <p>${windowMessage}</p>
                    </div>
                </div>
            `;

            alertContainer.innerHTML = alertHTML;
        }

        function buildWindAlert(windValues) {
            const values = windValues?.length ? windValues : MOCK_WIND;

            const maxWind = Math.max(...values);
            const minWind = Math.min(...values);

            if (maxWind >= 15) {
                return `
                    <div class="alert alert-danger">
                        <i class="fa-solid fa-wind alert-icon"></i>
                        <div>
                            <h4 class="font-bold mb-1">⚠️ VENTO ACIMA DO IDEAL</h4>
                            <p>Ventos acima de 15 km/h previstos (máx: ${maxWind.toFixed(1)} km/h). Alto risco de deriva. Evitar aplicação.</p>
                        </div>
                    </div>
                `;
            }

            if (maxWind >= 10) {
                return `
                    <div class="alert alert-warning">
                        <i class="fa-solid fa-wind alert-icon"></i>
                        <div>
                            <h4 class="font-bold mb-1">⚠️ VENTO MODERADO</h4>
                            <p>Ventos entre 10–15 km/h (máx: ${maxWind.toFixed(1)} km/h). Aplicação com cautela e ajuste de bicos/gotas.</p>
                        </div>
                    </div>
                `;
            }

            if (minWind < 3) {
                return `
                    <div class="alert alert-warning">
                        <i class="fa-solid fa-wind alert-icon"></i>
                        <div>
                            <h4 class="font-bold mb-1">⚠️ VENTO MUITO BAIXO</h4>
                            <p>Ventos abaixo de 3 km/h (mín: ${minWind.toFixed(1)} km/h). Risco de inversão térmica e deriva vertical.</p>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="alert alert-success">
                    <i class="fa-solid fa-wind alert-icon"></i>
                    <div>
                        <h4 class="font-bold mb-1">✅ VENTO IDEAL PARA APLICAÇÃO</h4>
                        <p>Ventos entre 3–10 km/h. Condições favoráveis para pulverização.</p>
                    </div>
                </div>
            `;
        }

        function buildWindSummary(windValues) {
            const values = windValues?.length ? windValues : MOCK_WIND;

            const maxWind = Math.max(...values);
            const minWind = Math.min(...values);

            if (maxWind >= 15) {
                return `Ventos acima de 15 km/h previstos (máx: ${maxWind.toFixed(1)} km/h). Evitar aplicação.`;
            }

            if (maxWind >= 10) {
                return `Ventos entre 10–15 km/h (máx: ${maxWind.toFixed(1)} km/h). Aplicação com cautela.`;
            }

            if (minWind < 3) {
                return `Ventos abaixo de 3 km/h (mín: ${minWind.toFixed(1)} km/h). Risco de inversão térmica.`;
            }

            return 'Ventos entre 3–10 km/h. Condições favoráveis para aplicação.';
        }

        function buildApplicationReport(deltaTValues, windValues, precipitationValues, labels) {
            if (!deltaTValues?.length || !labels?.length) {
                return {
                    ideal: 'Sem dados suficientes para horários ideais.',
                    caution: 'Sem dados suficientes para horários de cautela.'
                };
            }

            const winds = windValues?.length ? windValues : Array(deltaTValues.length).fill(6);
            const precipitation = precipitationValues?.length ? precipitationValues : Array(deltaTValues.length).fill(0);
            const idealRanges = [];
            const cautionRanges = [];
            let idealStart = null;
            let cautionStart = null;

            deltaTValues.forEach((deltaT, index) => {
                const wind = winds[index] ?? 0;
                const rain = precipitation[index] ?? 0;
                const isIdeal = deltaT >= 2 && deltaT <= 8 && wind >= 3 && wind <= 10;
                const isAvoid = deltaT > 10 || deltaT < 2 || wind >= 15 || rain > 0;
                const isCaution = !isIdeal && !isAvoid && (
                    (deltaT > 8 && deltaT <= 10) ||
                    (wind > 10 && wind < 15) ||
                    wind < 3
                );

                if (isIdeal && idealStart === null) idealStart = index;
                if (!isIdeal && idealStart !== null) {
                    idealRanges.push([idealStart, index - 1]);
                    idealStart = null;
                }

                if (isCaution && cautionStart === null) cautionStart = index;
                if (!isCaution && cautionStart !== null) {
                    cautionRanges.push([cautionStart, index - 1]);
                    cautionStart = null;
                }
            });

            if (idealStart !== null) idealRanges.push([idealStart, deltaTValues.length - 1]);
            if (cautionStart !== null) cautionRanges.push([cautionStart, deltaTValues.length - 1]);

            const formatRanges = (ranges) => {
                if (!ranges.length) return 'Sem horários nesta faixa.';
                return ranges
                    .map(([start, end]) => {
                        const startLabel = labels[start] ?? '';
                        const endLabel = labels[end] ?? '';
                        return start === end ? startLabel : `${startLabel}–${endLabel}`;
                    })
                    .join(', ');
            };

            return {
                ideal: `Horários ideais: ${formatRanges(idealRanges)}.`,
                caution: `Horários de cautela: ${formatRanges(cautionRanges)}.`
            };
        }

        const CLIMATE_HOURS = 24;

        function buildBestApplicationWindows(deltaTValues, labels) {
            if (!deltaTValues?.length || !labels?.length) {
                return 'Sem dados de Delta T para estimar horários.';
            }

            const idealMin = 2;
            const idealMax = 8;
            const ranges = [];
            let rangeStart = null;

            deltaTValues.forEach((value, index) => {
                const isIdeal = value >= idealMin && value <= idealMax;
                if (isIdeal && rangeStart === null) {
                    rangeStart = index;
                }
                if (!isIdeal && rangeStart !== null) {
                    ranges.push([rangeStart, index - 1]);
                    rangeStart = null;
                }
            });

            if (rangeStart !== null) {
                ranges.push([rangeStart, deltaTValues.length - 1]);
            }

            if (!ranges.length) {
                return `Nenhum horário com Delta T entre 2–8°C nas próximas ${CLIMATE_HOURS}h.`;
            }

            const formatted = ranges.map(([start, end]) => {
                const startLabel = labels[start] ?? '';
                const endLabel = labels[end] ?? '';
                return start === end ? startLabel : `${startLabel}–${endLabel}`;
            });

            return `Melhores horários (Delta T 2–8°C) nas próximas ${CLIMATE_HOURS}h: ${formatted.join(', ')}.`;
        }

        function buildAITechnicalAnalysis(deltaTValues, windValues, precipitationValues, humidityValues, temperatureValues, labels) {
            if (!deltaTValues?.length || !labels?.length) {
                return { liberado: [], atencao: [], naoAplicar: [], summary: 'Sem dados suficientes para gerar a análise técnica.' };
            }

            const winds = windValues?.length ? windValues : Array(deltaTValues.length).fill(6);
            const precip = precipitationValues?.length ? precipitationValues : Array(deltaTValues.length).fill(0);
            const humidity = humidityValues?.length ? humidityValues : Array(deltaTValues.length).fill(70);
            const temps = temperatureValues?.length ? temperatureValues : Array(deltaTValues.length).fill(25);

            const hourlyStatus = deltaTValues.map((deltaT, idx) => {
                const wind = winds[idx] ?? 0;
                const rain = precip[idx] ?? 0;
                const hum = humidity[idx] ?? 70;
                const temp = temps[idx] ?? 25;
                const reasons = [];
                let status = 'liberado';

                if (rain > 0) {
                    status = 'naoAplicar';
                    reasons.push(`Chuva prevista (${rain.toFixed(1)} mm)`);
                }
                if (deltaT > 10) {
                    status = 'naoAplicar';
                    reasons.push(`Delta T muito alto (${deltaT.toFixed(1)}°C) - alto risco de evaporação`);
                }
                if (deltaT < 2) {
                    status = 'naoAplicar';
                    reasons.push(`Delta T muito baixo (${deltaT.toFixed(1)}°C) - risco de inversão térmica`);
                }
                if (wind >= 15) {
                    status = 'naoAplicar';
                    reasons.push(`Vento excessivo (${wind.toFixed(1)} km/h) - alto risco de deriva`);
                }

                if (status !== 'naoAplicar') {
                    if (deltaT > 8 && deltaT <= 10) {
                        status = 'atencao';
                        reasons.push(`Delta T elevado (${deltaT.toFixed(1)}°C) - risco moderado de evaporação`);
                    }
                    if (wind >= 10 && wind < 15) {
                        status = 'atencao';
                        reasons.push(`Vento moderado (${wind.toFixed(1)} km/h) - ajustar tamanho de gota`);
                    }
                    if (wind < 3) {
                        status = status === 'liberado' ? 'atencao' : status;
                        reasons.push(`Vento muito baixo (${wind.toFixed(1)} km/h) - possível inversão térmica`);
                    }
                    if (hum < 55) {
                        status = status === 'liberado' ? 'atencao' : status;
                        reasons.push(`Umidade baixa (${hum.toFixed(0)}%) - maior evaporação`);
                    }
                    if (temp > 35) {
                        status = status === 'liberado' ? 'atencao' : status;
                        reasons.push(`Temperatura elevada (${temp.toFixed(1)}°C)`);
                    }
                }

                if (status === 'liberado' && reasons.length === 0) {
                    reasons.push(`Condições ideais: Delta T ${deltaT.toFixed(1)}°C, Vento ${wind.toFixed(1)} km/h, Umid. ${hum.toFixed(0)}%`);
                }

                return { label: labels[idx], status, reasons, deltaT, wind, rain: rain, humidity: hum, temp };
            });

            const buildRanges = (statusFilter) => {
                const ranges = [];
                let start = null;
                let currentReasons = [];

                hourlyStatus.forEach((h, idx) => {
                    if (h.status === statusFilter) {
                        if (start === null) {
                            start = idx;
                            currentReasons = [...h.reasons];
                        } else {
                            h.reasons.forEach(r => {
                                if (!currentReasons.includes(r)) currentReasons.push(r);
                            });
                        }
                    } else if (start !== null) {
                        ranges.push({
                            start: labels[start],
                            end: labels[idx - 1],
                            reasons: currentReasons.slice(0, 3)
                        });
                        start = null;
                        currentReasons = [];
                    }
                });
                if (start !== null) {
                    ranges.push({
                        start: labels[start],
                        end: labels[hourlyStatus.length - 1],
                        reasons: currentReasons.slice(0, 3)
                    });
                }
                return ranges;
            };

            const liberado = buildRanges('liberado');
            const atencao = buildRanges('atencao');
            const naoAplicar = buildRanges('naoAplicar');

            const totalHours = hourlyStatus.length;
            const libCount = hourlyStatus.filter(h => h.status === 'liberado').length;
            const attCount = hourlyStatus.filter(h => h.status === 'atencao').length;
            const bloqCount = hourlyStatus.filter(h => h.status === 'naoAplicar').length;

            const pctLib = ((libCount / totalHours) * 100).toFixed(0);
            const pctAtt = ((attCount / totalHours) * 100).toFixed(0);
            const pctBloq = ((bloqCount / totalHours) * 100).toFixed(0);

            let summary = `Análise das próximas ${CLIMATE_HOURS}h: ${pctLib}% do período com condições ideais, `;
            summary += `${pctAtt}% exige atenção e ${pctBloq}% não recomendado para aplicação. `;

            if (libCount > attCount + bloqCount) {
                summary += 'Cenário predominantemente favorável para pulverização.';
            } else if (bloqCount > libCount) {
                summary += 'Cenário predominantemente desfavorável. Priorize as janelas de aplicação identificadas.';
            } else {
                summary += 'Cenário misto. Planeje a aplicação nos horários liberados e monitore as condições.';
            }

            return { liberado, atencao, naoAplicar, summary, stats: { libCount, attCount, bloqCount, pctLib, pctAtt, pctBloq } };
        }

        // PDF + Salvamento unificado
        window.generatePDF = async () => {
            const btnGeneratePdf = document.querySelector('button[onclick="generatePDF()"]');
            if (btnGeneratePdf) {
                btnGeneratePdf.disabled = true;
            }

            try {
                syncProductObservationsFromDom();

                const mixId = currentEditingSimulation?.id || 'lastDraft';
                const loadDraft = window.loadDraft || (async (id) => {
                    if (!window.OfflineDB?.dbGet) return null;
                    const draftRecord = await window.OfflineDB.dbGet('mix_drafts_local', id);
                    return draftRecord?.payload || null;
                });
                const saveDraft = window.saveDraft || (async (id, sectionKey, data) => {
                    if (!window.OfflineDB?.dbGet || !window.OfflineDB?.dbPut) return null;
                    const current = await window.OfflineDB.dbGet('mix_drafts_local', id);
                    const payload = { ...(current?.payload || {}) };
                    payload[sectionKey] = data;
                    await window.OfflineDB.dbPut('mix_drafts_local', {
                        id,
                        updatedAt: new Date().toISOString(),
                        payload
                    });
                    return payload;
                });

                const rawDraft = await loadDraft(mixId);
                const draft = rawDraft?.sections ? rawDraft.sections : (rawDraft || {});
                const existingSnapshot = draft.reportSnapshot || null;

                const snapshot = existingSnapshot || {
                    mixId,
                    createdAt: new Date().toISOString(),
                    versao: '1.0',
                    identificacao: draft.identificacao,
                    maquina: draft.maquina,
                    agua: draft.agua ?? null,
                    meteo: draft.meteo ?? null,
                    ordem: draft.ordem,
                    itens: draft.itens ?? []
                };

                const currentOrderMode = getCurrentOrderMode();
                const orderedProductsSnapshot = getDisplayProductsByMode(currentOrderMode);
                snapshot.orderMode = currentOrderMode;
                snapshot.ordem = orderedProductsSnapshot;
                snapshot.itens = draft.itens ?? products;

                await saveDraft(mixId, 'reportSnapshot', snapshot);
                await saveDraft(mixId, 'status', 'finalized');

                const identificacaoSnapshot = snapshot.identificacao || {};
                const maquinaSnapshot = snapshot.maquina || {};
                const ordemSnapshot = Array.isArray(snapshot.ordem) ? snapshot.ordem : [];
                const snapshotItens = Array.isArray(snapshot.itens) && snapshot.itens.length
                    ? snapshot.itens
                    : products;

                // Salvar automaticamente no Firebase ao gerar PDF
                if (currentUserData && products.length > 0) {
                    try {
                        const payload = _buildSimulationPayload();
                        await _savePayloadToFirebase(payload);
                        console.log('✅ Simulação salva automaticamente ao gerar PDF');

                        // Atualizar botão de salvar
                        const btnSave = document.getElementById('btn-save-cloud');
                        if (btnSave) {
                            btnSave.innerHTML = '<i class="fa-solid fa-check"></i> Salvo';
                            btnSave.classList.add('opacity-50');
                            btnSave.disabled = true;
                        }

                        // Recarregar histórico em background
                        loadHistory().catch(() => {});
                    } catch (saveError) {
                        console.warn('⚠️ Erro ao salvar antes de gerar PDF:', saveError);
                    }
                }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');

            // ==================== PÁGINA 1: PLANO DE APLICAÇÃO (Landscape) ====================
            doc.setFillColor(15, 118, 110);
            doc.rect(0, 0, 297, 35, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont(undefined, 'bold');
            doc.text('CALDACERTA - PLANO DE APLICAÇÃO', 148.5, 15, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 148.5, 23, { align: 'center' });

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');

            let y = 45;
            const col1 = 15;
            const col2 = 105;
            const col3 = 195;

            doc.text('CLIENTE:', col1, y);
            doc.setFont(undefined, 'normal');
            doc.text(identificacaoSnapshot.cliente || document.getElementById('id_cliente').value, col1 + 20, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('PROPRIEDADE:', col1, y);
            doc.setFont(undefined, 'normal');
            doc.text(identificacaoSnapshot.propriedade || document.getElementById('id_propriedade').value, col1 + 30, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('TALHÃO:', col1, y);
            doc.setFont(undefined, 'normal');
            doc.text(identificacaoSnapshot.talhao || document.getElementById('id_talhao').value, col1 + 20, y);

            y = 45;
            doc.setFont(undefined, 'bold');
            doc.text('DATA APLICAÇÃO:', col2, y);
            doc.setFont(undefined, 'normal');
            const rawDataAplicacao = identificacaoSnapshot.data_aplicacao || document.getElementById('id_data').value;
            const dataAplicacao = rawDataAplicacao ? new Date(rawDataAplicacao).toLocaleDateString('pt-BR') : '-';
            doc.text(dataAplicacao, col2 + 35, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('CULTURA:', col2, y);
            doc.setFont(undefined, 'normal');
            doc.text(identificacaoSnapshot.cultura || document.getElementById('id_cultura').value, col2 + 20, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('ÁREA:', col2, y);
            doc.setFont(undefined, 'normal');
            doc.text(`${identificacaoSnapshot.area ?? document.getElementById('id_area').value} ha`, col2 + 15, y);

            y = 45;
            doc.setFont(undefined, 'bold');
            doc.text('RESP. TÉCNICO:', col3, y);
            doc.setFont(undefined, 'normal');
            doc.text(identificacaoSnapshot.responsavel || document.getElementById('id_responsavel').value, col3 + 35, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('OPERADOR:', col3, y);
            doc.setFont(undefined, 'normal');
            doc.text(maquinaSnapshot.operador || document.getElementById('eq_operador').value, col3 + 25, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('OBJETIVO:', col3, y);
            doc.setFont(undefined, 'normal');
            doc.text(identificacaoSnapshot.objetivo || document.getElementById('id_objetivo').value, col3 + 23, y);

            y += 12;
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('DADOS DA MÁQUINA', col1, y);

            y += 7;
            doc.setFontSize(9);
            doc.text(`Capacidade: ${maquinaSnapshot.tanque ?? document.getElementById('eq_tanque').value} L  |  Vazão: ${maquinaSnapshot.vazao ?? document.getElementById('eq_vazao').value} L/ha  |  Rendimento: ${document.getElementById('res_rendimento').innerText} ha/tanque`, col1, y);

            y += 10;
            const jarra = parseFloat(maquinaSnapshot.jarraVolume ?? document.getElementById('jarra_vol').value);
            const vazao = parseFloat(maquinaSnapshot.vazao ?? document.getElementById('eq_vazao').value) || 100;
            const tanque = parseFloat(maquinaSnapshot.tanque ?? document.getElementById('eq_tanque').value) || 2000;
            const area = parseFloat(identificacaoSnapshot.area ?? document.getElementById('id_area').value) || 10;
            const orderModeSnapshot = snapshot.orderMode || getCurrentOrderMode();
            const criterio = document.getElementById('criterioOrdenacao').value;

            let displayProducts = snapshotItens;
            if (ordemSnapshot.length > 0) {
                displayProducts = ordemSnapshot;
            } else if (orderModeSnapshot === 'auto') {
                displayProducts = sortProductsByHierarchy(snapshotItens, criterio);
            } else if (orderModeSnapshot === 'fispq') {
                displayProducts = sortProductsByFispq(snapshotItens);
            }

            const tableData = displayProducts.map((p, i) => [
                `${i + 1}`,
                p.nome,
                p.observacao || '-',
                p.ph ? `${p.ph}` : '-',
                formatarDoseHa(Number(p.dose) || 0),
                formatarDoseJarra((p.dose * jarra) / vazao),
                `${(p.dose * area).toFixed(1)}`,
                `${((p.dose * tanque) / vazao).toFixed(1)}`
            ]);

            doc.autoTable({
                startY: y,
                head: [['#', 'Produto', 'Observação', 'pH FISPQ', 'Dose/ha', `Jarra\n(${jarra}ml)`, `TOTAL\n(${area}ha)`, 'DOSE\nTANQUE']],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [15, 118, 110],
                    fontSize: 9,
                    fontStyle: 'bold',
                    halign: 'center',
                    valign: 'middle'
                },
                bodyStyles: { fontSize: 8, valign: 'middle', textColor: [0, 0, 0] },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center', textColor: [0, 0, 0] },
                    1: { cellWidth: 65, textColor: [0, 0, 0] },
                    2: { cellWidth: 45, textColor: [0, 0, 0] },
                    3: { cellWidth: 18, halign: 'center', textColor: [0, 0, 0] },
                    4: { cellWidth: 22, halign: 'center', textColor: [0, 0, 0] },
                    5: { cellWidth: 22, halign: 'center', textColor: [0, 0, 0] },
                    6: {
                        cellWidth: 28,
                        halign: 'center',
                        fillColor: [255, 237, 213],
                        textColor: [0, 0, 0],
                        fontStyle: 'bold',
                        fontSize: 9
                    },
                    7: {
                        cellWidth: 30,
                        halign: 'center',
                        fillColor: [254, 243, 199],
                        textColor: [0, 0, 0],
                        fontStyle: 'bold',
                        fontSize: 9
                    }
                },
                margin: { left: 15, right: 15 },
                didDrawCell: function(data) {
                    if (data.column.index === 6 || data.column.index === 7) {
                        doc.setDrawColor(234, 88, 12);
                        doc.setLineWidth(0.5);
                        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
                    }
                }
            });

            // ==================== PÁGINA 2: QUALIDADE DA ÁGUA + DELTA T (Portrait) ====================
            doc.addPage('a4', 'portrait');
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFillColor(15, 118, 110);
            doc.rect(0, 0, pageWidth, 20, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('QUALIDADE DA ÁGUA E DELTA T', pageWidth / 2, 13, { align: 'center' });

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('1. QUALIDADE DA ÁGUA', 15, 35);

            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            y = 43;

            const ph = document.getElementById('agua_ph').value || 'Não informado';
            const caldaPh = document.getElementById('calda_ph').value || 'Não informado';
            const dureza = document.getElementById('agua_dureza').value || 'Não informado';
            const origem = document.getElementById('agua_origem').value;
            const obs = document.getElementById('agua_obs').value || 'Sem observações';

            const waterColGap = 10;
            const waterColWidth = (pageWidth - 30 - waterColGap) / 2;
            const waterLeftX = 15;
            const waterRightX = waterLeftX + waterColWidth + waterColGap;
            let waterLeftY = y;
            let waterRightY = y;

            doc.text(`pH: ${ph}`, waterLeftX, waterLeftY);
            waterLeftY += 6;
            doc.text(`Dureza: ${dureza} µS/cm`, waterLeftX, waterLeftY);
            waterLeftY += 6;
            doc.text(`Origem: ${origem}`, waterLeftX, waterLeftY);
            waterLeftY += 6;

            doc.text(`pH final da calda: ${caldaPh}`, waterRightX, waterRightY);
            waterRightY += 6;
            doc.text('Observações:', waterRightX, waterRightY);
            waterRightY += 4;
            doc.text(obs, waterRightX, waterRightY, { maxWidth: waterColWidth });
            waterRightY += 8;

            y = Math.max(waterLeftY, waterRightY) + 4;

            y += 14;
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('2. GRÁFICO DELTA T', 15, y);

            doc.setFontSize(7);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text('Referência: Ideal 2-8°C | Cautela 8-10°C | Evitar >10°C | Inversão <2°C', 15, y + 5);
            doc.setTextColor(0, 0, 0);

            const chartDeltaT = document.getElementById('chartDeltaT');
            const chartWidth = pageWidth - 30;
            const chartHeightDelta = 100;
            if (chartDeltaT) {
                const imgDeltaT = chartDeltaT.toDataURL('image/png');
                doc.addImage(imgDeltaT, 'PNG', 15, y + 8, chartWidth, chartHeightDelta);
            }

            y = y + chartHeightDelta + 16;
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            const windowMessage = buildBestApplicationWindows(climateData?.deltaT, climateData?.labels);
            const textWidth = pageWidth - 30;

            doc.setFillColor(240, 253, 244);
            doc.roundedRect(15, y, textWidth, 22, 2, 2, 'F');
            doc.setDrawColor(34, 197, 94);
            doc.setLineWidth(0.3);
            doc.roundedRect(15, y, textWidth, 22, 2, 2, 'S');

            doc.setFontSize(8);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(22, 101, 52);
            doc.text('MELHORES HORÁRIOS PARA APLICAÇÃO', 20, y + 5);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(7);
            doc.text(windowMessage, 20, y + 10, { maxWidth: textWidth - 10 });
            const windMessage = buildWindSummary(climateData?.winds);
            doc.text(`Ventos: ${windMessage}`, 20, y + 16, { maxWidth: textWidth - 10 });
            doc.setTextColor(0, 0, 0);

            // ==================== PÁGINA 3: CONDIÇÕES METEOROLÓGICAS + ANÁLISE TÉCNICA (Portrait) ====================
            doc.addPage('a4', 'portrait');
            doc.setFillColor(15, 118, 110);
            doc.rect(0, 0, pageWidth, 20, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('CONDIÇÕES METEOROLÓGICAS E ANÁLISE TÉCNICA', pageWidth / 2, 13, { align: 'center' });

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            y = 32;
            doc.text('3. CONDIÇÕES METEOROLÓGICAS', 15, y);

            doc.setFontSize(7);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`Temperatura, Umidade Relativa e Previsão Pluviométrica (${CLIMATE_HOURS}h)`, 15, y + 5);
            doc.setTextColor(0, 0, 0);

            const chartClima = document.getElementById('chartClima');
            const chartHeightClima = 75;
            if (chartClima) {
                const imgClima = chartClima.toDataURL('image/png');
                doc.addImage(imgClima, 'PNG', 15, y + 8, chartWidth, chartHeightClima);
            }

            y = y + chartHeightClima + 16;
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('4. ANÁLISE TÉCNICA DE MOMENTOS DE APLICAÇÃO', 15, y);

            doc.setFontSize(7);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text('Análise baseada em Delta T, velocidade do vento, umidade, temperatura e precipitação', 15, y + 5);
            doc.setTextColor(0, 0, 0);

            const analysis = buildAITechnicalAnalysis(
                climateData?.deltaT, climateData?.winds, climateData?.precipitation,
                climateData?.humidity, climateData?.temperatures, climateData?.labels
            );

            y += 10;

            // Summary box
            doc.setFillColor(239, 246, 255);
            doc.roundedRect(15, y, textWidth, 14, 2, 2, 'F');
            doc.setDrawColor(59, 130, 246);
            doc.setLineWidth(0.3);
            doc.roundedRect(15, y, textWidth, 14, 2, 2, 'S');
            doc.setFontSize(7);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 64, 175);
            doc.text('RESUMO DA ANÁLISE', 20, y + 4);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(7);
            doc.text(analysis.summary, 20, y + 9, { maxWidth: textWidth - 10 });
            doc.setTextColor(0, 0, 0);
            y += 18;

            // Statistics bar
            if (analysis.stats) {
                const barWidth = textWidth;
                const barHeight = 6;
                const libW = (analysis.stats.libCount / (analysis.stats.libCount + analysis.stats.attCount + analysis.stats.bloqCount)) * barWidth;
                const attW = (analysis.stats.attCount / (analysis.stats.libCount + analysis.stats.attCount + analysis.stats.bloqCount)) * barWidth;
                const bloqW = barWidth - libW - attW;

                doc.setFillColor(34, 197, 94);
                doc.rect(15, y, libW, barHeight, 'F');
                doc.setFillColor(245, 158, 11);
                doc.rect(15 + libW, y, attW, barHeight, 'F');
                doc.setFillColor(239, 68, 68);
                doc.rect(15 + libW + attW, y, bloqW, barHeight, 'F');

                doc.setFontSize(6);
                doc.setTextColor(0, 0, 0);
                y += barHeight + 4;
                doc.setFillColor(34, 197, 94);
                doc.circle(17, y - 1, 1.5, 'F');
                doc.text(`Liberado: ${analysis.stats.pctLib}%`, 20, y);

                doc.setFillColor(245, 158, 11);
                doc.circle(62, y - 1, 1.5, 'F');
                doc.text(`Atenção: ${analysis.stats.pctAtt}%`, 65, y);

                doc.setFillColor(239, 68, 68);
                doc.circle(105, y - 1, 1.5, 'F');
                doc.text(`Não Aplicar: ${analysis.stats.pctBloq}%`, 108, y);
                y += 6;
            }

            const columnGap = 8;
            const columnWidth = (textWidth - columnGap) / 2;
            const leftX = 15;
            const rightX = leftX + columnWidth + columnGap;
            let leftY = y;
            let rightY = y;

            const renderSection = ({ title, titleColor, bgColor, ranges, emptyText, reasonColor, formatReasons }, startX, startY, maxW) => {
                const sectionWidth = maxW || columnWidth;
                doc.setFillColor(...bgColor);
                doc.roundedRect(startX, startY, sectionWidth, 4, 1, 1, 'F');
                doc.setFontSize(7);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(...titleColor);
                doc.text(title, startX + 4, startY + 3);

                let currentY = startY + 6;
                doc.setFont(undefined, 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(0, 0, 0);

                if (!ranges.length) {
                    doc.text(emptyText, startX + 4, currentY, { maxWidth: sectionWidth - 8 });
                    currentY += 4;
                } else {
                    ranges.forEach(range => {
                        const period = range.start === range.end ? range.start : `${range.start} — ${range.end}`;
                        doc.setFont(undefined, 'bold');
                        doc.text(period, startX + 4, currentY);
                        currentY += 3.5;
                        doc.setFont(undefined, 'normal');
                        if (range.reasons.length) {
                            doc.setTextColor(...reasonColor);
                            const reasonText = formatReasons(range.reasons);
                            const splitLines = doc.splitTextToSize(reasonText, sectionWidth - 8);
                            doc.text(splitLines, startX + 4, currentY);
                            currentY += splitLines.length * 3;
                            doc.setTextColor(0, 0, 0);
                        }
                        currentY += 2;
                    });
                }

                return currentY + 2;
            };

            leftY = renderSection(
                {
                    title: 'LIBERADO PARA APLICAÇÃO',
                    titleColor: [22, 101, 52],
                    bgColor: [240, 253, 244],
                    ranges: analysis.liberado,
                    emptyText: 'Nenhum período com condições ideais identificado.',
                    reasonColor: [80, 80, 80],
                    formatReasons: (reasons) => reasons[0]
                },
                leftX,
                leftY
            );

            rightY = renderSection(
                {
                    title: 'APLICAR COM ATENÇÃO',
                    titleColor: [146, 64, 14],
                    bgColor: [255, 251, 235],
                    ranges: analysis.atencao,
                    emptyText: 'Nenhum período com condições marginais identificado.',
                    reasonColor: [120, 80, 0],
                    formatReasons: (reasons) => reasons.join('; ')
                },
                rightX,
                rightY
            );

            let naoAplicarY = Math.max(leftY, rightY) + 2;
            naoAplicarY = renderSection(
                {
                    title: 'NÃO APLICAR',
                    titleColor: [153, 27, 27],
                    bgColor: [254, 242, 242],
                    ranges: analysis.naoAplicar,
                    emptyText: 'Nenhum período com condições impeditivas identificado.',
                    reasonColor: [180, 30, 30],
                    formatReasons: (reasons) => reasons.join('; ')
                },
                leftX,
                naoAplicarY,
                textWidth
            );

            // Technical reference footer
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(6);
            doc.setTextColor(130, 130, 130);
            doc.text('Referência técnica: Delta T ideal 2–8°C | Cautela 8–10°C | Evitar >10°C | Inversão térmica <2°C | Vento ideal 3–10 km/h', 15, pageHeight - 8);
            doc.text('Análise gerada automaticamente com base nos dados meteorológicos. Consulte um engenheiro agrônomo para decisões finais.', 15, pageHeight - 4);
            doc.setTextColor(0, 0, 0);

            doc.save(`CaldaCerta_${identificacaoSnapshot.cliente || document.getElementById('id_cliente').value}_${new Date().toISOString().split('T')[0]}.pdf`);
            showToast('✅ PDF gerado e simulação salva!', 'success');
            } finally {
                if (btnGeneratePdf) {
                    btnGeneratePdf.disabled = false;
                }
            }
        };

        // Gráficos
        let charts = [];
        function initCharts() {
            charts.forEach(c => c.destroy());
            charts = [];

            const hours = climateData?.labels || Array.from({length: CLIMATE_HOURS}, (_, i) => {
                const dayOffset = Math.floor(i / 24);
                const hour = String(i % 24).padStart(2, '0');
                return `${dayOffset + 1}º dia ${hour}:00`;
            });
            const deltaSeries = climateData?.deltaT || MOCK_DELTA_T.slice(0, CLIMATE_HOURS);
            const temperatureSeries = climateData?.temperatures || MOCK_TEMPS;
            const humiditySeries = climateData?.humidity || MOCK_HUMIDITY;
            const windSeries = climateData?.winds || MOCK_WIND;
            const precipSeries = climateData?.precipitation || MOCK_RAIN;

            const chartDeltaT = new Chart(document.getElementById('chartDeltaT'), {
                type: 'line',
                data: {
                    labels: hours,
                    datasets: [{
                        label: 'Delta T (°C)',
                        data: deltaSeries,
                        borderColor: '#14b8a6',
                        backgroundColor: 'rgba(20, 184, 166, 0.15)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        pointBackgroundColor: '#14b8a6',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 1
                    },
                    {
                        label: 'Ideal (2–8°C)',
                        data: Array(hours.length).fill(8),
                        borderColor: '#22c55e',
                        borderDash: [6, 4],
                        pointRadius: 0,
                        borderWidth: 1.5,
                        fill: {
                            target: '+1',
                            above: 'rgba(34, 197, 94, 0.08)'
                        }
                    },
                    {
                        label: 'Inversão (<2°C)',
                        data: Array(hours.length).fill(2),
                        borderColor: '#0ea5e9',
                        borderDash: [4, 4],
                        pointRadius: 0,
                        borderWidth: 1.5,
                        fill: false
                    },
                    {
                        label: 'Cautela (8–10°C)',
                        data: Array(hours.length).fill(10),
                        borderColor: '#f59e0b',
                        borderDash: [6, 4],
                        pointRadius: 0,
                        borderWidth: 1.5,
                        fill: false
                    },
                    {
                        label: 'Evitar (>10°C)',
                        data: Array(hours.length).fill(12),
                        borderColor: '#ef4444',
                        borderDash: [2, 4],
                        pointRadius: 0,
                        borderWidth: 1.5,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 10 },
                                boxWidth: 14,
                                boxHeight: 8,
                                padding: 8,
                                usePointStyle: true,
                                pointStyle: 'line'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            padding: 8,
                            titleFont: { size: 11, weight: 'bold' },
                            bodyFont: { size: 10 }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f5f5f4' },
                            title: { display: true, text: 'Delta T (°C)', font: { size: 10 } },
                            ticks: { font: { size: 9 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 8 }, maxRotation: 45, minRotation: 30 }
                        }
                    }
                }
            });

            const chartClima = new Chart(document.getElementById('chartClima'), {
                type: 'line',
                data: {
                    labels: hours,
                    datasets: [
                        {
                            label: 'Temperatura (°C)',
                            data: temperatureSeries,
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2,
                            yAxisID: 'y',
                            pointRadius: 2,
                            pointHoverRadius: 4,
                            pointBackgroundColor: '#f59e0b',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1
                        },
                        {
                            label: 'Umidade (%)',
                            data: humiditySeries,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.08)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2,
                            yAxisID: 'y1',
                            pointRadius: 2,
                            pointHoverRadius: 4,
                            pointBackgroundColor: '#3b82f6',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1
                        },
                        {
                            type: 'bar',
                            label: 'Chuva (mm)',
                            data: precipSeries,
                            backgroundColor: 'rgba(99, 102, 241, 0.5)',
                            borderColor: '#6366f1',
                            borderWidth: 1,
                            yAxisID: 'y2',
                            barPercentage: 0.6,
                            categoryPercentage: 0.8,
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 10 },
                                boxWidth: 14,
                                boxHeight: 8,
                                padding: 8,
                                usePointStyle: false
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            padding: 8,
                            titleFont: { size: 11, weight: 'bold' },
                            bodyFont: { size: 10 }
                        }
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'Temperatura (°C)', font: { size: 10 } },
                            grid: { color: '#f5f5f4' },
                            ticks: { font: { size: 9 } }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: { display: true, text: 'Umidade (%)', font: { size: 10 } },
                            grid: { drawOnChartArea: false },
                            ticks: { font: { size: 9 } }
                        },
                        y2: {
                            type: 'linear',
                            display: false,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            min: 0,
                            afterDataLimits: (scale) => { scale.max = Math.max(scale.max || 1, 5); }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 8 }, maxRotation: 45, minRotation: 30 }
                        }
                    }
                }
            });

            charts.push(chartDeltaT, chartClima);
        }

        function renderClimateTables() {
            const deltaTable = document.querySelector('#delta-table tbody');
            const climaTable = document.querySelector('#clima-table tbody');
            if (!deltaTable || !climaTable) return;

            const hours = climateData?.labels || Array.from({length: CLIMATE_HOURS}, (_, i) => {
                const dayOffset = Math.floor(i / 24);
                const hour = String(i % 24).padStart(2, '0');
                return `${dayOffset + 1}º dia ${hour}:00`;
            });
            const deltaSeries = climateData?.deltaT || MOCK_DELTA_T.slice(0, CLIMATE_HOURS);
            const temperatureSeries = climateData?.temperatures || MOCK_TEMPS;
            const humiditySeries = climateData?.humidity || MOCK_HUMIDITY;
            const windSeries = climateData?.winds || MOCK_WIND;
            const precipSeries = climateData?.precipitation || MOCK_RAIN;

            deltaTable.innerHTML = hours.map((label, idx) => `
                <tr>
                    <td>${label}</td>
                    <td>${Number(deltaSeries[idx] ?? 0).toFixed(2)}</td>
                </tr>
            `).join('');

            climaTable.innerHTML = hours.map((label, idx) => `
                <tr>
                    <td>${label}</td>
                    <td>${Number(temperatureSeries[idx] ?? 0).toFixed(1)}</td>
                    <td>${Number(humiditySeries[idx] ?? 0).toFixed(0)}</td>
                    <td>${Number(windSeries[idx] ?? 0).toFixed(1)}</td>
                    <td>${Number(precipSeries[idx] ?? 0).toFixed(1)}</td>
                </tr>
            `).join('');
        }

        function computeDeltaT(temperature, humidity) {
            const a = 17.27;
            const b = 237.7;
            const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100);
            const dewPoint = (b * alpha) / (a - alpha);
            return Number((temperature - dewPoint).toFixed(2));
        }

        function computeDewPoint(temperature, humidity) {
            const a = 17.27;
            const b = 237.7;
            const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100);
            return Number(((b * alpha) / (a - alpha)).toFixed(2));
        }

        function formatLocalHourlyLabel(time) {
            if (!time) return '';
            const [datePart, timePart] = time.split('T');
            if (!datePart || !timePart) return time;
            const [year, month, day] = datePart.split('-');
            if (!year || !month || !day) return time;
            return `${day}/${month} ${timePart.slice(0, 5)}`;
        }

        function normalizeHourlyEntries(data) {
            if (Array.isArray(data?.hourly) && data.hourly.length) {
                return data.hourly.map((item) => {
                    const temperature = Number(item.temperature ?? item.temp ?? 0);
                    const humidity = Number(item.humidity ?? item.relative_humidity ?? 0);
                    const dewPointValue = Number(item.dew_point ?? item.dew_point_2m);
                    const dewPoint = Number.isFinite(dewPointValue)
                        ? dewPointValue
                        : computeDewPoint(temperature, humidity || 50);
                    return {
                        time: item.time || (item.dt ? new Date(item.dt * 1000).toISOString() : null),
                        temperature,
                        humidity,
                        precipitation: Number(item.precipitation ?? 0),
                        wind_speed: Number(item.wind_speed ?? item.wind_speed_10m ?? 0),
                        dew_point: dewPoint,
                        deltaT: Number(item.deltaT ?? item.delta_t)
                    };
                }).filter(item => item.time);
            }
            if (data?.hourly?.time?.length) {
                return data.hourly.time.map((time, idx) => ({
                    time,
                    temperature: Number(data.hourly.temperature_2m?.[idx] ?? 0),
                    humidity: Number(data.hourly.relativehumidity_2m?.[idx] ?? 0),
                    precipitation: Number(data.hourly.precipitation?.[idx] ?? 0),
                    wind_speed: Number(data.hourly.windspeed_10m?.[idx] ?? 0),
                    dew_point: Number(data.hourly.dew_point?.[idx] ?? 0),
                    deltaT: Number(data.hourly.deltaT?.[idx])
                }));
            }
            if (data?.hourly_series?.time?.length) {
                return data.hourly_series.time.map((time, idx) => ({
                    time,
                    temperature: Number(data.hourly_series.temperature_2m?.[idx] ?? 0),
                    humidity: Number(data.hourly_series.relativehumidity_2m?.[idx] ?? 0),
                    precipitation: Number(data.hourly_series.precipitation?.[idx] ?? 0),
                    wind_speed: Number(data.hourly_series.windspeed_10m?.[idx] ?? 0),
                    dew_point: Number(data.hourly_series.dew_point?.[idx] ?? 0),
                    deltaT: Number(data.hourly_series.deltaT?.[idx])
                }));
            }
            return [];
        }

        async function fetchOpenMeteoForecast({ latitude, longitude }) {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,dew_point_2m&forecast_days=7&timezone=America%2FSao_Paulo`;
            let response;
            try {
                response = await fetch(url);
            } catch (error) {
                const networkError = new Error('Serviço de clima indisponível no momento.');
                networkError.userMessage = '❌ Serviço de clima indisponível no momento.';
                networkError.originalError = error;
                throw networkError;
            }
            if (!response.ok) {
                throw new Error('Falha ao obter dados meteorológicos.');
            }
            const data = await response.json();
            const hourly = data?.hourly || {};
            const times = hourly?.time || [];
            const temperatures = hourly?.temperature_2m || [];
            const humidity = hourly?.relative_humidity_2m || [];
            const precipitation = hourly?.precipitation || [];
            const windSpeed = hourly?.wind_speed_10m || [];
            const dewPoint = hourly?.dew_point_2m || [];

            const hourlyData = times.map((time, idx) => {
                const tempValue = Number(temperatures[idx] ?? 0);
                const humidityValue = Number(humidity[idx] ?? 0);
                const dewPointValue = Number(dewPoint[idx]);
                const calculatedDewPoint = Number.isFinite(dewPointValue)
                    ? dewPointValue
                    : computeDewPoint(tempValue, humidityValue || 50);

                return {
                    time,
                    temperature: tempValue,
                    humidity: humidityValue,
                    precipitation: Number(precipitation[idx] ?? 0),
                    wind_speed: Number(windSpeed[idx] ?? 0),
                    dew_point: calculatedDewPoint,
                    deltaT: Number.isFinite(tempValue)
                        ? Number((tempValue - calculatedDewPoint).toFixed(2))
                        : null
                };
            }).filter(item => item.time);

            if (hourlyData.length) {
                console.debug('[Clima] Primeira hora retornada:', hourlyData[0].time);
                console.debug('[Clima] Última hora retornada:', hourlyData[hourlyData.length - 1].time);
            }

            return {
                hourly: hourlyData,
                location: {
                    lat: data?.latitude,
                    lon: data?.longitude,
                    timezone: data?.timezone || 'America/Sao_Paulo'
                },
                source: 'open-meteo'
            };
        }

        function validateHourlySeries(hourlyEntries) {
            if (!Array.isArray(hourlyEntries) || hourlyEntries.length < 2) {
                return { valid: false, reason: 'Série horária ausente ou incompleta.' };
            }
            const toleranceMs = 5 * 60 * 1000;
            for (let i = 0; i < hourlyEntries.length - 1; i += 1) {
                const current = new Date(hourlyEntries[i].time);
                const next = new Date(hourlyEntries[i + 1].time);
                if (Number.isNaN(current.getTime()) || Number.isNaN(next.getTime())) {
                    return { valid: false, reason: 'Horário inválido na série horária.' };
                }
                const diff = Math.abs(next.getTime() - current.getTime());
                if (Math.abs(diff - 3600000) > toleranceMs) {
                    return { valid: false, reason: `Intervalo inválido entre ${hourlyEntries[i].time} e ${hourlyEntries[i + 1].time}.` };
                }
            }
            return { valid: true };
        }

        function buildFallbackHourlyEntries(data, startDate) {
            const baseDate = startDate ?? new Date();
            return Array.from({ length: CLIMATE_HOURS }, (_, idx) => {
                const next = new Date(baseDate);
                next.setHours(next.getHours() + idx);
                const currentTemp = Number(data?.hourly?.[0]?.temperature ?? data?.current?.temp ?? data?.daily?.[0]?.temp_max ?? 0);
                const humidityValue = Number(data?.hourly?.[0]?.humidity ?? data?.current?.humidity ?? 50);
                const windValue = Number(data?.hourly?.[0]?.wind_speed ?? data?.current?.wind_speed ?? 0);
                const precipValue = Number(data?.hourly?.[0]?.precipitation ?? data?.daily?.[0]?.pop ?? 0);
                const dewPointValue = computeDewPoint(currentTemp, humidityValue || 50);
                return {
                    time: next.toISOString(),
                    temperature: currentTemp,
                    humidity: humidityValue,
                    precipitation: precipValue,
                    wind_speed: windValue,
                    dew_point: dewPointValue,
                    deltaT: Number((currentTemp - dewPointValue).toFixed(2))
                };
            });
        }

        function parseApplicationDate(value) {
            if (!value || typeof value !== 'string') return null;
            if (value.includes('/')) {
                const [day, month, year] = value.split('/');
                if (!day || !month || !year) return null;
                const parsed = new Date(Number(year), Number(month) - 1, Number(day));
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            if (value.includes('-')) {
                const [year, month, day] = value.split('-');
                if (!day || !month || !year) return null;
                const parsed = new Date(Number(year), Number(month) - 1, Number(day));
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        function selectHourlyWindow(hourlyEntries, applicationDate) {
            if (!hourlyEntries.length) {
                return { entries: [], mode: 'sem dados' };
            }

            const now = new Date();
            const parsedTimes = hourlyEntries.map(item => new Date(item.time));
            let mode = 'fallback próximas 24h';
            let entries = [];

            if (applicationDate instanceof Date && !Number.isNaN(applicationDate.getTime())) {
                const dayStart = new Date(applicationDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setDate(dayEnd.getDate() + 1);
                const withinRange = parsedTimes.some(time => time >= dayStart && time < dayEnd);

                if (withinRange) {
                    entries = hourlyEntries.filter((_, idx) => {
                        const time = parsedTimes[idx];
                        return time >= dayStart && time < dayEnd;
                    }).slice(0, CLIMATE_HOURS);
                    if (entries.length === CLIMATE_HOURS) {
                        mode = 'data dentro do alcance';
                        return { entries, mode };
                    }
                }
            }

            const startIndex = Math.max(parsedTimes.findIndex(time => time >= now), 0);
            entries = hourlyEntries.slice(startIndex, startIndex + CLIMATE_HOURS);
            return { entries, mode };
        }

        function buildClimateSeries(data, selectedEntries) {
            const hourlyEntries = selectedEntries?.length
                ? selectedEntries
                : normalizeHourlyEntries(data);
            if (!hourlyEntries.length) return null;

            const sliceEntries = hourlyEntries.slice(0, CLIMATE_HOURS);
            const labels = sliceEntries.map((entry) => formatLocalHourlyLabel(entry.time));
            const temperatures = sliceEntries.map((entry) => Number(entry.temperature ?? 0));
            const humidity = sliceEntries.map((entry) => Number(entry.humidity ?? 0));
            const winds = sliceEntries.map((entry) => Number(entry.wind_speed ?? 0));
            const precipitation = sliceEntries.map((entry) => Number(entry.precipitation ?? 0));
            const deltaT = sliceEntries.map((entry, idx) => {
                const provided = Number(entry.deltaT);
                if (Number.isFinite(provided)) return provided;
                const dewPointValue = Number(entry.dew_point);
                const tempValue = temperatures[idx];
                if (Number.isFinite(dewPointValue)) {
                    return Number((tempValue - dewPointValue).toFixed(2));
                }
                return computeDeltaT(tempValue, humidity[idx] ?? 50);
            });

            return {
                labels,
                temperatures,
                humidity,
                winds,
                precipitation,
                deltaT,
                source: data?.source || 'open-meteo'
            };
        }

        window.refreshClimate = async () => {
            const latField = document.getElementById('clima_lat');
            const lonField = document.getElementById('clima_lon');
            const latitude = parseFloat(latField.value);
            const longitude = parseFloat(lonField.value);
            const applicationDateValue = document.getElementById('id_data').value;
            const applicationDate = parseApplicationDate(applicationDateValue) || new Date();

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                showToast('❌ Informe latitude/longitude ou use a localização.', 'error');
                return;
            }

            try {
                showToast('⏳ Buscando dados meteorológicos...', 'success');
                const data = await fetchOpenMeteoForecast({ latitude, longitude });
                const hourlyEntries = normalizeHourlyEntries(data);
                const hourlyValidation = validateHourlySeries(hourlyEntries);
                if (!hourlyValidation.valid) {
                    console.error('[Clima] Série horária inválida:', hourlyValidation.reason);
                    showToast('⚠️ Fonte não retornou série horária. Verifique parâmetros.', 'warning');
                }
                const selection = selectHourlyWindow(hourlyEntries, applicationDate);

                console.debug('[Clima] Modo usado:', selection.mode);

                if (selection.mode === 'fallback próximas 24h') {
                    showToast('⚠️ Previsão horária disponível apenas para os próximos 7 dias.', 'warning');
                }

                const series = buildClimateSeries(data, selection.entries.length ? selection.entries : buildFallbackHourlyEntries(data, new Date()));
                if (!series) {
                    showToast('❌ Dados meteorológicos indisponíveis.', 'error');
                    return;
                }
                climateData = series;
                initCharts();
                renderClimateTables();
                checkClimateConditions(series.deltaT);
                showToast('✅ Clima atualizado via Open-Meteo.', 'success');
            } catch (error) {
                console.error(error);
                const message = error?.userMessage || '❌ Erro ao atualizar clima. Tente novamente.';
                showToast(message, 'error');
            }
        };

        window.useCurrentLocation = () => {
            if (!navigator.geolocation) {
                showToast('❌ Geolocalização não suportada neste navegador.', 'error');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const latField = document.getElementById('clima_lat');
                    const lonField = document.getElementById('clima_lon');
                    latField.value = position.coords.latitude.toFixed(4);
                    lonField.value = position.coords.longitude.toFixed(4);
                    refreshClimate();
                },
                () => {
                    showToast('❌ Não foi possível acessar sua localização.', 'error');
                }
            );
        };

        // Toast
        function showToast(message, type = 'success') {
            const existing = document.querySelector('.toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = 'toast';
            if (type === 'error') {
                toast.style.background = '#dc2626';
            } else if (type === 'warning') {
                toast.style.background = '#d97706';
            } else {
                toast.style.background = '#15803d';
            }
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => toast.remove(), 3000);
        }

        // Inicialização
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('id_data').value = new Date().toISOString().split('T')[0];

            // initBancosDados e loadHistory são chamados pelo auth.onAuthStateChanged
            // Não carregar aqui pois o usuário ainda não está autenticado
            document.getElementById('produto-banco').style.display = 'block';
            document.getElementById('produto-form').style.display = 'block';
            updateFispqLink();
            const nomeInput = document.getElementById('p_nome');
            if (nomeInput) {
                nomeInput.addEventListener('change', () => {
                    buscarPhFispqPorNome(nomeInput.value);
                });
                nomeInput.addEventListener('blur', () => {
                    buscarPhFispqPorNome(nomeInput.value);
                });
            }

            const atualizarBtn = document.getElementById('clima_atualizar');
            if (atualizarBtn) {
                atualizarBtn.addEventListener('click', refreshClimate);
            }

            initConnectionStatusBadge();
            initSyncIndicator();
            initDraftAutosave();

            const latField = document.getElementById('clima_lat');
            const lonField = document.getElementById('clima_lon');
            if (latField && lonField && !latField.value && !lonField.value) {
                latField.value = '-23.5505';
                lonField.value = '-46.6333';
            }
        });

        // auth e db já declarados no topo do IIFE
        let currentUserData = null;
        let isUserAdmin = false;
        let lastFirebaseReconnectAt = 0;
        let authResolvedOnce = false;
        let authBootstrapTimedOut = false;
        let isUsingOfflineSessionFallback = false;
        let lastLoginButtonLabel = '<i class="fas fa-sign-in-alt"></i> Entrar';
        const OFFLINE_SESSION_KEY = 'offlineSession';

        function readOfflineSession() {
            try {
                const raw = localStorage.getItem(OFFLINE_SESSION_KEY);
                if (!raw) return null;
                const session = JSON.parse(raw);
                if (!session?.uid || !session?.email) return null;
                return session;
            } catch (error) {
                console.warn('Falha ao ler offlineSession:', error);
                return null;
            }
        }

        function saveOfflineSession(user) {
            if (!user?.uid || !user?.email) {
                return;
            }

            localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email,
                lastLoginAt: new Date().toISOString()
            }));
        }

        function clearOfflineSession() {
            localStorage.removeItem(OFFLINE_SESSION_KEY);
        }

        function setOfflineSessionBadge(isVisible) {
            const badge = document.getElementById('offline-session-badge');
            if (!badge) return;
            badge.style.display = isVisible ? 'inline-flex' : 'none';
        }

        document.addEventListener('firebase-connection', (event) => {
            if (!event?.detail?.connected) {
                return;
            }

            const now = Date.now();
            if (now - lastFirebaseReconnectAt < 3000) {
                return;
            }
            lastFirebaseReconnectAt = now;

            if (currentUserData) {
                if (typeof loadHistory === 'function') {
                    loadHistory();
                }
                if (typeof initBancosDados === 'function') {
                    initBancosDados();
                }
                // Sincronizar fila do servidor pendente
                OfflineSync.processQueue().catch(() => {});
            }
        });

        // ========================================
        // FUNÇÕES DE AUTENTICAÇÃO
        // ========================================
        function switchAuthTab(tab) {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            if (tab === 'login') {
                document.querySelector('.auth-tab:first-child').classList.add('active');
                document.getElementById('login-form').style.display = 'block';
                document.getElementById('register-form').style.display = 'none';
            } else {
                document.querySelector('.auth-tab:last-child').classList.add('active');
                document.getElementById('login-form').style.display = 'none';
                document.getElementById('register-form').style.display = 'block';
            }
            hideAuthError();
        }

        function setLoginFormEnabled(isEnabled) {
            const loginForm = document.getElementById('login-form');
            if (!loginForm) {
                return;
            }

            const controls = loginForm.querySelectorAll('input, button');
            controls.forEach((control) => {
                control.disabled = !isEnabled;
            });

            const loginButton = loginForm.querySelector('button[type="submit"]');
            if (!loginButton) {
                return;
            }

            if (isEnabled) {
                loginButton.innerHTML = lastLoginButtonLabel;
                return;
            }

            loginButton.innerHTML = '<i class="fas fa-wifi"></i> Entrar (offline indisponível)';
        }

        function updateLoginOfflineWarning() {
            if (currentUserData) {
                return;
            }
            if (!navigator.onLine) {
                if (!authResolvedOnce) {
                    return; // Aguardar o bootstrap terminar antes de interferir
                }
                setLoginFormEnabled(false);
                showAuthError('Sem conexão. Entre uma vez online para habilitar o modo offline');
                return;
            }
            setLoginFormEnabled(true);
            hideAuthError();
        }

        function showMainAppForAuthenticatedUser(user, options = {}) {
            const isOfflineFallback = options.offlineFallback === true;

            currentUserData = user;
            isUsingOfflineSessionFallback = isOfflineFallback;

            document.getElementById('user-email-display').textContent = user?.email || '';
            document.getElementById('auth-overlay').classList.add('hidden');
            document.getElementById('main-app').classList.add('show');
            document.getElementById('admin-badge-display').style.display = isUserAdmin ? 'inline-block' : 'none';
            setOfflineSessionBadge(isOfflineFallback);
            setLoginFormEnabled(true);

            if (isOfflineFallback) {
                const footerName = document.getElementById('user-name-footer');
                const footerEmail = document.getElementById('user-email-footer');
                if (footerName) footerName.textContent = options.displayName || user?.displayName || 'Usuário';
                if (footerEmail) footerEmail.textContent = user?.email || '';
                showAuthError('Offline (sessão local). Reconecte para validar com Firebase.');
                return;
            }

            hideAuthError();
            if (typeof initBancosDados === 'function') {
                initBancosDados();
            }
            if (typeof loadHistory === 'function') {
                loadHistory();
            }
        }

        function fallbackToOfflineSession() {
            const offlineSession = readOfflineSession();
            if (!offlineSession) {
                return false;
            }

            isUserAdmin = false;
            showMainAppForAuthenticatedUser({
                uid: offlineSession.uid,
                email: offlineSession.email,
                displayName: offlineSession.displayName || offlineSession.email
            }, {
                offlineFallback: true,
                displayName: offlineSession.displayName || offlineSession.email
            });
            showToast('📴 Sessão local restaurada. Operando em modo offline.', 'warning');
            return true;
        }

        async function handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const btn = e.target.querySelector('button');

            if (!navigator.onLine) {
                setLoginFormEnabled(false);
                showAuthError('Sem conexão. Entre uma vez online para habilitar o modo offline');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="loading"></span> Entrando...';

            try {
                const credential = await auth.signInWithEmailAndPassword(email, password);
                // Salvar sessão offline imediatamente após login bem-sucedido
                // não depender apenas do onAuthStateChanged para isso
                if (credential?.user) {
                    saveOfflineSession(credential.user);
                }
            } catch (error) {
                showAuthError(getAuthErrorMessage(error.code));
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
                lastLoginButtonLabel = btn.innerHTML;
            }
        }

        async function handleRegister(e) {
            e.preventDefault();
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const btn = e.target.querySelector('button');

            if (password.length < 6) {
                showAuthError('A senha deve ter no mínimo 6 caracteres!');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="loading"></span> Criando...';

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                await db.ref('users/' + user.uid).set({
                    name: name,
                    email: email,
                    createdAt: new Date().toISOString()
                });

                showToast('✅ Conta criada com sucesso!', 'success');
            } catch (error) {
                showAuthError(getAuthErrorMessage(error.code));
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-user-plus"></i> Criar Conta';
            }
        }

        async function handleLogoutClick() {
            if (!confirm('Deseja realmente sair?')) {
                return;
            }

            try {
                await auth.signOut();
                clearUserUi();
                window.history.replaceState(null, '', '/login.html');
                window.location.replace('/login.html');
            } catch (error) {
                console.error('Erro ao sair:', error);
                showToast('❌ Não foi possível sair agora. Tente novamente.', 'error');
            }
        }

        function clearUserUi() {
            const userEmailDisplay = document.getElementById('user-email-display');
            const footerName = document.getElementById('user-name-footer');
            const footerEmail = document.getElementById('user-email-footer');

            if (userEmailDisplay) userEmailDisplay.textContent = '';
            if (footerName) footerName.textContent = '';
            if (footerEmail) footerEmail.textContent = '';
        }

        function setupAuthUiBindings() {
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            const logoutButton = document.getElementById('header-logout-btn');

            if (loginForm) loginForm.addEventListener('submit', handleLogin);
            if (registerForm) registerForm.addEventListener('submit', handleRegister);
            if (logoutButton) logoutButton.addEventListener('click', handleLogoutClick);

            document.querySelectorAll('[data-auth-tab]').forEach((button) => {
                button.addEventListener('click', () => {
                    switchAuthTab(button.dataset.authTab || 'login');
                });
            });

            window.addEventListener('online', updateLoginOfflineWarning);
            window.addEventListener('offline', updateLoginOfflineWarning);
        }

        function showAuthError(msg) {
            const errorDiv = document.getElementById('auth-error');
            if (errorDiv) {
                errorDiv.textContent = msg;
                errorDiv.classList.add('show');
            }
        }

        function hideAuthError() {
            const errorDiv = document.getElementById('auth-error');
            if (errorDiv) {
                errorDiv.classList.remove('show');
            }
        }

        function getAuthErrorMessage(code) {
            const messages = {
                'auth/email-already-in-use': 'Este e-mail já está cadastrado!',
                'auth/invalid-email': 'E-mail inválido!',
                'auth/weak-password': 'Senha muito fraca!',
                'auth/user-not-found': 'Usuário não encontrado!',
                'auth/wrong-password': 'Senha incorreta!',
                'auth/too-many-requests': 'Muitas tentativas. Aguarde.'
            };
            return messages[code] || 'Erro na autenticação. Tente novamente.';
        }

        // ========================================
        // LISTENER DE AUTENTICAÇÃO
        // ========================================
        setupAuthUiBindings();

        // CORREÇÃO OFFLINE: Se não há internet e existe sessão local salva,
        // restaurar imediatamente sem esperar o Firebase responder
        if (!navigator.onLine && readOfflineSession()) {
            showAuthError('Verificando sessão...');
            setTimeout(() => {
                if (!currentUserData) {
                    fallbackToOfflineSession();
                }
            }, 300);
        } else {
            setLoginFormEnabled(false);
            showAuthError('Verificando sessão...');
        }

        if (!auth || typeof auth.onAuthStateChanged !== 'function') {
            authResolvedOnce = true;
            console.error('Firebase Auth indisponível no bootstrap');
            if (!fallbackToOfflineSession()) {
                showAuthError('Firebase Auth indisponível. Conecte-se para concluir o login.');
                setLoginFormEnabled(false);
            }
            return;
        }

        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((error) => {
            console.error('Não foi possível aplicar persistência local do Auth:', error);
        });

        const authBootstrapTimeout = setTimeout(() => {
            if (authResolvedOnce) {
                return;
            }

            authBootstrapTimedOut = true;
            console.warn('Timeout de autenticação: onAuthStateChanged não respondeu em 5000ms');
            if (!fallbackToOfflineSession()) {
                showAuthError('Falha ao verificar sessão (timeout). Verifique o carregamento do Firebase SDK e tente novamente.');
                setLoginFormEnabled(navigator.onLine);
            }
        }, 5000);

        auth.onAuthStateChanged(async (user) => {
            clearTimeout(authBootstrapTimeout);
            authResolvedOnce = true;

            if (authBootstrapTimedOut) {
                console.info('Autenticação respondeu após timeout de bootstrap');
                authBootstrapTimedOut = false;
            }

            if (user) {
                if (isUsingOfflineSessionFallback && currentUserData?.uid && currentUserData.uid !== user.uid) {
                    showAuthError('Sessão local divergiu da conta online. Faça login novamente para continuar.');
                    clearOfflineSession();
                    await auth.signOut();
                    return;
                }

                // Limpar sessão anterior se pertencer a outro usuário
                const existingSession = readOfflineSession();
                if (existingSession && existingSession.uid !== user.uid) {
                    clearOfflineSession();
                }
                saveOfflineSession(user);

                // CORREÇÃO DEFINITIVA OFFLINE:
                // db.ref().once('value') não lança erro quando offline — ele trava indefinidamente.
                // Se não há internet, entrar direto no app com sessão local sem consultar o banco.
                if (!navigator.onLine) {
                    const offlineSession = readOfflineSession();
                    const displayName = offlineSession?.displayName || user.displayName || user.email;
                    isUserAdmin = false;
                    showMainAppForAuthenticatedUser(
                        { uid: user.uid, email: user.email, displayName },
                        { offlineFallback: true, displayName }
                    );
                    showToast('📴 Sessão local restaurada. Operando em modo offline.', 'warning');
                    return;
                }

                try {
                    const snapshot = await db.ref('users/' + user.uid).once('value');
                    const userData = snapshot.val();
                    const tokenResult = await auth.currentUser.getIdTokenResult();
                    isUserAdmin = tokenResult?.claims?.admin === true;

                    const footerName = document.getElementById('user-name-footer');
                    const footerEmail = document.getElementById('user-email-footer');
                    if (footerName) footerName.textContent = userData?.name || 'Usuário';
                    if (footerEmail) footerEmail.textContent = user.email;

                    showMainAppForAuthenticatedUser(user);
                    showToast('✅ Bem-vindo(a), ' + (userData?.name || user.email) + '!', 'success');

                    if (navigator.onLine) {
                        syncPendingData();
                        OfflineSync.processQueue();
                        OutboxSync.processOutbox();
                    }
                } catch (error) {
                    console.error('Erro ao carregar dados do usuário:', error);
                    // Fallback para o caso raro de perder conexão exatamente durante o carregamento
                    if (!navigator.onLine) {
                        const offlineSession = readOfflineSession();
                        const displayName = offlineSession?.displayName || user.displayName || user.email;
                        isUserAdmin = false;
                        showMainAppForAuthenticatedUser(
                            { uid: user.uid, email: user.email, displayName },
                            { offlineFallback: true, displayName }
                        );
                        showToast('📴 Sessão local restaurada. Operando em modo offline.', 'warning');
                    } else {
                        showMainAppForAuthenticatedUser(user);
                        showToast('⚠️ Erro ao carregar perfil. Tente recarregar.', 'warning');
                    }
                }
            } else {
                currentUserData = null;
                isUsingOfflineSessionFallback = false;
                isUserAdmin = false;
                clearUserUi();
                setOfflineSessionBadge(false);
                document.getElementById('auth-overlay').classList.remove('hidden');
                document.getElementById('main-app').classList.remove('show');
                document.getElementById('admin-badge-display').style.display = 'none';

                if (fallbackToOfflineSession()) {
                    return;
                }

                updateLoginOfflineWarning();
            }
        });

        console.log('🌿 CaldaCerta Pro com Sistema de Login - PRONTO!');

})();
