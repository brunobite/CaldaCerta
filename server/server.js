import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

// ====== ROTAS DA API (mantém suas rotas reais aqui) ======
// Exemplo (não apague suas rotas reais, só mantenha o padrão /api)
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// ====== FRONTEND ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANTE:
// server.js está em /server
// frontend está em /web
const WEB_DIR = path.join(__dirname, "../web");

// serve arquivos estáticos (index.html, api-config.js, css, etc)
app.use(express.static(WEB_DIR));

// fallback: qualquer rota que não seja /api vai para index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(WEB_DIR, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Server on port", PORT));