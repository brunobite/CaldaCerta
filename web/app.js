// ============================================
    // CONFIGURAÇÃO DO FIREBASE
    // ============================================
    // IMPORTANTE: Substitua com suas credenciais reais do Firebase
    // Para obter suas credenciais:
    // 1. Acesse: https://console.firebase.google.com/
    // 2. Selecione seu projeto (ou crie um novo)
    // 3. Vá em Configurações do Projeto (ícone de engrenagem)
    // 4. Role até "Seus aplicativos" e selecione o app web
    // 5. Copie o objeto firebaseConfig

    const firebaseConfig = {
  apiKey: "AIzaSyCWLwnpqAVyreJmj6Nsto7vox-B3SuOlFY",
  authDomain: "caldacerta-pro.firebaseapp.com",
  databaseURL: "https://caldacerta-pro-default-rtdb.firebaseio.com",
  projectId: "caldacerta-pro",
  storageBucket: "caldacerta-pro.firebasestorage.app",
  messagingSenderId: "980579278802",
  appId: "1:980579278802:web:c15f7e6cd2721580c3720b"
};

    // Inicializar Firebase
    firebase.initializeApp(firebaseConfig);
    
    // Criar referências globais
    window.auth = firebase.auth();
    window.database = firebase.database();
    
    // Constante do Admin
    window.ADMIN_EMAIL = 'bitencourttec@gmail.com';

    console.log('🔥 Firebase inicializado com sucesso!');
    console.log('📧 Para criar conta admin use: bitencourttec@gmail.com');

// Objeto API mock para não quebrar código legado
    window.API = window.API || {};
    if (typeof window.API_BASE === 'undefined') {
        window.API_BASE = '';
    }

// VERSÃO COM API - BACKEND NODE.JS + SQLITE
        // A configuração da API está em api-config.js

        let products = [];
        let historicalData = [];
        let currentStepIdx = 0;
        const steps = ['menu', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6'];
        let climateData = null;
        let currentEditingSimulation = null;

        // Bancos de dados (carregados da API)
        let bancoProdutos = [];
        let bancoClientes = [];
        let bancoPropriedades = [];
        let bancoTalhoes = [];
        let bancoResponsaveis = [];
        let bancoOperadores = [];

        // ✅ MODO API: leitura / badge / toggle
        function getModoAtual() {
            const forced = (localStorage.getItem("MODO_API") || "").toLowerCase();
            if (forced === "local") return "local";
            if (forced === "remoto") return "remoto";

            const base = (window.API_BASE || "");
            return base.includes("localhost") ? "local" : "remoto";
        }

        function atualizarBadgeModo() {
            const btn = document.getElementById("user-display");
            if (!btn) return;

            const modo = getModoAtual();
            const host = location.hostname;
            const base = window.API_BASE || "(não definido)";

            if (modo === "local") {
                btn.textContent = "Modo Local";
                btn.title = `Usando API local (${base}) | host=${host}`;
            } else {
                btn.textContent = "Modo Remoto";
                btn.title = `Usando API remoto (${base}) | host=${host}`;
            }
        }

        window.toggleApiMode = () => {
            const modo = getModoAtual();
            localStorage.setItem("MODO_API", modo === "local" ? "remoto" : "local");
            location.reload();
        };

        // Inicializar bancos de dados da API
        async function initBancosDados() {
            try {
                // Carregar produtos do Firebase (se o usuário estiver logado)
                if (currentUserData) {
                    const produtosRef = db.ref('produtos/' + currentUserData.uid);
                    const snapshot = await produtosRef.once('value');
                    const produtosData = snapshot.val() || {};
                    bancoProdutos = Object.keys(produtosData).map(key => ({
                        id: key,
                        ...produtosData[key]
                    }));
                    console.log(`✅ ${bancoProdutos.length} produtos carregados do Firebase`);
                } else {
                    bancoProdutos = [];
                }

                // Listas padrão (podem ser expandidas conforme necessário)
                bancoClientes = [];
                bancoResponsaveis = [];
                bancoOperadores = [];

                console.log('✅ Usando Firebase como banco de dados');

                preencherDatalist('clientes-list', bancoClientes);
                preencherDatalist('propriedades-list', bancoPropriedades);
                preencherDatalist('talhoes-list', bancoTalhoes);
                preencherDatalist('responsaveis-list', bancoResponsaveis);
                preencherDatalist('operadores-list', bancoOperadores);

                preencherSelectProdutos();

                console.log('✅ Bancos de dados Firebase carregados!');
            } catch (error) {
                console.error('❌ Erro ao carregar do Firebase:', error);
            }
        }

        function preencherDatalist(elementId, dados) {
            const datalist = document.getElementById(elementId);
            datalist.innerHTML = dados.map(item => `<option value="${item}">`).join('');
        }

        function preencherSelectProdutos() {
            const select = document.getElementById('p_banco');
            select.innerHTML = '<option value="">-- Selecione um produto --</option>' +
                bancoProdutos.map((p, idx) => `<option value="${idx}">${p.nome} (${p.marca})</option>`).join('');
        }

        // Toggle entre banco e manual
        let usandoBanco = true;
        window.toggleNovoOuBanco = () => {
            usandoBanco = !usandoBanco;
            const bancDiv = document.getElementById('produto-banco');
            const toggleText = document.getElementById('toggle-text');
            const camposReadonly = ['p_nome', 'p_marca', 'p_formulacao', 'p_tipo'];

            if (usandoBanco) {
                bancDiv.style.display = 'block';
                toggleText.innerText = 'Produto Novo';
                document.getElementById('p_banco').selectedIndex = 0;
                limparCamposProduto();
            } else {
                bancDiv.style.display = 'none';
                toggleText.innerText = 'Buscar no Banco';
                camposReadonly.forEach(id => { document.getElementById(id).disabled = false; });
                limparCamposProduto();
                document.getElementById('p_nome').focus();
            }
        };

        function limparCamposProduto() {
            document.getElementById('p_nome').value = '';
            document.getElementById('p_marca').value = '';
            document.getElementById('p_dose').value = '';
            document.getElementById('p_ph').value = '';
            document.getElementById('p_formulacao').selectedIndex = 0;
            document.getElementById('p_tipo').selectedIndex = 0;
        }

        window.preencherDoBanco = () => {
            const selectIdx = document.getElementById('p_banco').value;
            if (selectIdx === '') {
                limparCamposProduto();
                return;
            }

            const produto = bancoProdutos[parseInt(selectIdx)];

            document.getElementById('p_nome').value = produto.nome;
            document.getElementById('p_marca').value = produto.marca;
            document.getElementById('p_formulacao').value = produto.formulacao;
            document.getElementById('p_tipo').value = produto.tipo;
            document.getElementById('p_ph').value = produto.ph || '';

            document.getElementById('p_dose').value = '';
            setTimeout(() => { document.getElementById('p_dose').focus(); }, 100);
        };

        function getApiBase() {
            return window.API_BASE || '';
        }

        async function fetchJson(url, options = {}) {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`Erro ao acessar ${url}: ${response.status}`);
            }
            return response.json();
        }

        async function loadHistoryFromServer() {
            const base = getApiBase();
            const uidParam = !isUserAdmin && currentUserData ? `?uid=${encodeURIComponent(currentUserData.uid)}` : '';
            const url = `${base}/api/simulacoes${uidParam}`;
            return fetchJson(url);
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
                    if (!sims) return;
                    Object.entries(sims).forEach(([id, sim]) => {
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
            console.log(`✅ ${items.length} simulações carregadas do Firebase`);
            return items;
        }

        async function loadHistory() {
            try {
                if (!currentUserData) {
                    historicalData = [];
                    renderHistoryList(historicalData);
                    return;
                }

                try {
                    historicalData = await loadHistoryFromServer();
                    console.log(`✅ ${historicalData.length} simulações carregadas do servidor`);
                } catch (error) {
                    console.warn('⚠️ Falha ao carregar histórico do servidor, usando Firebase.', error);
                    historicalData = await loadHistoryFromFirebase();
                }

                renderHistoryList(historicalData);
            } catch (e) {
                console.error('Erro ao carregar histórico:', e);
                historicalData = [];
                showToast('⚠️ Erro ao carregar histórico', 'error');
            }
        }

        function sortProductsByHierarchy(products, criterio = 'tipo') {
            const hierarchy = {
                'ADJUVANTE': 1, 'ESPALHANTE': 1, 'ANTIESPUMA': 1,
                'PRODUTO': 2, 'SC': 2, 'CE': 2, 'WG': 2, 'EW': 2, 'OD': 2,
                'FERTILIZANTE': 3,
                'OLEO': 4
            };

            return [...products].sort((a, b) => {
                const prioA = hierarchy[a.tipo] || hierarchy[a.formulacao] || 2;
                const prioB = hierarchy[b.tipo] || hierarchy[b.formulacao] || 2;

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
                        return a.formulacao.localeCompare(b.formulacao);
                    }
                }

                return 0;
            });
        }

        window.toggleHierarchyOptions = () => {
            const checked = document.getElementById('respeitarHierarquia').checked;
            const options = document.getElementById('hierarchyOptions');
            options.style.display = checked ? 'block' : 'none';
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
            const base = getApiBase();
            const now = new Date().toISOString();
            const editingAllowed = currentEditingSimulation && currentEditingSimulation.source === 'server';
            const body = {
                ...payload,
                uid: currentUserData?.uid || null,
                userEmail: currentUserData?.email || '',
                updatedAt: now,
                createdAt: editingAllowed ? currentEditingSimulation.createdAt || now : now
            };

            if (editingAllowed && currentEditingSimulation?.id) {
                const url = `${base}/api/simulacoes/${currentEditingSimulation.id}`;
                return fetchJson(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            }

            const url = `${base}/api/simulacoes`;
            return fetchJson(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        }

        window.saveSimulation = async () => {
            if (!validateRequiredField('id_cliente', '❌ Preencha o nome do cliente')) {
                return;
            }
            if (!validateRequiredField('id_cultura', '❌ Selecione a cultura')) {
                return;
            }
            if (!validatePositiveNumber('id_area', '❌ Informe uma área válida')) {
                return;
            }
            if (!validatePositiveNumber('eq_tanque', '❌ Informe a capacidade do tanque')) {
                return;
            }
            if (!validatePositiveNumber('eq_vazao', '❌ Informe a vazão do equipamento')) {
                return;
            }
            if (!validateRange('agua_ph', 0, 14, '❌ O pH da água deve estar entre 0 e 14')) {
                return;
            }
            if (!validateRange('calda_ph', 0, 14, '❌ O pH da calda deve estar entre 0 e 14')) {
                return;
            }

            if (products.length === 0) {
                showToast('❌ Adicione pelo menos um produto', 'error');
                return;
            }

            syncProductObservationsFromDom();

            const btn = document.getElementById('btn-save-cloud');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

            const payload = {
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
                respeitar_hierarquia: document.getElementById('respeitarHierarquia').checked ? 1 : 0,
                criterio_ordenacao: document.getElementById('criterioOrdenacao').value,
                produtos: products
            };

            try {
                if (!currentUserData) {
                    showToast('❌ Você precisa estar logado!', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-save text-xl"></i> Salvar Simulação Completa';
                    return;
                }

                let savedOnServer = false;
                try {
                    await saveSimulationToServer(payload);
                    savedOnServer = true;
                    currentEditingSimulation = null;
                } catch (error) {
                    console.warn('⚠️ Falha ao salvar no servidor, tentando Firebase.', error);
                }

                if (!savedOnServer) {
                    const now = new Date().toISOString();
                    const editingAllowed = currentEditingSimulation && (isUserAdmin || currentEditingSimulation.uid === currentUserData.uid);
                    const targetUid = editingAllowed ? currentEditingSimulation.uid : currentUserData.uid;
                    const targetRef = db.ref(`simulacoes/${targetUid}`);

                    if (editingAllowed && currentEditingSimulation?.id) {
                        await targetRef.child(currentEditingSimulation.id).update({
                            ...payload,
                            userEmail: currentEditingSimulation.userEmail || currentUserData.email,
                            updatedAt: now,
                            createdAt: currentEditingSimulation.createdAt || now
                        });
                        currentEditingSimulation = null;
                    } else {
                        await targetRef.push({
                            ...payload,
                            userEmail: currentUserData.email,
                            createdAt: now
                        });
                    }
                }

                showToast('✅ Simulação salva com sucesso!', 'success');
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvo com Sucesso';
                btn.classList.add('opacity-50');

                await loadHistory();
                await initBancosDados();
            } catch (e) {
                console.error('Erro ao salvar:', e);
                showToast('❌ Erro ao salvar simulação', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-save text-xl"></i> Salvar Simulação Completa';
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
                const adminInfo = isUserAdmin ? `<span class="badge badge-accent">Usuário: ${item.userEmail || item.uid || 'N/D'}</span>` : '';
                const adminEditButton = isUserAdmin ? `
                    <button class="btn btn-secondary text-xs" onclick="event.stopPropagation(); viewSimulation('${item.id}', '${item.uid || ''}')">
                        <i class="fa-solid fa-pen mr-1"></i> Editar
                    </button>
                ` : '';

                return `
                    <div class="card card-medium history-card" onclick="viewSimulation('${item.id}', '${item.uid || ''}')">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h4 class="font-black text-xl text-slate-800 mb-1">${item.cliente}</h4>
                                <p class="text-sm text-slate-600">${item.propriedade} - ${item.talhao}</p>
                            </div>
                            <div class="flex flex-col items-end gap-2">
                                <span class="badge badge-primary">${item.cultura}</span>
                                ${adminEditButton}
                            </div>
                        </div>
                        <div class="history-meta text-sm text-slate-500">
                            <span><i class="fa-solid fa-calendar mr-1"></i>${date}</span>
                            <span><i class="fa-solid fa-map-marked-alt mr-1"></i>${item.area} ha</span>
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
                let loadedFromServer = false;

                try {
                    item = await fetchSimulationFromServer(id, ownerUid);
                    loadedFromServer = true;
                } catch (error) {
                    console.warn('⚠️ Falha ao carregar simulação do servidor, usando Firebase.', error);
                }

                if (!item) {
                    const simRef = db.ref('simulacoes/' + ownerUid + '/' + id);
                    const snapshot = await simRef.once('value');
                    item = snapshot.val();
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
                document.getElementById('respeitarHierarquia').checked = !!item.respeitar_hierarquia;
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
                    tipo: p.tipo,
                    ph: p.ph,
                    observacao: p.observacao || p.observacoes || ''
                }));

                currentEditingSimulation = {
                    id,
                    uid: ownerUid,
                    userEmail: item.userEmail || '',
                    createdAt: item.createdAt || '',
                    source: loadedFromServer ? 'server' : 'firebase'
                };

                renderProductList();
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
                btnSave.disabled = false;
                btnSave.innerHTML = '<i class="fa-solid fa-save text-xl"></i> Salvar Simulação';
                btnSave.classList.remove('opacity-50');
                renderOrdem();
            }

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
            document.getElementById('respeitarHierarquia').checked = true;
            navTo('2-1');
        };

        // Produtos
        window.addProduto = async () => {
            const nome = document.getElementById('p_nome').value;
            const dose = parseFloat(document.getElementById('p_dose').value);
            const formulacao = document.getElementById('p_formulacao').value;
            const marca = document.getElementById('p_marca').value;
            const tipo = document.getElementById('p_tipo').value;
            const ph = parseFloat(document.getElementById('p_ph').value) || null;

            if (!nome || !Number.isFinite(dose) || dose <= 0) {
                showToast('❌ Preencha nome e dose do produto', 'error');
                return;
            }
            if (ph !== null && (ph < 0 || ph > 14)) {
                showToast('❌ O pH do produto deve estar entre 0 e 14', 'error');
                return;
            }

            const p = {
                id: Date.now(),
                nome: nome,
                marca: marca || 'Não informada',
                dose: dose,
                formulacao: formulacao,
                tipo: tipo,
                ph: ph
            };

            products.push(p);
            renderProductList();

            if (!usandoBanco && !bancoProdutos.find(bp => bp.nome === nome && bp.marca === marca)) {
                try {
                    // Salvar produto no Firebase
                    if (currentUserData) {
                        const prodRef = db.ref('produtos/' + currentUserData.uid);
                        await prodRef.push({
                            nome,
                            marca,
                            formulacao,
                            tipo,
                            ph,
                            createdAt: new Date().toISOString()
                        });
                        await initBancosDados();
                        showToast('💾 Produto salvo no banco de dados', 'success');
                    }
                } catch (e) {
                    console.error('Erro ao salvar produto:', e);
                }
            }

            document.getElementById('p_nome').value = "";
            document.getElementById('p_marca').value = "";
            document.getElementById('p_dose').value = "";
            document.getElementById('p_ph').value = "";
            document.getElementById('p_formulacao').selectedIndex = 0;
            document.getElementById('p_tipo').selectedIndex = 0;
            document.getElementById('p_banco').selectedIndex = 0;

            showToast('✅ Produto adicionado à lista', 'success');
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
            lista.innerHTML = products.map((p, idx) => `
                <div class="product-item">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="badge badge-accent">${idx + 1}</span>
                            <h4 class="font-bold text-slate-800">${p.nome}</h4>
                            <span class="badge badge-primary text-xs">${p.formulacao}</span>
                        </div>
                        <p class="text-sm text-slate-600">
                            ${p.marca} · <span class="font-semibold">${p.dose}</span> L-Kg/ha
                        </p>
                    </div>
                    <button onclick="removeProduct(${p.id})" class="btn btn-icon">
                        <i class="fa-solid fa-trash text-lg"></i>
                    </button>
                </div>
            `).join('');
        }

        window.removeProduct = (id) => {
            products = products.filter(p => p.id !== id);
            renderProductList();
            showToast('🗑️ Produto removido', 'success');
        };

        // Cálculos
        window.calcRendimento = () => {
            const tanque = parseFloat(document.getElementById('eq_tanque').value) || 0;
            const vazao = parseFloat(document.getElementById('eq_vazao').value) || 0;
            const rendimento = vazao > 0 ? (tanque / vazao).toFixed(2) : "0.0";
            document.getElementById('res_rendimento').innerText = rendimento;
        };

        // Atualizar observação do produto
        window.updateProductObservation = (productId, observacao) => {
            const product = products.find(p => p.id === productId);
            if (product) {
                product.observacao = observacao;
            }
        };

        window.renderOrdem = () => {
            const jarra = parseFloat(document.getElementById('jarra_vol').value);
            const vazao = parseFloat(document.getElementById('eq_vazao').value) || 100;
            const tanque = parseFloat(document.getElementById('eq_tanque').value) || 2000;
            const area = parseFloat(document.getElementById('id_area').value) || 10;
            const container = document.getElementById('ordem-container');
            const respeitar = document.getElementById('respeitarHierarquia').checked;
            const criterio = document.getElementById('criterioOrdenacao').value;

            if (products.length === 0) {
                container.innerHTML = '<div class="empty-state"><p class="text-slate-500">Nenhum produto adicionado</p></div>';
                return;
            }

            let displayProducts = respeitar ? sortProductsByHierarchy(products, criterio) : products;

            container.innerHTML = displayProducts.map((p, i) => {
                const doseJarra = ((p.dose * jarra) / vazao).toFixed(2);
                const doseTanque = ((p.dose * tanque) / vazao).toFixed(2);
                const volumeTotal = (p.dose * area).toFixed(2);
                const phDisplay = p.ph ? `pH FISPQ: ${p.ph}` : '';
                const observacao = p.observacao || '';
                const orderOptions = displayProducts
                    .map((_, idx) => `<option value="${idx}" ${idx === i ? 'selected' : ''}>Ordem ${idx + 1}</option>`)
                    .join('');

                return `
                    <div class="product-item ordem-card" data-id="${p.id}">
                        <div class="flex-1">
                            <div class="ordem-card-header flex justify-between items-center mb-3">
                                <div class="ordem-card-badges flex items-center gap-3">
                                    <span class="badge badge-primary">Ordem ${i+1}</span>
                                    <span class="badge badge-accent">${p.formulacao}</span>
                                    ${phDisplay ? `<span class="badge badge-success">${phDisplay}</span>` : ''}
                                </div>
                                ${respeitar ? '' : `
                                    <select class="input-box ordem-select" aria-label="Selecionar ordem do produto" data-product-id="${p.id}">
                                        ${orderOptions}
                                    </select>
                                `}
                            </div>
                            <div class="ordem-card-content">
                                <div class="ordem-card-info">
                                    <h4 class="text-lg font-black text-slate-800 mb-1">${p.nome}</h4>
                                    <p class="text-sm text-slate-600">${p.marca}</p>
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

            container.querySelectorAll('.ordem-select').forEach(select => {
                select.addEventListener('change', (event) => {
                    const productId = event.target.dataset.productId;
                    const newIndex = Number(event.target.value);
                    const currentIndex = products.findIndex(item => item.id === productId);
                    if (currentIndex === -1 || newIndex === currentIndex) {
                        return;
                    }
                    const movedItem = products.splice(currentIndex, 1)[0];
                    products.splice(newIndex, 0, movedItem);
                    renderOrdem();
                    showToast('📦 Ordem atualizada', 'success');
                });
            });
        };

        // Clima
        function checkClimateConditions(deltaTValues) {
            const alertContainer = document.getElementById('alert-container');
            const deltaT = deltaTValues && deltaTValues.length ? deltaTValues : [
                2, 3, 5, 6, 4, 3, 2, 4, 5, 4, 3, 2,
                3, 4, 5, 6, 7, 6, 5, 4, 3, 3, 2, 2,
                2, 3, 5, 6, 4, 3, 2, 4, 5, 4, 3, 2,
                3, 4, 5, 6, 7, 6, 5, 4, 3, 3, 2, 2
            ];
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
            const values = windValues?.length ? windValues : [
                4, 5, 6, 5, 4, 3, 4, 6, 7, 8, 9, 8,
                7, 6, 5, 6, 7, 6, 5, 4, 4, 3, 3, 4,
                4, 5, 6, 5, 4, 3, 4, 6, 7, 8, 9, 8,
                7, 6, 5, 6, 7, 6, 5, 4, 4, 3, 3, 4
            ];

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
            const values = windValues?.length ? windValues : [
                4, 5, 6, 5, 4, 3, 4, 6, 7, 8, 9, 8,
                7, 6, 5, 6, 7, 6, 5, 4, 4, 3, 3, 4,
                4, 5, 6, 5, 4, 3, 4, 6, 7, 8, 9, 8,
                7, 6, 5, 6, 7, 6, 5, 4, 4, 3, 3, 4
            ];

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

        // PDF
        window.generatePDF = () => {
            syncProductObservationsFromDom();
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
            doc.text(document.getElementById('id_cliente').value, col1 + 20, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('PROPRIEDADE:', col1, y);
            doc.setFont(undefined, 'normal');
            doc.text(document.getElementById('id_propriedade').value, col1 + 30, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('TALHÃO:', col1, y);
            doc.setFont(undefined, 'normal');
            doc.text(document.getElementById('id_talhao').value, col1 + 20, y);

            y = 45;
            doc.setFont(undefined, 'bold');
            doc.text('DATA APLICAÇÃO:', col2, y);
            doc.setFont(undefined, 'normal');
            const dataAplicacao = new Date(document.getElementById('id_data').value).toLocaleDateString('pt-BR');
            doc.text(dataAplicacao, col2 + 35, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('CULTURA:', col2, y);
            doc.setFont(undefined, 'normal');
            doc.text(document.getElementById('id_cultura').value, col2 + 20, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('ÁREA:', col2, y);
            doc.setFont(undefined, 'normal');
            doc.text(`${document.getElementById('id_area').value} ha`, col2 + 15, y);

            y = 45;
            doc.setFont(undefined, 'bold');
            doc.text('RESP. TÉCNICO:', col3, y);
            doc.setFont(undefined, 'normal');
            doc.text(document.getElementById('id_responsavel').value, col3 + 35, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('OPERADOR:', col3, y);
            doc.setFont(undefined, 'normal');
            doc.text(document.getElementById('eq_operador').value, col3 + 25, y);

            y += 7;
            doc.setFont(undefined, 'bold');
            doc.text('OBJETIVO:', col3, y);
            doc.setFont(undefined, 'normal');
            doc.text(document.getElementById('id_objetivo').value, col3 + 23, y);

            y += 12;
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('DADOS DA MÁQUINA', col1, y);

            y += 7;
            doc.setFontSize(9);
            doc.text(`Capacidade: ${document.getElementById('eq_tanque').value} L  |  Vazão: ${document.getElementById('eq_vazao').value} L/ha  |  Rendimento: ${document.getElementById('res_rendimento').innerText} ha/tanque`, col1, y);

            y += 10;
            const jarra = parseFloat(document.getElementById('jarra_vol').value);
            const vazao = parseFloat(document.getElementById('eq_vazao').value) || 100;
            const tanque = parseFloat(document.getElementById('eq_tanque').value) || 2000;
            const area = parseFloat(document.getElementById('id_area').value) || 10;
            const respeitar = document.getElementById('respeitarHierarquia').checked;
            const criterio = document.getElementById('criterioOrdenacao').value;

            let displayProducts = respeitar ? sortProductsByHierarchy(products, criterio) : products;

            const tableData = displayProducts.map((p, i) => [
                `${i + 1}`,
                p.nome,
                p.observacao || '-',
                p.ph ? `${p.ph}` : '-',
                `${p.dose}`,
                `${((p.dose * jarra) / vazao).toFixed(2)}`,
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

            doc.text(`pH na calda: ${caldaPh}`, waterRightX, waterRightY);
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

            const renderSection = ({ title, titleColor, bgColor, ranges, emptyText, reasonColor, formatReasons }, startX, startY) => {
                doc.setFillColor(...bgColor);
                doc.roundedRect(startX, startY, columnWidth, 4, 1, 1, 'F');
                doc.setFontSize(7);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(...titleColor);
                doc.text(title, startX + 4, startY + 3);

                let currentY = startY + 6;
                doc.setFont(undefined, 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(0, 0, 0);

                if (!ranges.length) {
                    doc.text(emptyText, startX + 4, currentY, { maxWidth: columnWidth - 8 });
                    currentY += 4;
                } else {
                    ranges.forEach(range => {
                        const period = range.start === range.end ? range.start : `${range.start} — ${range.end}`;
                        doc.setFont(undefined, 'bold');
                        doc.text(period, startX + 4, currentY);
                        doc.setFont(undefined, 'normal');
                        if (range.reasons.length) {
                            doc.setTextColor(...reasonColor);
                            doc.text(formatReasons(range.reasons), startX + 4, currentY + 3.5, { maxWidth: columnWidth - 8 });
                            doc.setTextColor(0, 0, 0);
                        }
                        currentY += 8;
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

            rightY = renderSection(
                {
                    title: 'NÃO APLICAR',
                    titleColor: [153, 27, 27],
                    bgColor: [254, 242, 242],
                    ranges: analysis.naoAplicar,
                    emptyText: 'Nenhum período com condições impeditivas identificado.',
                    reasonColor: [180, 30, 30],
                    formatReasons: (reasons) => reasons.join('; ')
                },
                rightX,
                rightY + 2
            );

            // Technical reference footer
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(6);
            doc.setTextColor(130, 130, 130);
            doc.text('Referência técnica: Delta T ideal 2–8°C | Cautela 8–10°C | Evitar >10°C | Inversão térmica <2°C | Vento ideal 3–10 km/h', 15, pageHeight - 8);
            doc.text('Análise gerada automaticamente com base nos dados meteorológicos. Consulte um engenheiro agrônomo para decisões finais.', 15, pageHeight - 4);
            doc.setTextColor(0, 0, 0);

            doc.save(`CaldaCerta_${document.getElementById('id_cliente').value}_${new Date().toISOString().split('T')[0]}.pdf`);
            showToast('✅ PDF completo gerado com sucesso!', 'success');
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
            const deltaSeries = climateData?.deltaT || [
                2, 3, 5, 6, 4, 3, 2, 4, 5, 4, 3, 2,
                3, 4, 5, 6, 7, 6, 5, 4, 3, 3, 2, 2
            ];
            const temperatureSeries = climateData?.temperatures || [
                20, 21, 22, 23, 24, 26, 28, 30, 32, 33, 34, 33,
                32, 31, 30, 29, 28, 27, 26, 24, 23, 22, 21, 20
            ];
            const humiditySeries = climateData?.humidity || [
                85, 84, 82, 80, 78, 75, 70, 65, 60, 55, 50, 48,
                46, 48, 52, 56, 60, 64, 68, 72, 76, 80, 83, 85
            ];
            const windSeries = climateData?.winds || [
                4, 5, 6, 5, 4, 3, 4, 6, 7, 8, 9, 8,
                7, 6, 5, 6, 7, 6, 5, 4, 4, 3, 3, 4
            ];
            const precipSeries = climateData?.precipitation || Array.from({ length: CLIMATE_HOURS }, () => 0);

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
            const deltaSeries = climateData?.deltaT || [
                2, 3, 5, 6, 4, 3, 2, 4, 5, 4, 3, 2,
                3, 4, 5, 6, 7, 6, 5, 4, 3, 3, 2, 2
            ];
            const temperatureSeries = climateData?.temperatures || [
                20, 21, 22, 23, 24, 26, 28, 30, 32, 33, 34, 33,
                32, 31, 30, 29, 28, 27, 26, 24, 23, 22, 21, 20
            ];
            const humiditySeries = climateData?.humidity || [
                85, 84, 82, 80, 78, 75, 70, 65, 60, 55, 50, 48,
                46, 48, 52, 56, 60, 64, 68, 72, 76, 80, 83, 85
            ];
            const windSeries = climateData?.winds || [
                4, 5, 6, 5, 4, 3, 4, 6, 7, 8, 9, 8,
                7, 6, 5, 6, 7, 6, 5, 4, 4, 3, 3, 4
            ];
            const precipSeries = climateData?.precipitation || Array.from({ length: CLIMATE_HOURS }, () => 0);

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

        function formatDateISO(date) {
            return date.toISOString().split('T')[0];
        }

        async function fetchOpenMeteoData(latitude, longitude, startDate, endDate) {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,precipitation&start_date=${formatDateISO(startDate)}&end_date=${formatDateISO(endDate)}&timezone=auto`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Falha ao obter dados meteorológicos.');
            }
            const data = await response.json();
            data.source = 'open-meteo';
            return data;
        }

        async function fetchInmetData(latitude, longitude, startDate, endDate) {
            const url = `/api/inmet?lat=${latitude}&lon=${longitude}&start_date=${formatDateISO(startDate)}&end_date=${formatDateISO(endDate)}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Falha ao obter dados do INMET.');
            }
            return response.json();
        }

        async function fetchClimateData(latitude, longitude, startDate, endDate) {
            try {
                return await fetchInmetData(latitude, longitude, startDate, endDate);
            } catch (error) {
                console.warn('INMET indisponível, usando Open-Meteo como fallback.', error);
                return fetchOpenMeteoData(latitude, longitude, startDate, endDate);
            }
        }

        function buildClimateSeries(data, startDate) {
            const times = data?.hourly?.time || [];
            const temps = data?.hourly?.temperature_2m || [];
            const humidity = data?.hourly?.relativehumidity_2m || [];
            const winds = data?.hourly?.windspeed_10m || [];
            const precipitation = data?.hourly?.precipitation || [];
            if (!times.length) return null;

            const start = startDate ?? new Date();
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            const startIndex = Math.max(times.findIndex(t => new Date(t) >= start), 0);
            const endIndex = Math.max(times.findIndex(t => new Date(t) >= end), startIndex + CLIMATE_HOURS);
            const sliceTimes = times.slice(startIndex, endIndex);
            const sliceTemps = temps.slice(startIndex, endIndex);
            const sliceHumidity = humidity.slice(startIndex, endIndex);
            const sliceWinds = winds.slice(startIndex, endIndex);
            const slicePrecip = precipitation.slice(startIndex, endIndex);

            const labels = sliceTimes.map(time => new Date(time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
            const deltaT = sliceTemps.map((temp, idx) => computeDeltaT(temp, sliceHumidity[idx] ?? 50));

            return {
                labels,
                temperatures: sliceTemps,
                humidity: sliceHumidity,
                winds: sliceWinds,
                precipitation: slicePrecip,
                deltaT,
                source: data?.source || 'inmet'
            };
        }

        window.refreshClimate = async () => {
            const latField = document.getElementById('clima_lat');
            const lonField = document.getElementById('clima_lon');
            const latitude = parseFloat(latField.value);
            const longitude = parseFloat(lonField.value);
            const applicationDateValue = document.getElementById('id_data').value;
            const applicationDate = applicationDateValue ? new Date(`${applicationDateValue}T00:00:00`) : new Date();
            const endDate = new Date(applicationDate);
            endDate.setDate(endDate.getDate() + 1);

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                showToast('❌ Informe latitude e longitude válidas.', 'error');
                return;
            }

            try {
                showToast('⏳ Buscando dados meteorológicos...', 'success');
                const data = await fetchClimateData(latitude, longitude, applicationDate, endDate);
                const series = buildClimateSeries(data, applicationDate);
                if (!series) {
                    showToast('❌ Dados meteorológicos indisponíveis.', 'error');
                    return;
                }
                climateData = series;
                initCharts();
                renderClimateTables();
                checkClimateConditions(series.deltaT);
                const sourceMessage = series.source === 'inmet'
                    ? '✅ Clima atualizado com INMET.'
                    : '⚠️ INMET indisponível. Dados carregados via Open-Meteo.';
                showToast(sourceMessage, series.source === 'inmet' ? 'success' : 'error');
            } catch (error) {
                console.error(error);
                showToast('❌ Erro ao atualizar clima. Tente novamente.', 'error');
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
            toast.style.background = type === 'error' ? '#dc2626' : '#15803d';
            toast.innerHTML = message;
            document.body.appendChild(toast);

            setTimeout(() => toast.remove(), 3000);
        }

        // Inicialização
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('id_data').value = new Date().toISOString().split('T')[0];

            // ✅ Mostra o modo real (local/remoto) e permite trocar
            atualizarBadgeModo();

            initBancosDados();
            loadHistory();

            document.getElementById('produto-banco').style.display = 'block';
            document.getElementById('produto-form').style.display = 'block';

            const latField = document.getElementById('clima_lat');
            const lonField = document.getElementById('clima_lon');
            if (latField && lonField && !latField.value && !lonField.value) {
                latField.value = '-23.5505';
                lonField.value = '-46.6333';
            }
        });

// ========================================
        // USAR FIREBASE JÁ INICIALIZADO NO HEAD
        // ========================================
        // As variáveis auth, database e ADMIN_EMAIL já foram criadas globalmente
        const auth = window.auth;
        const db = window.database;
        const ADMIN_EMAIL = window.ADMIN_EMAIL;
        
        let currentUserData = null;
        let isUserAdmin = false;

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

        async function handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const btn = e.target.querySelector('button');

            btn.disabled = true;
            btn.innerHTML = '<span class="loading"></span> Entrando...';

            try {
                await auth.signInWithEmailAndPassword(email, password);
            } catch (error) {
                showAuthError(getAuthErrorMessage(error.code));
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
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
                    isAdmin: email === ADMIN_EMAIL,
                    createdAt: new Date().toISOString()
                });

                showToast('✅ Conta criada com sucesso!', 'success');
            } catch (error) {
                showAuthError(getAuthErrorMessage(error.code));
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-user-plus"></i> Criar Conta';
            }
        }

        function handleLogoutClick() {
            if (confirm('Deseja realmente sair?')) {
                auth.signOut();
            }
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
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUserData = user;
                
                try {
                    const snapshot = await db.ref('users/' + user.uid).once('value');
                    const userData = snapshot.val();
                    isUserAdmin = userData?.isAdmin || user.email === ADMIN_EMAIL;
                    
                    // Atualizar UI
                    document.getElementById('user-email-display').textContent = user.email;
                    if (isUserAdmin) {
                        document.getElementById('admin-badge-display').style.display = 'inline-block';
                    }
                    
                    // Esconder login, mostrar app
                    document.getElementById('auth-overlay').classList.add('hidden');
                    document.getElementById('main-app').classList.add('show');
                    
                    // Inicializar sistema
                    if (typeof initBancosDados === 'function') {
                        initBancosDados();
                    }
                    if (typeof loadHistory === 'function') {
                        loadHistory();
                    }
                    
                    showToast('✅ Bem-vindo(a), ' + (userData?.name || user.email) + '!', 'success');
                } catch (error) {
                    console.error('Erro:', error);
                }
            } else {
                currentUserData = null;
                isUserAdmin = false;
                document.getElementById('auth-overlay').classList.remove('hidden');
                document.getElementById('main-app').classList.remove('show');
            }
        });

        console.log('🌿 CaldaCerta Pro com Sistema de Login - PRONTO!');
        console.log('📧 Admin: bitencourttec@gmail.com / Senha: 123456');
