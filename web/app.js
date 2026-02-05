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
    window.API = {};
    window.API_BASE = '';

// VERSÃO COM API - BACKEND NODE.JS + SQLITE
        // A configuração da API está em api-config.js

        let products = [];
        let historicalData = [];
        let currentStepIdx = 0;
        const steps = ['menu', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6'];
        let sortableInstance = null;
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

        async function loadHistory() {
            try {
                if (!currentUserData) {
                    historicalData = [];
                    renderHistoryList(historicalData);
                    return;
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

                    historicalData = allItems;
                    console.log(`✅ ${historicalData.length} simulações carregadas (modo admin)`);
                } else {
                    const histRef = db.ref('simulacoes/' + currentUserData.uid);
                    const snapshot = await histRef.once('value');
                    const data = snapshot.val() || {};
                    historicalData = Object.keys(data).map(key => ({
                        id: key,
                        uid: currentUserData.uid,
                        ...data[key]
                    }));
                    console.log(`✅ ${historicalData.length} simulações carregadas do Firebase`);
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

            if (products.length === 0) {
                showToast('❌ Adicione pelo menos um produto', 'error');
                return;
            }

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
                jarra_volume: parseInt(document.getElementById('jarra_vol').value),
                respeitar_hierarquia: document.getElementById('respeitarHierarquia').checked ? 1 : 0,
                criterio_ordenacao: document.getElementById('criterioOrdenacao').value,
                produtos: products
            };

            try {
                // Salvar no Firebase
                if (!currentUserData) {
                    showToast('❌ Você precisa estar logado!', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-save text-xl"></i> Salvar Simulação Completa';
                    return;
                }

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

        window.viewSimulation = async (id, uidOverride = '') => {
            try {
                // Buscar do Firebase
                if (!currentUserData) {
                    showToast('❌ Você precisa estar logado!', 'error');
                    return;
                }

                const ownerUid = uidOverride || currentUserData.uid;
                const simRef = db.ref('simulacoes/' + ownerUid + '/' + id);
                const snapshot = await simRef.once('value');
                const item = snapshot.val();

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

                products = (item.produtos || []).map(p => ({
                    id: p.id || (Date.now() + Math.random()),
                    nome: p.produto_nome || p.nome,
                    marca: p.produto_marca || p.marca,
                    dose: p.dose,
                    formulacao: p.formulacao,
                    tipo: p.tipo,
                    ph: p.ph
                }));

                currentEditingSimulation = {
                    id,
                    uid: ownerUid,
                    userEmail: item.userEmail || '',
                    createdAt: item.createdAt || ''
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
                checkClimateConditions(climateData?.deltaT);
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
                const phDisplay = p.ph ? `pH: ${p.ph}` : '';
                const observacao = p.observacao || '';

                return `
                    <div class="product-item ordem-card" data-id="${p.id}">
                        <i class="fa-solid fa-grip-vertical drag-handle"></i>
                        <div class="flex-1">
                            <div class="flex justify-between items-center mb-3">
                                <div class="flex items-center gap-3">
                                    <span class="badge badge-primary">Ordem ${i+1}</span>
                                    <span class="badge badge-accent">${p.formulacao}</span>
                                    ${phDisplay ? `<span class="badge badge-success">${phDisplay}</span>` : ''}
                                </div>
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
                                        onchange="updateProductObservation('${p.id}', this.value)"
                                    >${observacao}</textarea>
                                </div>
                            </div>
                            <div class="grid grid-3 gap-2" style="margin-top: 0.75rem;">
                                <div class="dose-box" style="padding: 0.5rem;">
                                    <p class="dose-label" style="font-size: 0.65rem;">Jarra (${jarra}ml)</p>
                                    <p class="dose-value" style="font-size: 1.25rem;">${doseJarra} ml</p>
                                </div>
                                <div class="dose-box" style="padding: 0.5rem;">
                                    <p class="dose-label" style="font-size: 0.65rem;">Tanque</p>
                                    <p class="dose-value" style="font-size: 1.25rem;">${doseTanque} ${p.dose < 1 ? 'ml' : 'L'}</p>
                                </div>
                                <div class="dose-box" style="padding: 0.5rem;">
                                    <p class="dose-label" style="font-size: 0.65rem;">Total (${area} ha)</p>
                                    <p class="dose-value" style="font-size: 1.25rem;">${volumeTotal} ${p.dose < 1 ? 'ml' : 'L'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            if (sortableInstance) sortableInstance.destroy();

            if (!respeitar) {
                sortableInstance = new Sortable(container, {
                    animation: 150,
                    handle: '.drag-handle',
                    ghostClass: 'sortable-ghost',
                    dragClass: 'sortable-drag',
                    onEnd: function(evt) {
                        const newIndex = evt.newIndex;
                        const oldIndex = evt.oldIndex;
                        const movedItem = products.splice(oldIndex, 1)[0];
                        products.splice(newIndex, 0, movedItem);
                        showToast('📦 Ordem atualizada', 'success');
                    }
                });
            }
        };

        // Clima
        function checkClimateConditions(deltaTValues) {
            const alertContainer = document.getElementById('alert-container');
            const deltaT = deltaTValues && deltaTValues.length ? deltaTValues : [2, 3, 5, 8, 6, 4, 3, 2, 4, 5, 3, 2];
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

            alertContainer.innerHTML = alertHTML;
        }

        // PDF (mantido como estava no seu código)
        window.generatePDF = () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');

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
                p.ph ? `pH ${p.ph}` : '-',
                `${p.dose}`,
                `${((p.dose * jarra) / vazao).toFixed(2)}`,
                `${(p.dose * area).toFixed(1)}`,
                `${((p.dose * tanque) / vazao).toFixed(1)}`
            ]);

            doc.autoTable({
                startY: y,
                head: [['#', 'Produto', 'Observação', 'pH', 'Dose/ha', `Jarra\n(${jarra}ml)`, `TOTAL\n(${area}ha)`, 'DOSE\nTANQUE']],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [15, 118, 110],
                    fontSize: 8,
                    fontStyle: 'bold',
                    halign: 'center',
                    valign: 'middle'
                },
                bodyStyles: { fontSize: 7, valign: 'middle' },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    1: { cellWidth: 65 },
                    2: { cellWidth: 45 },
                    3: { cellWidth: 18, halign: 'center' },
                    4: { cellWidth: 22, halign: 'center' },
                    5: { cellWidth: 22, halign: 'center' },
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

            doc.addPage('landscape');
            doc.setFillColor(15, 118, 110);
            doc.rect(0, 0, 297, 25, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text('QUALIDADE DA ÁGUA E CONDIÇÕES CLIMÁTICAS', 148.5, 15, { align: 'center' });

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('1. QUALIDADE DA ÁGUA', 15, 35);

            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            y = 43;

            const ph = document.getElementById('agua_ph').value || 'Não informado';
            const dureza = document.getElementById('agua_dureza').value || 'Não informado';
            const origem = document.getElementById('agua_origem').value;
            const obs = document.getElementById('agua_obs').value || 'Sem observações';

            doc.text(`pH: ${ph}`, 15, y);
            doc.text(`Dureza: ${dureza} µS/cm`, 70, y);
            doc.text(`Origem: ${origem}`, 140, y);
            y += 6;
            doc.text(`Observações: ${obs}`, 15, y);

            y += 15;
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');

            doc.text('2. GRÁFICO DELTA T', 15, y);
            const chartDeltaT = document.getElementById('chartDeltaT');
            if (chartDeltaT) {
                const imgDeltaT = chartDeltaT.toDataURL('image/png');
                doc.addImage(imgDeltaT, 'PNG', 15, y + 5, 130, 110);
            }

            doc.text('3. CONDIÇÕES METEOROLÓGICAS', 155, y);
            const chartClima = document.getElementById('chartClima');
            if (chartClima) {
                const imgClima = chartClima.toDataURL('image/png');
                doc.addImage(imgClima, 'PNG', 155, y + 5, 130, 110);
            }

            doc.save(`CaldaCerta_${document.getElementById('id_cliente').value}_${new Date().toISOString().split('T')[0]}.pdf`);
            showToast('✅ PDF completo gerado com sucesso!', 'success');
        };

        // Gráficos
        let charts = [];
        function initCharts() {
            charts.forEach(c => c.destroy());
            charts = [];

            const hours = climateData?.labels || Array.from({length: 12}, (_, i) => `${i + 6}h`);
            const deltaSeries = climateData?.deltaT || [2, 3, 5, 8, 6, 4, 3, 2, 4, 5, 3, 2];
            const temperatureSeries = climateData?.temperatures || [20, 22, 25, 28, 31, 33, 32, 30, 28, 26, 24, 22];
            const humiditySeries = climateData?.humidity || [80, 75, 68, 60, 52, 48, 45, 50, 58, 65, 72, 78];

            const chartDeltaT = new Chart(document.getElementById('chartDeltaT'), {
                type: 'line',
                data: {
                    labels: hours,
                    datasets: [{
                        label: 'Delta T (°C)',
                        data: deltaSeries,
                        borderColor: '#14b8a6',
                        backgroundColor: 'rgba(20, 184, 166, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 5,
                        pointBackgroundColor: '#14b8a6',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top' },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f5f5f4' },
                            title: { display: true, text: 'Delta T (°C)' }
                        },
                        x: { grid: { display: false } }
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
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 3,
                            yAxisID: 'y',
                            pointRadius: 5,
                            pointBackgroundColor: '#f59e0b',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'Umidade (%)',
                            data: humiditySeries,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 3,
                            yAxisID: 'y1',
                            pointRadius: 5,
                            pointBackgroundColor: '#3b82f6',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: true, position: 'top' },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 }
                        }
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'Temperatura (°C)' },
                            grid: { color: '#f5f5f4' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: { display: true, text: 'Umidade (%)' },
                            grid: { drawOnChartArea: false }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });

            charts.push(chartDeltaT, chartClima);
        }

        function computeDeltaT(temperature, humidity) {
            const a = 17.27;
            const b = 237.7;
            const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100);
            const dewPoint = (b * alpha) / (a - alpha);
            return Number((temperature - dewPoint).toFixed(2));
        }

        async function fetchClimateData(latitude, longitude) {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relativehumidity_2m&forecast_days=1&timezone=auto`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Falha ao obter dados meteorológicos.');
            }
            return response.json();
        }

        function buildClimateSeries(data) {
            const times = data?.hourly?.time || [];
            const temps = data?.hourly?.temperature_2m || [];
            const humidity = data?.hourly?.relativehumidity_2m || [];
            if (!times.length) return null;

            const now = new Date();
            const startIndex = Math.max(times.findIndex(t => new Date(t) >= now), 0);
            const sliceTimes = times.slice(startIndex, startIndex + 12);
            const sliceTemps = temps.slice(startIndex, startIndex + 12);
            const sliceHumidity = humidity.slice(startIndex, startIndex + 12);

            const labels = sliceTimes.map(time => new Date(time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
            const deltaT = sliceTemps.map((temp, idx) => computeDeltaT(temp, sliceHumidity[idx] ?? 50));

            return {
                labels,
                temperatures: sliceTemps,
                humidity: sliceHumidity,
                deltaT
            };
        }

        window.refreshClimate = async () => {
            const latField = document.getElementById('clima_lat');
            const lonField = document.getElementById('clima_lon');
            const latitude = parseFloat(latField.value);
            const longitude = parseFloat(lonField.value);

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                showToast('❌ Informe latitude e longitude válidas.', 'error');
                return;
            }

            try {
                showToast('⏳ Buscando dados meteorológicos...', 'success');
                const data = await fetchClimateData(latitude, longitude);
                const series = buildClimateSeries(data);
                if (!series) {
                    showToast('❌ Dados meteorológicos indisponíveis.', 'error');
                    return;
                }
                climateData = series;
                initCharts();
                checkClimateConditions(series.deltaT);
                showToast('✅ Clima atualizado com sucesso!', 'success');
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
