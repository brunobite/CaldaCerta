/**
 * Importa um XLSX para Firebase Realtime Database (RTDB) em /produtos_catalogo
 *
 * Requisitos:
 * - Node + npm
 * - npm i firebase-admin xlsx
 *
 * Variáveis de ambiente (PowerShell):
 *   $env:FIREBASE_PROJECT_ID="caldacerta-pro"
 *   $env:FIREBASE_DATABASE_URL="https://caldacerta-pro-default-rtdb.firebaseio.com"
 *   $env:FIREBASE_SERVICE_ACCOUNT_JSON=(Get-Content .\serviceAccountKey.json -Raw)
 *
 * Uso:
 *   node .\scripts\rtdb-import\import_xlsx_to_rtdb.js .\server\data\produtos.xlsx
 */

const admin = require('firebase-admin');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');
const rawArgs = process.argv.slice(2);
const rawPathArg = rawArgs[0];

if (!rawPathArg) {
  console.error('❌ Caminho do XLSX não informado.');
  console.log('Uso: node scripts/rtdb-import/import_xlsx_to_rtdb.js arquivo.xlsx');
  process.exit(1);
}

const caminhoXlsx = path.isAbsolute(rawPathArg)
  ? rawPathArg
  : path.join(repoRoot, rawPathArg);

if (!fs.existsSync(caminhoXlsx)) {
  console.error(`❌ Arquivo não encontrado: ${caminhoXlsx}`);
  console.log('Uso: node scripts/rtdb-import/import_xlsx_to_rtdb.js arquivo.xlsx');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const databaseUrl = process.env.FIREBASE_DATABASE_URL;

if (!projectId) {
  console.error('❌ FIREBASE_PROJECT_ID não definido.');
  process.exit(1);
}

if (!serviceAccountJson) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON não definido.');
  process.exit(1);
}

if (!databaseUrl) {
  console.error('❌ FIREBASE_DATABASE_URL não definido.');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (error) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON inválido (JSON parse falhou).');
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
    databaseURL: databaseUrl,
  });
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
  process.exit(1);
}

const database = admin.database();

function normalizeKey(valor) {
  return (valor || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePhValue(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }
  const normalized = rawValue.toString().replace(',', '.').trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function carregarPlanilha(caminho) {
  const workbook = XLSX.readFile(caminho);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // defval:'' garante chaves presentes mesmo quando célula vazia (bom p/ debug)
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  // Log útil para confirmar colunas
  const cols = Object.keys(rows[0] || {});
  console.log('🧾 Colunas detectadas:', cols);

  return rows;
}

async function importarProdutos() {
  console.log(`📖 Lendo arquivo: ${caminhoXlsx}`);
  const linhas = carregarPlanilha(caminhoXlsx);
  console.log(`✅ ${linhas.length} produtos encontrados na planilha`);

  const catalogoRef = database.ref('produtos_catalogo');

  let inseridos = 0;
  let ignorados = 0;

  for (const linha of linhas) {
    // ✅ SUA PLANILHA USA SNAKE_CASE (confirmado): nome_comercial, empresa, ph_fispq, url_fispq
    const nomeComercial = String(linha.nome_comercial || '').trim();

    if (nomeComercial === '') {
      ignorados += 1;
      continue;
    }

    const empresa = String(linha.empresa || '').trim();

    // A planilha NÃO tem tipo; mantém default fixo
    const tipoProduto = 'Não informado';

    const phRaw = linha.ph_fispq;
    const urlFispq = String(linha.url_fispq || '').trim();

    const payload = {
      nomeComercial,
      empresa,
      tipoProduto,
      nome_key: normalizeKey(nomeComercial),
      createdAt: admin.database.ServerValue.TIMESTAMP,
    };

    const phValue = parsePhValue(phRaw);
    if (phValue !== null) payload.phFispq = phValue;

    if (urlFispq) payload.urlFispq = urlFispq;

    await catalogoRef.push(payload);
    inseridos += 1;
  }

  console.log('=====================================');
  console.log('✅ Importação concluída!');
  console.log(`   Sucesso: ${inseridos} produtos`);
  console.log(`   Ignorados: ${ignorados}`);
  console.log('=====================================');
}

importarProdutos().catch((error) => {
  console.error('❌ Erro ao importar:', error);
  process.exit(1);
});
