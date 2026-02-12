@"
#!/usr/bin/env node

const admin = require('firebase-admin');
const { normalizeForSearch, extractWords, parseArgs, readServiceAccount } = require('./lib');

async function rebuildIndex() {
  const args = parseArgs(process.argv);
  const credential = readServiceAccount(args.serviceAccount);

  admin.initializeApp({
    credential: admin.credential.cert(credential),
    databaseURL: args.databaseURL
  });

  const db = admin.database();
  
  console.log('🔍 Reconstruindo índice de busca...');
  
  // 1. Ler todos os produtos do catálogo
  const catalogoSnap = await db.ref('produtos_catalogo').once('value');
  const produtos = catalogoSnap.val() || {};
  
  // 2. Criar novo índice
  const indexUpdates = {};
  
  Object.entries(produtos).forEach(([produtoId, produto]) => {
    const searchText = \`\${produto.nomeComercial || ''} \${produto.empresa || ''}\`;
    const words = extractWords(searchText);
    
    words.forEach(word => {
      if (!indexUpdates[word]) indexUpdates[word] = {};
      indexUpdates[word][produtoId] = true;
    });
  });
  
  // 3. Salvar índice
  await db.ref('produtos_catalogo_busca').set(null);
  await db.ref('produtos_catalogo_busca').update(indexUpdates);
  
  console.log('✅ Índice reconstruído com sucesso!');
  console.log(\`📊 Produtos: \${Object.keys(produtos).length}\`);
  console.log(\`🔤 Palavras-chave: \${Object.keys(indexUpdates).length}\`);
  
  process.exit(0);
}

rebuildIndex().catch(error => {
  console.error('❌ Erro ao reconstruir índice:', error);
  process.exit(1);
});
"@ | Out-File -FilePath scripts/build-simple-index.js -Encoding UTF8