// web/api-config.js
// Caminho A (Render): usar API RELATIVA do mesmo host => /api/...

window.API_BASE = ""; // no Render e em produção: /api/...

// Helper de fetch com erro amigável
async function apiFetch(path, options = {}) {
  const url = `${window.API_BASE}${path}`;
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!resp.ok) {
    let txt = "";
    try { txt = await resp.text(); } catch {}
    throw new Error(`HTTP ${resp.status} em ${url} :: ${txt.slice(0, 300)}`);
  }

  // Pode ser JSON ou vazio
  const ct = resp.headers.get("content-type") || "";
  if (ct.includes("application/json")) return resp.json();
  return resp.text();
}

// API usada pelo seu index.html
window.API = {
  getProdutos: () => apiFetch("/api/produtos"),
  saveProduto: (data) => apiFetch("/api/produtos", { method: "POST", body: JSON.stringify(data) }),

  getClientes: () => apiFetch("/api/clientes"),
  getResponsaveis: () => apiFetch("/api/responsaveis"),
  getOperadores: () => apiFetch("/api/operadores"),

  getSimulacoes: () => apiFetch("/api/simulacoes"),
  getSimulacao: (id) => apiFetch(`/api/simulacoes/${id}`),
  saveSimulacao: (data) => apiFetch("/api/simulacoes", { method: "POST", body: JSON.stringify(data) }),
};

console.log("✅ API_BASE =", window.API_BASE, "| host =", location.host);