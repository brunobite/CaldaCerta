const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../web')));

// Upload config (seguro para local + remoto)
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// Banco de dados (SQLite)
// ⚠️ Em Render, use Persistent Disk ou migre para Postgres (explico abaixo)
const dbPath = path.join(__dirname, '../database/caldacerta.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('✅ Conectado ao banco de dados SQLite');
    initDatabase();
  }
});

// ... (todas as suas rotas iguais)

// Iniciar servidor (Render precisa 0.0.0.0)
app.listen(PORT, "0.0.0.0", () => {
  console.log('');
  console.log('🚀 ================================');
  console.log('🌱 CALDACERTA - SERVIDOR ATIVO');
  console.log('🚀 ================================');
  console.log(`📡 Servidor rodando na porta: ${PORT}`);
  console.log(`📂 Banco de dados: ${dbPath}`);
  console.log('🚀 ================================');
});
