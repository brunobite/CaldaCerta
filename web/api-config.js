// web/api-config.js
// Configuração automática para local e produção

// Detecta se está em localhost ou produção
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname.includes('192.168.');

// Define a URL base da API
// No Render, usa caminho relativo (mesma origem)
// Localmente, usa localhost:3000
window.API_BASE = isLocalhost ? "http://localhost:3000" : "";

// Para debug - mostra no console qual modo está usando
console.log("🌍 Ambiente:", isLocalhost ? "Local" : "Produção");
console.log("🔗 API_BASE:", window.API_BASE || "(relativo)" );
console.log("📍 Host atual:", window.location.host);

async function apiFetch(path, options = {}) {
  // Garante que o caminho comece com /api
  const fullPath = path.startsWith('/api') ? path : `/api${path}`;
  const url = `${window.API_BASE}${fullPath}`;
  
  console.log(`📡 API Request: ${options.method || 'GET'} ${url}`);
  
  try {
    const resp = await fetch(url, {
      headers: { 
        "Content-Type": "application/json", 
        ...(options.headers || {}) 
      },
      ...options,
    });

    if (!resp.ok) {
      let txt = "";
      try { txt = await resp.text(); } catch {}
      console.error(`❌ API Error ${resp.status}:`, txt.slice(0, 200));
      throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 200)}`);
    }

    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) return resp.json();
    return resp.text();
  } catch (error) {
    console.error(`❌ Fetch failed for ${url}:`, error.message);
    throw error;
  }
}

// API methods
window.API = {
  // Produtos
  getProdutos: () => apiFetch("/api/produtos"),
  saveProduto: (data) =>
    apiFetch("/api/produtos", { 
      method: "POST", 
      body: JSON.stringify(data) 
    }),

  // Clientes, Responsáveis, Operadores
  getClientes: () => apiFetch("/api/clientes"),
  getResponsaveis: () => apiFetch("/api/responsaveis"),
  getOperadores: () => apiFetch("/api/operadores"),

  // Simulações
  getSimulacoes: () => apiFetch("/api/simulacoes"),
  getSimulacao: (id) => apiFetch(`/api/simulacoes/${id}`),
  saveSimulacao: (data) =>
    apiFetch("/api/simulacoes", { 
      method: "POST", 
      body: JSON.stringify(data) 
    }),
};

// Teste inicial da API
async function testAPI() {
  try {
    console.log("🧪 Testando conexão com API...");
    const produtos = await window.API.getProdutos();
    console.log(`✅ API conectada! ${produtos.length} produtos carregados.`);
  } catch (error) {
    console.warn("⚠️ Não foi possível conectar à API:", error.message);
    console.log("📌 Verifique se o servidor está rodando e acessível.");
  }
}

// Executa o teste após carregamento
setTimeout(testAPI, 1000);