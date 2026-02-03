// api-config.js para Render
window.API_BASE = ""; // ⬅️ VAZIO para produção no Render!

console.log("🌍 CaldaCerta Pro - API Config");
console.log("📍 Host:", window.location.host);
console.log("🔗 API Base:", window.API_BASE || "(relativo)");

async function apiFetch(path, options = {}) {
  const url = `${window.API_BASE}${path}`;
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
      const errorText = await resp.text().catch(() => '');
      console.error(`❌ API Error ${resp.status}:`, errorText.slice(0, 200));
      throw new Error(`HTTP ${resp.status}: ${errorText.slice(0, 200)}`);
    }

    return resp.json();
  } catch (error) {
    console.error(`❌ Fetch failed:`, error.message);
    throw error;
  }
}

// API methods
window.API = {
  getProdutos: () => apiFetch("/api/produtos"),
  saveProduto: (data) => apiFetch("/api/produtos", { 
    method: "POST", 
    body: JSON.stringify(data) 
  }),

  getClientes: () => apiFetch("/api/clientes"),
  getResponsaveis: () => apiFetch("/api/responsaveis"),
  getOperadores: () => apiFetch("/api/operadores"),

  getSimulacoes: () => apiFetch("/api/simulacoes"),
  getSimulacao: (id) => apiFetch(`/api/simulacoes/${id}`),
  saveSimulacao: (data) => apiFetch("/api/simulacoes", { 
    method: "POST", 
    body: JSON.stringify(data) 
  }),
};

// Teste inicial
setTimeout(async () => {
  try {
    console.log("🧪 Testando conexão com API...");
    const health = await fetch("/api/health").then(r => r.json());
    console.log("✅ API conectada:", health);
  } catch (error) {
    console.warn("⚠️ Não conectou à API:", error.message);
  }
}, 1000);