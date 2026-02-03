// Configuração da API - CaldaCerta Backend
const API_URL = 'http://localhost:3000/api';

// Objeto API com todas as funções
const API = {
  // Clientes
  getClientes: async () => {
    try {
      const res = await fetch(`${API_URL}/clientes`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      throw error;
    }
  },
  
  saveCliente: async (nome) => {
    try {
      const res = await fetch(`${API_URL}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      throw error;
    }
  },

  // Produtos
  getProdutos: async () => {
    try {
      const res = await fetch(`${API_URL}/produtos`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      throw error;
    }
  },
  
  saveProduto: async (produto) => {
    try {
      const res = await fetch(`${API_URL}/produtos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(produto)
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      throw error;
    }
  },

  // Responsáveis
  getResponsaveis: async () => {
    try {
      const res = await fetch(`${API_URL}/responsaveis`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao buscar responsáveis:', error);
      throw error;
    }
  },

  // Operadores
  getOperadores: async () => {
    try {
      const res = await fetch(`${API_URL}/operadores`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao buscar operadores:', error);
      throw error;
    }
  },

  // Simulações
  getSimulacoes: async () => {
    try {
      const res = await fetch(`${API_URL}/simulacoes`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao buscar simulações:', error);
      throw error;
    }
  },
  
  getSimulacao: async (id) => {
    try {
      const res = await fetch(`${API_URL}/simulacoes/${id}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao buscar simulação:', error);
      throw error;
    }
  },
  
  saveSimulacao: async (simulacao) => {
    try {
      const res = await fetch(`${API_URL}/simulacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulacao)
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao salvar simulação:', error);
      throw error;
    }
  },
  
  deleteSimulacao: async (id) => {
    try {
      const res = await fetch(`${API_URL}/simulacoes/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao deletar simulação:', error);
      throw error;
    }
  },

  // Estatísticas
  getStats: async () => {
    try {
      const res = await fetch(`${API_URL}/stats`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }
};

// Verificar conexão com servidor ao carregar
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await fetch(`${API_URL}/stats`);
    console.log('✅ Conectado ao servidor CaldaCerta');
  } catch (error) {
    console.error('❌ Erro ao conectar com servidor:', error);
    console.error('⚠️  Certifique-se que o servidor está rodando em http://localhost:3000');
  }
});
