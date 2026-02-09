const admin = require('firebase-admin');
const XLSX = require('xlsx');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const DEFAULT_XLSX_PATH = path.join(repoRoot, 'data', 'produtos.xlsx');
const args = new Set(process.argv.slice(2));
const shouldSoftDelete = args.has('--soft-delete');

const projectId = process.env.FIREBASE_PROJECT_ID;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!projectId) {
  console.error('❌ FIREBASE_PROJECT_ID não definido.');
  process.exit(1);
}

if (!serviceAccountJson) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON não definido.');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (error) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON inválido.');
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId
  });
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
  process.exit(1);
}

const firestore = admin.firestore();

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

function slugifyDocId(nome, empresa) {
  const base = `${normalizarTexto(nome)}__${normalizarTexto(empresa)}`;
  return base.replace(/[^a-z0-9_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function carregarPlanilha(caminho) {
  const workbook = XLSX.readFile(caminho);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

async function importarProdutos(caminhoXlsx) {
  console.log(`📖 Lendo arquivo: ${caminhoXlsx}`);
  const linhas = await carregarPlanilha(caminhoXlsx);
  console.log(`✅ ${linhas.length} produtos encontrados na planilha`);

  const collectionRef = firestore.collection('produtos_catalogo');
  const idsImportados = new Set();

  let batch = firestore.batch();
  let batchCount = 0;

  for (const linha of linhas) {
    const nomeComercial = linha['Nome Comercial'] || linha.nomeComercial || linha.nome || linha.Nome;
    const empresa = linha['Empresa'] || linha.empresa || linha.marca || linha.Marca || '';
    const phRaw = linha['pH_FISPQ'] ?? linha.phFispq ?? linha.ph ?? linha.pH ?? null;
    const urlFispq = linha['FISPQ_url'] || linha.urlFispq || linha.url || linha.FISPQ || '';

    if (!nomeComercial || !empresa) {
      continue;
    }

    const docId = slugifyDocId(nomeComercial, empresa);
    idsImportados.add(docId);

    const payload = {
      nomeComercial,
      empresa,
      phFispq: parsePhValue(phRaw),
      urlFispq: urlFispq || '',
      nome_key: normalizeKey(nomeComercial),
      nomeNormalizado: normalizarTexto(nomeComercial),
      empresaNormalizada: normalizarTexto(empresa),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true
    };

    const docRef = collectionRef.doc(docId);
    batch.set(docRef, payload, { merge: true });
    batchCount += 1;

    if (batchCount >= 450) {
      await batch.commit();
      batch = firestore.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  if (shouldSoftDelete) {
    console.log('🧹 Soft delete habilitado: marcando itens ausentes como inativos.');
    const snapshot = await collectionRef.get();
    let deleteBatch = firestore.batch();
    let deleteCount = 0;

    snapshot.forEach(doc => {
      if (!idsImportados.has(doc.id)) {
        deleteBatch.set(doc.ref, { isActive: false }, { merge: true });
        deleteCount += 1;
      }
    });

    if (deleteCount > 0) {
      await deleteBatch.commit();
    }
  }

  console.log('✅ Importação concluída com sucesso.');
}

const rawPathArg = args.size ? [...args].find(arg => !arg.startsWith('--')) : null;
const caminhoXlsx = rawPathArg
  ? (path.isAbsolute(rawPathArg) ? rawPathArg : path.join(repoRoot, rawPathArg))
  : DEFAULT_XLSX_PATH;
importarProdutos(caminhoXlsx).catch((error) => {
  console.error('❌ Erro ao importar:', error);
  process.exit(1);
});
