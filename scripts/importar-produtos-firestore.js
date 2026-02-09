const admin = require('firebase-admin');
const XLSX = require('xlsx');
const path = require('path');

console.log('📊 Importador Firestore - produtos_catalogo');
console.log('==========================================\n');

const arquivoExcel = process.argv[2] || 'produtos.xlsx';
const caminhoExcel = path.isAbsolute(arquivoExcel)
  ? arquivoExcel
  : path.join(process.cwd(), arquivoExcel);

function normalizarTexto(valor) {
  return (valor || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

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
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  const normalized = rawValue.toString().replace(',', '.').trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
  process.exit(1);
}

const firestore = admin.firestore();

async function importar() {
  console.log(`📖 Lendo arquivo: ${caminhoExcel}`);
  const workbook = XLSX.readFile(caminhoExcel);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const linhas = XLSX.utils.sheet_to_json(worksheet);

  console.log(`✅ ${linhas.length} produtos encontrados na planilha\n`);

  const collectionRef = firestore.collection('produtos_catalogo');
  let batch = firestore.batch();
  let batchCount = 0;
  let totalInseridos = 0;

  for (const linha of linhas) {
    const nomeComercial = linha.nomeComercial || linha.nome || linha.Nome || linha.NOME;
    const empresa = linha.empresa || linha.marca || linha.Marca || linha.MARCA || '';
    const phFispq = linha.phFispq ?? linha.ph ?? linha.pH ?? linha.PH ?? null;
    const urlFispq = linha.urlFispq || linha.url || linha.URL || linha.fispq || linha.FISPQ || '';

    if (!nomeComercial) {
      continue;
    }

    const docRef = collectionRef.doc();
    batch.set(docRef, {
      nomeComercial,
      empresa,
      phFispq: parsePhValue(phFispq),
      urlFispq: urlFispq || '',
      nome_key: normalizeKey(nomeComercial),
      nomeNormalizado: normalizarTexto(nomeComercial),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'xlsx'
    });
    batchCount += 1;
    totalInseridos += 1;

    if (batchCount >= 450) {
      await batch.commit();
      batch = firestore.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log('\n==========================================');
  console.log('✅ Importação concluída!');
  console.log(`   Sucesso: ${totalInseridos} produtos`);
  console.log('==========================================\n');
}

importar().catch((error) => {
  console.error('❌ Erro ao importar:', error);
  process.exit(1);
});
