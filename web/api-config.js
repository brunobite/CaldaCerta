// Configuração da API
(() => {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const isApiHost = host.startsWith('api-');
  const defaultBase = isApiHost
    ? ''
    : (isLocal ? 'http://localhost:10000' : 'https://caldacerta.onrender.com');
  window.API_BASE = window.API_BASE || defaultBase;
})();

// Mock API para desenvolvimento
window.API = {
  async registerUser(userData) {
    console.log("Mock API: registerUser", userData);
    return { success: true, id: Date.now().toString() };
  },
  
  async getUsers() {
    console.log("Mock API: getUsers");
    return [];
  },
  
  async getProdutos() {
    console.log("Mock API: getProdutos");
    return [];
  },
  
  async getSimulacoes() {
    console.log("Mock API: getSimulacoes");
    return [];
  },
  
  async saveSimulation(data) {
    console.log("Mock API: saveSimulation", data);
    return { success: true, id: Date.now().toString() };
  }
};
