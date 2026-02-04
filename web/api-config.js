// CaldaCerta Pro - API EXCLUSIVA com Firebase
// NÃO usa mais servidor Node.js para dados!

console.log("🔥 API Firebase - Modo exclusivo");

// Verificar se Firebase está carregado
function checkFirebase() {
  if (typeof firebase === 'undefined') {
    console.error("❌ Firebase não carregado!");
    console.log("ℹ️ Verifique se firebase-config.js está carregado antes deste arquivo");
    return false;
  }
  
  if (!firebase.apps.length) {
    console.error("❌ Firebase não inicializado!");
    return false;
  }
  
  console.log("✅ Firebase pronto para uso");
  return true;
}

// Configurar API Firebase
if (checkFirebase()) {
  const db = firebase.database();
  
  window.API = {
    // ========== PRODUTOS ==========
    getProdutos: async () => {
      console.log("📦 Buscando produtos do Firebase...");
      try {
        const snapshot = await db.ref('produtos').once('value');
        const data = snapshot.val();
        
        if (!data) {
          console.log("ℹ️ Nenhum produto no Firebase. Criando padrões...");
          
          const produtosPadrao = [
            { nome: "Glifosato 480", marca: "Roundup", formulacao: "SC", tipo: "PRODUTO", ph: 5.5 },
            { nome: "Óleo Mineral", marca: "Nimbus", formulacao: "ADJUVANTE", tipo: "OLEO", ph: 7.0 },
            { nome: "Spreader", marca: "Aureo", formulacao: "ESPALHANTE", tipo: "ADJUVANTE", ph: 6.8 }
          ];
          
          // Salvar cada produto
          for (const produto of produtosPadrao) {
            await db.ref('produtos').push({
              ...produto,
              createdAt: new Date().toISOString()
            });
          }
          
          return produtosPadrao.map((p, i) => ({ id: `temp${i}`, ...p }));
        }
        
        // Converter para array
        return Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
      } catch (error) {
        console.error("❌ Erro Firebase produtos:", error);
        return [];
      }
    },

    saveProduto: async (data) => {
      console.log("💾 Salvando produto no Firebase:", data.nome);
      try {
        const newRef = db.ref('produtos').push();
        await newRef.set({
          ...data,
          createdAt: new Date().toISOString()
        });
        return { id: newRef.key, ...data };
      } catch (error) {
        console.error("❌ Erro ao salvar produto:", error);
        throw error;
      }
    },

    // ========== CLIENTES ==========
    getClientes: async () => {
      try {
        const snapshot = await db.ref('clientes').once('value');
        const data = snapshot.val();
        
        if (!data) {
          console.log("ℹ️ Criando clientes padrão...");
          const clientesPadrao = [
            { nome: "Fazenda Santa Maria" },
            { nome: "Agropecuária São João" },
            { nome: "Sítio Boa Esperança" }
          ];
          
          for (const cliente of clientesPadrao) {
            await db.ref('clientes').push(cliente);
          }
          
          return clientesPadrao.map((c, i) => ({ id: `cliente${i}`, ...c }));
        }
        
        return Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
      } catch (error) {
        console.error("❌ Erro clientes:", error);
        return [];
      }
    },

    // ========== RESPONSÁVEIS ==========
    getResponsaveis: async () => {
      try {
        const snapshot = await db.ref('responsaveis').once('value');
        const data = snapshot.val();
        
        if (!data) {
          const responsaveisPadrao = [
            { nome: "Dr. João Silva" },
            { nome: "Dra. Maria Santos" }
          ];
          
          for (const resp of responsaveisPadrao) {
            await db.ref('responsaveis').push(resp);
          }
          
          return responsaveisPadrao.map((r, i) => ({ id: `resp${i}`, ...r }));
        }
        
        return Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
      } catch (error) {
        console.error("❌ Erro responsáveis:", error);
        return [];
      }
    },

    // ========== OPERADORES ==========
    getOperadores: async () => {
      try {
        const snapshot = await db.ref('operadores').once('value');
        const data = snapshot.val();
        
        if (!data) {
          const operadoresPadrao = [
            { nome: "José Pereira" },
            { nome: "Antônio Rodrigues" }
          ];
          
          for (const op of operadoresPadrao) {
            await db.ref('operadores').push(op);
          }
          
          return operadoresPadrao.map((o, i) => ({ id: `op${i}`, ...o }));
        }
        
        return Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
      } catch (error) {
        console.error("❌ Erro operadores:", error);
        return [];
      }
    },

    // ========== SIMULAÇÕES ==========
    getSimulacoes: async () => {
      console.log("📋 Buscando simulações do Firebase...");
      try {
        const snapshot = await db.ref('simulacoes').once('value');
        const data = snapshot.val();
        
        if (!data) {
          console.log("ℹ️ Nenhuma simulação no Firebase");
          return [];
        }
        
        // Converter para array e ordenar
        const simulacoes = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        
        return simulacoes.sort((a, b) => 
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
      } catch (error) {
        console.error("❌ Erro simulações:", error);
        return [];
      }
    },

    getSimulacao: async (id) => {
      try {
        const snapshot = await db.ref(`simulacoes/${id}`).once('value');
        const data = snapshot.val();
        return data ? { id, ...data } : null;
      } catch (error) {
        console.error("❌ Erro buscar simulação:", error);
        throw error;
      }
    },

    saveSimulacao: async (data) => {
      console.log("💾 Salvando simulação no Firebase...", data.cliente);
      try {
        const newRef = db.ref('simulacoes').push();
        const simulacaoCompleta = {
          ...data,
          id: newRef.key,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await newRef.set(simulacaoCompleta);
        console.log("✅ Simulação salva com ID:", newRef.key);
        return simulacaoCompleta;
      } catch (error) {
        console.error("❌ Erro salvar simulação:", error);
        throw error;
      }
    }
  };

  console.log("✅ API Firebase configurada!");
  
  // Testar imediatamente
  setTimeout(async () => {
    try {
      console.log("🧪 Testando conexão Firebase...");
      const produtos = await window.API.getProdutos();
      console.log(`✅ Firebase OK! ${produtos.length} produtos carregados`);
    } catch (error) {
      console.error("❌ Falha no Firebase:", error.message);
    }
  }, 1000);

} else {
  console.error("❌ API não configurada - Firebase falhou");
  window.API = null;
}