// server.js (Postgres version)

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// Middlewares
// =========================
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "../web")));

// =========================
// Upload config
// =========================
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// =========================
// Postgres connection
// =========================
if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL não definido. Configure no Render (Environment Variables).");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render Postgres geralmente requer SSL
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Converte "?" (sqlite) para "$1, $2..." (postgres)
function sqliteToPg(sql, params) {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

async function dbAll(sql, params = []) {
  const { text, values } = sqliteToPg(sql, params);
  const r = await pool.query(text, values);
  return r.rows;
}

async function dbGet(sql, params = []) {
  const { text, values } = sqliteToPg(sql, params);
  const r = await pool.query(text, values);
  return r.rows[0] || null;
}

async function dbRun(sql, params = []) {
  const { text, values } = sqliteToPg(sql, params);
  return pool.query(text, values);
}

// =========================
// Inicializar banco (schema)
// =========================
async function initDatabase() {
  await dbRun(`CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS propriedades (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    cliente_id INTEGER REFERENCES clientes(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS talhoes (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    propriedade_id INTEGER REFERENCES propriedades(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS responsaveis (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS operadores (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    marca TEXT,
    formulacao TEXT NOT NULL,
    tipo TEXT NOT NULL,
    ph DOUBLE PRECISION,
    ingrediente_ativo TEXT,
    concentracao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS simulacoes (
    id SERIAL PRIMARY KEY,
    cliente TEXT NOT NULL,
    propriedade TEXT NOT NULL,
    talhao TEXT,
    responsavel TEXT,
    operador TEXT,
    cultura TEXT,
    objetivo TEXT,
    data_aplicacao DATE,
    area DOUBLE PRECISION,
    tanque_capacidade DOUBLE PRECISION,
    vazao DOUBLE PRECISION,
    rendimento DOUBLE PRECISION,
    agua_ph DOUBLE PRECISION,
    agua_dureza DOUBLE PRECISION,
    agua_origem TEXT,
    agua_observacoes TEXT,
    jarra_volume INTEGER,
    respeitar_hierarquia BOOLEAN,
    criterio_ordenacao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS simulacao_produtos (
    id SERIAL PRIMARY KEY,
    simulacao_id INTEGER NOT NULL REFERENCES simulacoes(id) ON DELETE CASCADE,
    produto_nome TEXT NOT NULL,
    produto_marca TEXT,
    dose DOUBLE PRECISION NOT NULL,
    formulacao TEXT,
    tipo TEXT,
    ph DOUBLE PRECISION,
    ordem INTEGER
  )`);

  console.log("✅ Tabelas criadas/verificadas (Postgres)");
}

// Rodar init
initDatabase().catch((err) => {
  console.error("❌ Erro ao inicializar banco:", err);
});

// =========================
// ROTAS
// =========================

// ============= ROTAS DE CLIENTES =============
app.get("/api/clientes", async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM clientes ORDER BY nome");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/clientes", async (req, res) => {
  try {
    const { nome } = req.body;

    await dbRun(
      "INSERT INTO clientes (nome) VALUES (?) ON CONFLICT (nome) DO NOTHING",
      [nome]
    );

    const row = await dbGet("SELECT id, nome FROM clientes WHERE nome = ?", [nome]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS DE PROPRIEDADES =============
app.get("/api/propriedades", async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM propriedades ORDER BY nome");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/propriedades", async (req, res) => {
  try {
    const { nome, cliente_id } = req.body;

    const r = await dbRun(
      "INSERT INTO propriedades (nome, cliente_id) VALUES (?, ?) RETURNING id, nome, cliente_id",
      [nome, cliente_id]
    );

    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS DE TALHÕES =============
app.get("/api/talhoes", async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM talhoes ORDER BY nome");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/talhoes", async (req, res) => {
  try {
    const { nome, propriedade_id } = req.body;

    const r = await dbRun(
      "INSERT INTO talhoes (nome, propriedade_id) VALUES (?, ?) RETURNING id, nome, propriedade_id",
      [nome, propriedade_id]
    );

    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS DE RESPONSÁVEIS =============
app.get("/api/responsaveis", async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM responsaveis ORDER BY nome");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/responsaveis", async (req, res) => {
  try {
    const { nome } = req.body;

    await dbRun(
      "INSERT INTO responsaveis (nome) VALUES (?) ON CONFLICT (nome) DO NOTHING",
      [nome]
    );

    const row = await dbGet("SELECT id, nome FROM responsaveis WHERE nome = ?", [nome]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS DE OPERADORES =============
app.get("/api/operadores", async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM operadores ORDER BY nome");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/operadores", async (req, res) => {
  try {
    const { nome } = req.body;

    await dbRun(
      "INSERT INTO operadores (nome) VALUES (?) ON CONFLICT (nome) DO NOTHING",
      [nome]
    );

    const row = await dbGet("SELECT id, nome FROM operadores WHERE nome = ?", [nome]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS DE PRODUTOS =============
app.get("/api/produtos", async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM produtos ORDER BY nome");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/produtos", async (req, res) => {
  try {
    const { nome, marca, formulacao, tipo, ph, ingrediente_ativo, concentracao } = req.body;

    const r = await dbRun(
      `INSERT INTO produtos (nome, marca, formulacao, tipo, ph, ingrediente_ativo, concentracao)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id, nome, marca, formulacao, tipo, ph, ingrediente_ativo, concentracao`,
      [nome, marca, formulacao, tipo, ph, ingrediente_ativo, concentracao]
    );

    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload de planilha de produtos (XLSX/CSV)
app.post("/api/produtos/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Arquivo não enviado" });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let data = [];

    // XLSX / XLS
    if (ext === ".xlsx" || ext === ".xls") {
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else {
      // CSV: tentamos ler como planilha simples via XLSX (funciona bem na maioria dos casos)
      const workbook = XLSX.readFile(req.file.path, { type: "file" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    }

    let inserted = 0;

    for (const row of data) {
      const nome = row.nome || row.Nome || row.NOME;
      if (!nome) continue;

      const marca = row.marca || row.Marca || row.MARCA || "";
      const formulacao = row.formulacao || row.Formulacao || row.FORMULACAO || "SC";
      const tipo = row.tipo || row.Tipo || row.TIPO || "PRODUTO";
      const ph = row.ph || row.pH || row.PH || null;
      const ingrediente_ativo =
        row.ingrediente_ativo || row["Ingrediente Ativo"] || row.INGREDIENTE_ATIVO || "";
      const concentracao = row.concentracao || row.Concentracao || row.CONCENTRACAO || "";

      try {
        await dbRun(
          `INSERT INTO produtos (nome, marca, formulacao, tipo, ph, ingrediente_ativo, concentracao)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [nome, marca, formulacao, tipo, ph, ingrediente_ativo, concentracao]
        );
        inserted++;
      } catch (e) {
        console.error("Erro ao inserir produto:", e.message);
      }
    }

    // remover temporário
    try {
      fs.unlinkSync(req.file.path);
    } catch (_) {}

    res.json({ success: true, inserted, total: data.length });
  } catch (error) {
    try {
      if (req.file?.path) fs.unlinkSync(req.file.path);
    } catch (_) {}
    res.status(500).json({ error: error.message });
  }
});

// ============= ROTAS DE SIMULAÇÕES =============
app.get("/api/simulacoes", async (req, res) => {
  try {
    const rows = await dbAll(
      `
      SELECT s.*,
        string_agg(sp.produto_nome, '|' ) as produtos_nomes
      FROM simulacoes s
      LEFT JOIN simulacao_produtos sp ON s.id = sp.simulacao_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
      `
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/simulacoes/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const simulacao = await dbGet("SELECT * FROM simulacoes WHERE id = ?", [id]);
    if (!simulacao) return res.status(404).json({ error: "Simulação não encontrada" });

    const produtos = await dbAll(
      "SELECT * FROM simulacao_produtos WHERE simulacao_id = ? ORDER BY ordem",
      [id]
    );

    simulacao.produtos = produtos;
    res.json(simulacao);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/simulacoes", async (req, res) => {
  try {
    const {
      cliente,
      propriedade,
      talhao,
      responsavel,
      operador,
      cultura,
      objetivo,
      data_aplicacao,
      area,
      tanque_capacidade,
      vazao,
      rendimento,
      agua_ph,
      agua_dureza,
      agua_origem,
      agua_observacoes,
      jarra_volume,
      respeitar_hierarquia,
      criterio_ordenacao,
      produtos,
    } = req.body;

    const r = await dbRun(
      `
      INSERT INTO simulacoes (
        cliente, propriedade, talhao, responsavel, operador,
        cultura, objetivo, data_aplicacao, area,
        tanque_capacidade, vazao, rendimento,
        agua_ph, agua_dureza, agua_origem, agua_observacoes,
        jarra_volume, respeitar_hierarquia, criterio_ordenacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
      `,
      [
        cliente,
        propriedade,
        talhao,
        responsavel,
        operador,
        cultura,
        objetivo,
        data_aplicacao,
        area,
        tanque_capacidade,
        vazao,
        rendimento,
        agua_ph,
        agua_dureza,
        agua_origem,
        agua_observacoes,
        jarra_volume,
        respeitar_hierarquia,
        criterio_ordenacao,
      ]
    );

    const simulacaoId = r.rows[0].id;

    // Inserir produtos
    if (Array.isArray(produtos) && produtos.length > 0) {
      for (let idx = 0; idx < produtos.length; idx++) {
        const p = produtos[idx];
        await dbRun(
          `
          INSERT INTO simulacao_produtos (
            simulacao_id, produto_nome, produto_marca, dose, formulacao, tipo, ph, ordem
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [simulacaoId, p.nome, p.marca, p.dose, p.formulacao, p.tipo, p.ph, idx + 1]
        );
      }
    }

    // Salvar dados nos autocompletes
    if (cliente) {
      await dbRun(
        "INSERT INTO clientes (nome) VALUES (?) ON CONFLICT (nome) DO NOTHING",
        [cliente]
      );
    }
    if (responsavel) {
      await dbRun(
        "INSERT INTO responsaveis (nome) VALUES (?) ON CONFLICT (nome) DO NOTHING",
        [responsavel]
      );
    }
    if (operador) {
      await dbRun(
        "INSERT INTO operadores (nome) VALUES (?) ON CONFLICT (nome) DO NOTHING",
        [operador]
      );
    }

    res.json({ id: simulacaoId, message: "Simulação salva com sucesso!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/simulacoes/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const r = await dbRun("DELETE FROM simulacoes WHERE id = ? RETURNING id", [id]);
    res.json({ success: true, deleted: r.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ESTATÍSTICAS =============
app.get("/api/stats", async (req, res) => {
  try {
    const stats = await dbGet(
      `
      SELECT
        (SELECT COUNT(*)::int FROM simulacoes) as total_simulacoes,
        (SELECT COUNT(*)::int FROM produtos) as total_produtos,
        (SELECT COUNT(*)::int FROM clientes) as total_clientes,
        (SELECT COUNT(*)::int FROM operadores) as total_operadores
      `
    );
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota raiz
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../web/index.html"));
});

// =========================
// Iniciar servidor
// =========================
app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("🚀 ================================");
  console.log("🌱 CALDACERTA - SERVIDOR ATIVO");
  console.log("🚀 ================================");
  console.log(`📡 Servidor rodando na porta: ${PORT}`);
  console.log("🚀 ================================");
  console.log("");
  console.log("📋 Endpoints disponíveis:");
  console.log("   GET  /api/clientes");
  console.log("   GET  /api/produtos");
  console.log("   GET  /api/simulacoes");
  console.log("   POST /api/produtos/upload");
  console.log("");
});

// Fechar pool ao encerrar
process.on("SIGINT", async () => {
  try {
    await pool.end();
    console.log("\n👋 Pool Postgres fechado");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});