const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const { existsSync } = require("fs");

const app = express();
app.use(express.json());

// ✅ Como o Render roda "cd server", o front está em "../web"
const WEB_DIR = path.join(__dirname, "..", "web");
const DB_DIR = path.join(__dirname, "data");

// Garantir diretório de dados
if (!existsSync(DB_DIR)) {
  require("fs").mkdirSync(DB_DIR, { recursive: true });
}

// 1) Servir arquivos do FRONT
app.use(express.static(WEB_DIR));

// Helper para ler/escrever JSON
const readJSON = async (filename) => {
  try {
    const filepath = path.join(DB_DIR, filename);
    if (!existsSync(filepath)) return [];
    const data = await fs.readFile(filepath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Erro ao ler ${filename}:`, err);
    return [];
  }
};

const writeJSON = async (filename, data) => {
  try {
    const filepath = path.join(DB_DIR, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Erro ao escrever ${filename}:`, err);
    return false;
  }
};

// 2) Rotas da API

// Produtos
app.get("/api/produtos", async (req, res) => {
  try {
    const produtos = await readJSON("produtos.json");
    res.json(produtos);
  } catch (err) {
    console.error("Erro em GET /api/produtos:", err);
    res.status(500).json({ error: "Erro ao carregar produtos" });
  }
});

app.post("/api/produtos", async (req, res) => {
  try {
    const produtos = await readJSON("produtos.json");
    const novoProduto = {
      id: Date.now(),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    produtos.push(novoProduto);
    await writeJSON("produtos.json", produtos);
    res.status(201).json(novoProduto);
  } catch (err) {
    console.error("Erro em POST /api/produtos:", err);
    res.status(500).json({ error: "Erro ao salvar produto" });
  }
});

// Clientes (dados de exemplo)
app.get("/api/clientes", async (req, res) => {
  try {
    // Tentar ler do arquivo
    const clientes = await readJSON("clientes.json");
    if (clientes.length === 0) {
      // Dados de exemplo
      const exemplo = [
        { id: 1, nome: "Fazenda Santa Maria" },
        { id: 2, nome: "Agropecuária São João" },
        { id: 3, nome: "Sítio Boa Esperança" },
        { id: 4, nome: "Cooperativa Agrícola" },
        { id: 5, nome: "Produtor Rural Silva" }
      ];
      res.json(exemplo);
    } else {
      res.json(clientes);
    }
  } catch (err) {
    console.error("Erro em GET /api/clientes:", err);
    res.status(500).json({ error: "Erro ao carregar clientes" });
  }
});

// Responsáveis (dados de exemplo)
app.get("/api/responsaveis", async (req, res) => {
  try {
    const responsaveis = await readJSON("responsaveis.json");
    if (responsaveis.length === 0) {
      const exemplo = [
        { id: 1, nome: "Dr. João Silva" },
        { id: 2, nome: "Dra. Maria Santos" },
        { id: 3, nome: "Eng. Carlos Oliveira" }
      ];
      res.json(exemplo);
    } else {
      res.json(responsaveis);
    }
  } catch (err) {
    console.error("Erro em GET /api/responsaveis:", err);
    res.status(500).json({ error: "Erro ao carregar responsáveis" });
  }
});

// Operadores (dados de exemplo)
app.get("/api/operadores", async (req, res) => {
  try {
    const operadores = await readJSON("operadores.json");
    if (operadores.length === 0) {
      const exemplo = [
        { id: 1, nome: "José Pereira" },
        { id: 2, nome: "Antônio Rodrigues" },
        { id: 3, nome: "Francisco Alves" }
      ];
      res.json(exemplo);
    } else {
      res.json(operadores);
    }
  } catch (err) {
    console.error("Erro em GET /api/operadores:", err);
    res.status(500).json({ error: "Erro ao carregar operadores" });
  }
});

// Simulações
app.get("/api/simulacoes", async (req, res) => {
  try {
    const simulacoes = await readJSON("simulacoes.json");
    res.json(simulacoes);
  } catch (err) {
    console.error("Erro em GET /api/simulacoes:", err);
    res.status(500).json({ error: "Erro ao carregar simulações" });
  }
});

app.get("/api/simulacoes/:id", async (req, res) => {
  try {
    const simulacoes = await readJSON("simulacoes.json");
    const simulacao = simulacoes.find(s => s.id == req.params.id);
    if (!simulacao) {
      return res.status(404).json({ error: "Simulação não encontrada" });
    }
    res.json(simulacao);
  } catch (err) {
    console.error(`Erro em GET /api/simulacoes/${req.params.id}:`, err);
    res.status(500).json({ error: "Erro ao carregar simulação" });
  }
});

app.post("/api/simulacoes", async (req, res) => {
  try {
    const simulacoes = await readJSON("simulacoes.json");
    const novaSimulacao = {
      id: Date.now(),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    
    // Adicionar nomes dos produtos para busca
    if (req.body.produtos && Array.isArray(req.body.produtos)) {
      novaSimulacao.produtos_nomes = req.body.produtos.map(p => p.nome).join('|');
    }
    
    simulacoes.push(novaSimulacao);
    await writeJSON("simulacoes.json", simulacoes);
    res.status(201).json(novaSimulacao);
  } catch (err) {
    console.error("Erro em POST /api/simulacoes:", err);
    res.status(500).json({ error: "Erro ao salvar simulação" });
  }
});

// 3) Fallback SPA (sempre por último)
app.get("*", (req, res) => {
  res.sendFile(path.join(WEB_DIR, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));