#!/usr/bin/env node

const admin = require('firebase-admin');
const { normalizeKey, buildSearchTokens, parseArgs, readServiceAccount } = require('./lib');

async function verifyProductIndex(db, produtoId, searchTerm) {
  console.log(`\n🔍 Verificando índice para produto: ${produtoId}`);
  console.log(`Termo de busca: "${searchTerm}"`);

  const produtoSnap = await db.ref(`produtos_catalogo/${produtoId}`).once('value');
  const produto = produtoSnap.val();

  if (!produto) {
    console.log('❌ Produto não encontrado no catálogo');
    return;
  }

  console.log(`Nome do produto: ${produto.nomeComercial || produto.nome}`);
  console.log(`Nome normalizado: ${produto.nome_key || 'Não tem nome_key'}`);

  const nomeBase = [
    produto.nomeComercial,
    produto.nome,
    produto.empresa,
    produto.nome_key
  ].filter(Boolean).join(' ');

  const expectedTokens = buildSearchTokens(nomeBase, 2);
  console.log(`Tokens esperados (${expectedTokens.length}):`, expectedTokens.slice(0, 10), '...');

  let foundCount = 0;
  for (const token of expectedTokens.slice(0, 20)) {
    const tokenSnap = await db.ref(`produtos_catalogo_busca/${token}/${produtoId}`).once('value');
    if (tokenSnap.exists()) {
      foundCount += 1;
    } else {
      console.log(`  ❌ Token faltando: "${token}"`);
    }
  }

  console.log(`✅ ${foundCount}/${Math.min(20, expectedTokens.length)} tokens encontrados no índice`);

  const searchKey = normalizeKey(searchTerm);
  const searchTokens = buildSearchTokens(searchKey, 2);
  console.log(`\n🧪 Testando busca por: "${searchTerm}"`);
  console.log('Tokens da busca:', searchTokens);

  const foundIds = new Set();
  for (const token of searchTokens) {
    const tokenSnap = await db.ref(`produtos_catalogo_busca/${token}`).once('value');
    const ids = tokenSnap.val() ? Object.keys(tokenSnap.val()) : [];
    ids.forEach((id) => foundIds.add(id));
  }

  console.log(`📊 IDs encontrados no índice: ${foundIds.size}`);
  console.log(`Produto ${produtoId} está nos resultados? ${foundIds.has(produtoId) ? '✅ SIM' : '❌ NÃO'}`);
}

async function run() {
  const args = parseArgs(process.argv);
  const credential = readServiceAccount(args.serviceAccount);

  admin.initializeApp({
    credential: admin.credential.cert(credential),
    databaseURL: args.databaseURL
  });

  const db = admin.database();
  const produtoId = process.env.RTDB_VERIFY_PRODUTO_ID || 'produto_exemplo_id';
  const searchTerm = process.env.RTDB_VERIFY_SEARCH_TERM || 'ZAPP QI 620';

  await verifyProductIndex(db, produtoId, searchTerm);

  const catalogoSnap = await db.ref('produtos_catalogo').once('value');
  const catalogoCount = Object.keys(catalogoSnap.val() || {}).length;
  console.log(`\n📦 Total de produtos no catálogo: ${catalogoCount}`);

  const indexSnap = await db.ref('produtos_catalogo_busca').once('value');
  const indexCount = Object.keys(indexSnap.val() || {}).length;
  console.log(`🔤 Total de tokens no índice: ${indexCount}`);
}

run().catch((error) => {
  console.error('❌ Erro ao verificar índice:', error);
  process.exit(1);
});
