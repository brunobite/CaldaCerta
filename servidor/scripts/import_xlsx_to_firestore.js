const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const baseDir = path.resolve(__dirname, '..');
const defaultInputPath = path.join(baseDir, 'dados', 'produtos.xlsx');
const defaultCollection = 'produtos_catalogo';

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const [key, inlineValue] = arg.split('=');
    if (inlineValue !== undefined) {
      options[key.replace(/^--/, '')] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      options[key.replace(/^--/, '')] = next;
      i += 1;
    } else {
      options[key.replace(/^--/, '')] = true;
    }
  }
  return options;
}

function normalizarTexto(valor) {
  return (valor || '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyDocId(nome, empresa) {
  const base = `${normalizarTexto(nome)}__${normalizarTexto(empresa)}`;
  return base
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function carregarCredenciais(serviceAccountPath) {
  if (serviceAccountPath) {
    const resolvedPath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(baseDir, serviceAccountPath);
    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    return JSON.parse(raw);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  throw new Error('Service account não informado. Use --service-account ou FIREBASE_SERVICE_ACCOUNT_JSON.');
}

async function carregarPlanilha(caminho) {
  const workbook = XLSX.readFile(caminho);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

async function importarProdutos({ inputPath, collectionName }) {
  console.log(`📖 Lendo arquivo: ${inputPath}`);
  const linhas = await carregarPlanilha(inputPath);
  console.log(`✅ ${linhas.length} produtos encontrados na planilha`);

  const collectionRef = admin.firestore().collection(collectionName);

  let batch = admin.firestore().batch();
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

    const payload = {
      nomeComercial,
      empresa,
      phFispq: Number.isFinite(Number(phRaw)) ? Number(phRaw) : null,
      urlFispq: urlFispq || '',
      nomeNormalizado: normalizarTexto(nomeComercial),
      empresaNormalizada: normalizarTexto(empresa),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true
    };

    batch.set(collectionRef.doc(docId), payload, { merge: true });
    batchCount += 1;

    if (batchCount >= 450) {
      await batch.commit();
      batch = admin.firestore().batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log('✅ Importação concluída com sucesso.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input || args.i || defaultInputPath;
  const collectionName = args.collection || defaultCollection;
  const serviceAccountPath = args['service-account'] || args.serviceAccount;

  const serviceAccount = carregarCredenciais(serviceAccountPath);
  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID não definido e project_id ausente no service account.');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId
  });

  await importarProdutos({
    inputPath: path.isAbsolute(inputPath) ? inputPath : path.resolve(baseDir, inputPath),
    collectionName
  });
}

main().catch((error) => {
  console.error('❌ Erro ao importar:', error.message || error);
  process.exit(1);
});
