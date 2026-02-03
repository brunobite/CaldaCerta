const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// ✅ Como o Render roda "cd server", o front está em "../web"
const WEB_DIR = path.join(__dirname, "..", "web");

// 1) Servir arquivos do FRONT
app.use(express.static(WEB_DIR));

// 2) Suas rotas /api (exemplos)
app.get("/api/stats", async (req, res) => {
  // se você já tem essa rota real, substitua este conteúdo
  res.json({ ok: true });
});

// TODO: suas outras rotas:
// app.get("/api/produtos", ...)
// app.post("/api/produtos", ...)
// app.get("/api/clientes", ...)
// app.get("/api/simulacoes", ...)
// etc...

// 3) Fallback SPA (sempre por último)
app.get("*", (req, res) => {
  res.sendFile(path.join(WEB_DIR, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Server on port", PORT));