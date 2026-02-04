// Configuração da API
window.API_BASE = "https://api-caldacerta.onrender.com" || "http://localhost:3000";

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