#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

function loadModule(moduleName) {
  const candidates = [
    moduleName,
    path.resolve(__dirname, '../node_modules', moduleName),
    path.resolve(__dirname, '../servidor/node_modules', moduleName),
    path.resolve(__dirname, '../server/node_modules', moduleName),
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }

  throw new Error(`Módulo não encontrado: ${moduleName}. Instale dependências com npm install.`);
}

const admin = loadModule('firebase-admin');
const XLSX = loadModule('xlsx');

const DELETE_PATHS = [
  'produtos_catalogo',
  'produtos_catalogo_busca',
  'produtos_usuarios_busca',
];

// limites conservadores para RTDB (payload multipath)
const BATCH_MAX_KEYS = 1200;
const BATCH_MAX_BYTES = 700_000;

function parseArgs(argv) {
  const args = {
    serviceAccount: '',
    databaseURL: '',
    excelPath: '',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const [rawKey, rawValue] = arg.split('=');
    const key = rawKey.slice(2);
    const next = rawValue !== undefined ? rawValue : argv[i + 1];

    switch (key) {
      case 'serviceAccount':
      case 'databaseURL':
      case 'excelPath':
        args[key] = next;
        if (rawValue === undefined) i += 1;
        break;
      case 'help':
        printHelp();
        process.exit(0);
        break;
      default:
        break;
    }
  }

  if (!args.serviceAccount) throw new Error('Parâmetro obrigatório: --serviceAccount=<caminho>');
  if (!args.databaseURL) throw new Error('Parâmetro obrigatório: --databaseURL=<url>');
  if (!args.excelPath) throw new Error('Parâmetro obrigatório: --excelPath=<caminho>');

  return args;
}

function printHelp() {
  console.log(`
Uso: node reset-produtos.js [opções]

Opções:
  --serviceAccount=<caminho>  Caminho para o arquivo serviceAccountKey.json
  --databaseURL=<url>         URL do Realtime Database
  --excelPath=<caminho>       Caminho para o arquivo Excel
  --help                      Mostra esta ajuda

SEGURANÇA:
  Para executar o reset (apagar catálogo/índices), você DEVE definir:
    CONFIRM_RESET=YES

Exemplo (PowerShell):
  $env:CONFIRM_RESET="YES"
  node scripts/reset-produtos.js --serviceAccount="C:\\...\\serviceAccountKey.json" --databaseURL="https://...firebaseio.com" --excelPath="C:\\...\\produtos.xlsx"
`);
}

function normalizeForSearch(text) {
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9 ]/g, ' ') // só letras/números/espaço
    .replace(/\s+/g, ' ')
    .trim();
}

function extractWords(text, minLength = 2) {
  const normalized = normalizeForSearch(text);
  const words = normalized
    .split(' ')
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => w.length >= minLength);

  // unique
  return [...new Set(words)];
}

function readServiceAccount(serviceAccountPath) {
  const absolutePath = path.resolve(serviceAccountPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Service account não encontrado: ${absolutePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function parseWorksheetRows(xlsxPath) {
  const filePath = path.resolve(xlsxPath);
  if (!fs.existsSync(filePath)) throw new Error(`XLSX não encontrado: ${filePath}`);

  const workbook = XLSX.readFile(filePath);
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error('Planilha XLSX sem abas.');

  const worksheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  if (!rows.length) throw new Error('Planilha XLSX vazia.');

  return rows;
}

function normalizeId(rawId, fallback) {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[.#$\[\]/]/g, '-');

  if (cleaned) return cleaned;
  return `produto-${fallback}`;
}

function parsePh(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s) return null;

  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function applyInChunks(ref, entries, { label }) {
  let payload = {};
  let keys = 0;
  let bytes = 2;
  let batches = 0;

  const flush = async () => {
    if (!keys) return;
    batches += 1;
    await ref.update(payload);
    payload = {};
    keys = 0;
    bytes = 2;
  };

  for (const [key, value] of entries) {
    const encodedEntry = JSON.stringify({ [key]: value });
    const entryBytes = Buffer.byteLength(encodedEntry, 'utf8') + 1;

    if (keys >= BATCH_MAX_KEYS || bytes + entryBytes > BATCH_MAX_BYTES) {
      await flush();
    }

    payload[key] = value;
    keys += 1;
    bytes += entryBytes;
  }

  await flush();
  console.log(`📦 ${label}: ${entries.length} paths em ${batches} lote(s).`);
}

async function resetDatabase(rootRef) {
  const confirm = String(process.env.CONFIRM_RESET || '').toUpperCase() === 'YES';
  if (!confirm) {
    console.log('⛔ Bloqueado: defina CONFIRM_RESET=YES para permitir reset do catálogo/índices.');
    console.log('ℹ️ Nenhuma alteração foi feita.');
    process.exit(1);
  }

  console.log('🗑️  Limpando dados existentes...');
  const resetPayload = {};
  DELETE_PATHS.forEach((p) => {
    resetPayload[p] = null;
  });

  await rootRef.update(resetPayload);

  console.log(`🗑️ Reset concluído: ${DELETE_PATHS.join(', ')}`);
  console.log('ℹ️ Mantido: produtos_usuarios\n');
}

async function run() {
  const args = parseArgs(process.argv);

  const credential = readServiceAccount(args.serviceAccount);

  admin.initializeApp({
    credential: admin.credential.cert(credential),
    databaseURL: args.databaseURL,
  });

  const db = admin.database();
  const rootRef = db.ref();

  console.log('🚀 INICIANDO RESET COMPLETO DO BANCO DE PRODUTOS');

  // 1) RESET (seguro)
  await resetDatabase(rootRef);

  // 2) Ler XLSX
  console.log('📂 Carregando produtos do Excel...');
  const rows = parseWorksheetRows(args.excelPath);
  console.log(`📊 ${rows.length} produtos encontrados no Excel`);

  // 3) Montar updates (catálogo e índice)
  console.log('💾 Salvando no catálogo global...');

  const importEntries = [];
  const indexEntries = [];

  let totalComPh = 0;
  let totalComUrl = 0;

  // Para métricas de palavras únicas:
  const uniqueTokens = new Set();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];

    // Seu XLSX:
    // nome_comercial, empresa, ph_fispq, url_fispq, tipo_produto (se não existir, fica "Não informado")
    const nomeComercial = String(row.nome_comercial || '').trim();
    const empresa = String(row.empresa || '').trim();
    const tipoProduto = String(row.tipo_produto || row.tipo || row.categoria || '').trim() || 'Não informado';

    const phFispq = parsePh(row.ph_fispq);
    const urlFispq = String(row.url_fispq || '').trim();

    const sourceId =
      row.id ||
      row.ID ||
      row.Id ||
      row.codigo ||
      row.CODIGO ||
      row.registro_mapa ||
      normalizeForSearch(nomeComercial);

    const produtoId = normalizeId(sourceId, i + 1);

    const produtoData = {
      nomeComercial,
      empresa,
      tipoProduto,
      phFispq,
      urlFispq,
      nome_key: normalizeForSearch(nomeComercial),

      // extras úteis (não atrapalham o app)
      principioAtivo: String(row.principio_ativo || '').trim(),
      concentracao: String(row.concentracao || '').trim(),
      formulacao: String(row.formulacao || '').trim(),
      registroMapa: String(row.registro_mapa || '').trim(),
      observacoes: String(row.observacoes || '').trim(),

      createdAt: Date.now() + i,
      createdBy: 'system',
      createdByEmail: 'system@caldacerta.com',
    };

    // validação mínima
    if (!produtoData.nomeComercial) {
      throw new Error(`Linha ${i + 2}: nome_comercial vazio (obrigatório).`);
    }

    if (produtoData.phFispq !== null) totalComPh += 1;
    if (produtoData.urlFispq) totalComUrl += 1;

    importEntries.push([`produtos_catalogo/${produtoId}`, produtoData]);

    // índice: palavras completas do nome + empresa + tipo
    const tokens = extractWords(`${produtoData.nomeComercial} ${produtoData.empresa} ${produtoData.tipoProduto}`);
    tokens.forEach((token) => {
      uniqueTokens.add(token);
      indexEntries.push([`produtos_catalogo_busca/${token}/${produtoId}`, true]);
    });

    if (i % 100 === 0) {
      console.log(`  Processados ${i} produtos...`);
    }
  }

  // 4) Escrever no RTDB em lotes
  console.log('🔥 Salvando catálogo...');
  await applyInChunks(rootRef, importEntries, { label: 'Importação de produtos_catalogo' });

  console.log('🔍 Salvando índice de busca...');
  await applyInChunks(rootRef, indexEntries, { label: 'Indexação produtos_catalogo_busca' });

  console.log('✅ RESET COMPLETADO COM SUCESSO!');
  console.log(`📈 ${rows.length} produtos indexados`);
  console.log(`🔤 ${uniqueTokens.size} palavras-chave criadas`);
  console.log(`🧪 ${totalComPh} produtos com pH FISPQ`);
  console.log(`🔗 ${totalComUrl} produtos com URL FISPQ`);
}

run().catch((error) => {
  console.error('❌ ERRO NO RESET:', error);
  process.exit(1);
});
