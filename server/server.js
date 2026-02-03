const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const { existsSync } = require("fs");

const app = express();
app.use(express.json());

// ✅ IMPORTANTE: Caminhos absolutos para Render
const PROJECT_ROOT = path.resolve(__dirname, ".."); // Volta um nível de server/
const WEB_DIR = path.join(PROJECT_ROOT, "web");
const DB_DIR = path.join(__dirname, "data"); // data dentro de server/

console.log("========================================");
console.log("🚀 Iniciando CaldaCerta no Render");
console.log("📁 Diretório atual:", __dirname);
console.log("📁 Root do projeto:", PROJECT_ROOT);
console.log("📁 Pasta web:", WEB_DIR);
console.log("📁 Pasta data:", DB_DIR);
console.log("========================================");

// Verificar se as pastas existem
console.log("✅ Existe pasta web?", existsSync(WEB_DIR) ? "SIM" : "NÃO");
console.log("✅ Existe index.html?", existsSync(path.join(WEB_DIR, "index.html")) ? "SIM" : "NÃO");

// Inicializar banco de dados (seu código atual)

// ✅ Servir arquivos estáticos CORRETAMENTE
app.use(express.static(WEB_DIR));

// ... (suas rotas API mantêm iguais) ...

// ✅ Rota de debug para ver estrutura
app.get("/api/debug", (req, res) => {
  res.json({
    projectRoot: PROJECT_ROOT,
    webDir: WEB_DIR,
    dbDir: DB_DIR,
    existsWeb: existsSync(WEB_DIR),
    existsIndex: existsSync(path.join(WEB_DIR, "index.html")),
    currentDir: __dirname,
    filesInWeb: existsSync(WEB_DIR) ? 
      require("fs").readdirSync(WEB_DIR) : []
  });
});

// ✅ Fallback SPA
app.get("*", (req, res) => {
  const indexPath = path.join(WEB_DIR, "index.html");
  if (existsSync(indexPath)) {
    console.log(`📄 Servindo index.html para: ${req.url}`);
    res.sendFile(indexPath);
  } else {
    console.error(`❌ index.html não encontrado em: ${indexPath}`);
    res.status(500).send(`
      <h1>Erro de Configuração</h1>
      <p>Arquivo index.html não encontrado.</p>
      <p>Caminho esperado: ${indexPath}</p>
      <p>Diretório atual: ${__dirname}</p>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Acessível em: https://caldacerta-1.onrender.com`);
});