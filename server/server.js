const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const { existsSync } = require("fs");

const app = express();
app.use(express.json());

// Caminhos
const WEB_DIR = path.join(__dirname, "..", "web");
const DB_DIR = path.join(__dirname, "data");

console.log("🚀 Iniciando CaldaCerta Pro...");
console.log("📁 Web dir:", WEB_DIR);
console.log("📁 DB dir:", DB_DIR);

// Verificar estrutura
if (!existsSync(WEB_DIR)) {
  console.error("❌ ERRO: Pasta 'web' não encontrada!");
  console.log("ℹ️  Crie a pasta 'web' com os arquivos do frontend.");
  process.exit(1);
}

// Inicializar banco de dados
async function initDatabase() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    
    const initialData = {
      "produtos.json": [
        { id: 1, nome: "Glifosato 480", marca: "Roundup", formulacao: "SC", tipo: "PRODUTO", ph: 5.5 },
        { id: 2, nome: "Óleo Mineral", marca: "Nimbus", formulacao: "ADJUVANTE", tipo: "OLEO", ph: 7.0 },
        { id: 3, nome: "Spreader", marca: "Aureo", formulacao: "ESPALHANTE", tipo: "ADJUVANTE", ph: 6.8 }
      ],
      "clientes.json": [
        { id: 1, nome: "Fazenda Santa Maria" },
        { id: 2, nome: "Agropecuária São João" },
        { id: 3, nome: "Sítio Boa Esperança" }
      ],
      "responsaveis.json": [
        { id: 1, nome: "Dr. João Silva" },
        { id: 2, nome: "Dra. Maria Santos" }
      ],
      "operadores.json": [
        { id: 1, nome: "José Pereira" },
        { id: 2, nome: "Antônio Rodrigues" }
      ],
      "simulacoes.json": []
    };

    for (const [filename, data] of Object.entries(initialData)) {
      const filepath = path.join(DB_DIR, filename);
      if (!existsSync(filepath)) {
        await fs.writeFile(filepath, JSON.stringify(data, null, 2));
        console.log(`📄 ${filename} criado`);
      }
    }
  } catch (error) {
    console.error("Erro ao inicializar banco:", error);
  }
}

// Helper functions
async function readJSON(filename) {
  try {
    const filepath = path.join(DB_DIR, filename);
    if (!existsSync(filepath)) return [];
    const content = await fs.readFile(filepath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Erro ao ler ${filename}:`, error);
    return [];
  }
}

async function writeJSON(filename, data) {
  try {
    const filepath = path.join(DB_DIR, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error(`Erro ao escrever ${filename}:`, error);
    return false;
  }
}

// ✅ SERVIR ARQUIVOS ESTÁTICOS (frontend)
app.use(express.static(WEB_DIR));

// ✅ ROTAS API - DEVEM VIR ANTES DO FALLBACK!

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "CaldaCerta Pro",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// Produtos
app.get("/api/produtos", async (req, res) => {
  try {
    const produtos = await readJSON("produtos.json");
    res.json(produtos);
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: "Erro ao salvar produto" });
  }
});

// Clientes
app.get("/api/clientes", async (req, res) => {
  try {
    const clientes = await readJSON("clientes.json");
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar clientes" });
  }
});

// Responsáveis
app.get("/api/responsaveis", async (req, res) => {
  try {
    const responsaveis = await readJSON("responsaveis.json");
    res.json(responsaveis);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar responsáveis" });
  }
});

// Operadores
app.get("/api/operadores", async (req, res) => {
  try {
    const operadores = await readJSON("operadores.json");
    res.json(operadores);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar operadores" });
  }
});

// Simulações
app.get("/api/simulacoes", async (req, res) => {
  try {
    const simulacoes = await readJSON("simulacoes.json");
    res.json(simulacoes);
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar simulação" });
  }
});

app.post("/api/simulacoes", async (req, res) => {
  try {
    const simulacoes = await readJSON("simulacoes.json");
    const novaSimulacao = {
      id: Date.now(),
      ...req.body,
      createdAt: new Date().toISOString(),
      produtos_nomes: req.body.produtos?.map(p => p.nome).join('|') || ''
    };
    simulacoes.push(novaSimulacao);
    await writeJSON("simulacoes.json", simulacoes);
    res.status(201).json(novaSimulacao);
  } catch (error) {
    res.status(500).json({ error: "Erro ao salvar simulação" });
  }
});

// ✅ FALLBACK SPA - APENAS PARA ROTAS NÃO-API
app.get("*", (req, res) => {
  // ⚠️ IMPORTANTE: Não capturar rotas que começam com /api
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: "API endpoint não encontrado" });
  }
  
  // Para todas as outras rotas, servir o index.html
  const indexPath = path.join(WEB_DIR, "index.html");
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send(`
      <h1>Erro de Configuração</h1>
      <p>index.html não encontrado em: ${WEB_DIR}</p>
    `);
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
    console.log(`📦 API Produtos: http://localhost:${PORT}/api/produtos`);
  });
});