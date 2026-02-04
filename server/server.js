const express = require("express");
const path = require("path");
const { existsSync } = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const WEB_DIR = path.join(__dirname, "..", "web");

console.log("🚀 CaldaCerta Pro - Frontend com Firebase");

if (!existsSync(WEB_DIR)) {
  console.error("❌ Pasta 'web' não encontrada!");
  process.exit(1);
}

app.use(express.static(WEB_DIR));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "CaldaCerta Pro Frontend",
    backend: "Firebase Realtime Database",
    timestamp: new Date().toISOString()
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(WEB_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Servidor na porta ${PORT}`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
});