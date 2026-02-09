const admin = require('firebase-admin');

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

async function backfillNomeKey(collectionName) {
  const collectionRef = firestore.collection(collectionName);
  const snapshot = await collectionRef.get();
  let batch = firestore.batch();
  let batchCount = 0;
  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    if (data.nome_key) {
      continue;
    }
    const nome = data.nomeComercial || data.nome || '';
    const key = normalizeKey(nome);
    if (!key) {
      continue;
    }
    batch.set(doc.ref, { nome_key: key }, { merge: true });
    batchCount += 1;
    updatedCount += 1;

    if (batchCount >= 450) {
      await batch.commit();
      batch = firestore.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`✅ ${collectionName}: ${updatedCount} documentos atualizados.`);
}

async function run() {
  await backfillNomeKey('produtos_catalogo');
  await backfillNomeKey('produtos_usuarios');
}

run().catch((error) => {
  console.error('❌ Erro ao migrar nome_key:', error);
  process.exit(1);
});
