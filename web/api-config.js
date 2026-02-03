// web/api-config.js
// PRODUÇÃO (Render): API no mesmo domínio
const API_URL = "/api";

// Objeto API
const API = {
  getProdutos: () => fetch(`${API_URL}/produtos`).then(r => r.json()),
  getClientes: () => fetch(`${API_URL}/clientes`).then(r => r.json()),
  getResponsaveis: () => fetch(`${API_URL}/responsaveis`).then(r => r.json()),
  getOperadores: () => fetch(`${API_URL}/operadores`).then(r => r.json()),

  getSimulacoes: () => fetch(`${API_URL}/simulacoes`).then(r => r.json()),
  getSimulacao: (id) => fetch(`${API_URL}/simulacoes/${id}`).then(r => r.json()),

  saveProduto: (data) =>
    fetch(`${API_URL}/produtos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  saveSimulacao: (data) =>
    fetch(`${API_URL}/simulacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
};

console.log("API_URL =", API_URL);