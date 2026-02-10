#!/usr/bin/env node

const admin = require('firebase-admin');
const { buildSearchTokens, parseArgs, readServiceAccount } = require('./lib');

async function verifyIndex(database, produtoId, expectedTokens) {
  const checks = expectedTokens.map((token) => (
    database.ref(`produtos_catalogo_busca/${token}/${produtoId}`).once('value')
  ));

  const results = await Promise.all(checks);
  const missingTokens = expectedTokens.filter((_, index) => !results[index].exists());

  return {
    found: expectedTokens.length - missingTokens.length,
    total: expectedTokens.length,
    missingTokens
  };
}

async function indexCatalogo(db, options) {
  const snapshot = await db.ref('produtos_catalogo').once('value');
  const data = snapshot.val() || {};
  return writeIndex(db, Object.entries(data), {
    indexRoot: 'produtos_catalogo_busca',
    sourceLabel: 'catalogo',
    ...options
  });
}

async function indexUsuarios(db, options) {
  const snapshot = await db.ref('produtos_usuarios').once('value');
  const usersData = snapshot.val() || {};
  const reports = [];

  for (const [uid, produtos] of Object.entries(usersData)) {
    const entries = Object.entries(produtos || {});
    reports.push(await writeIndex(db, entries, {
      indexRoot: `produtos_usuarios_busca/${uid}`,
      sourceLabel: `usuarios/${uid}`,
      ...options
    }));
  }

  return reports;
}

async function writeIndex(db, entries, { indexRoot, sourceLabel, dryRun = false, batch = 250 }) {
  let processed = 0;
  let writes = 0;
  let verifyFailures = 0;

  if (!dryRun) {
    await db.ref(indexRoot).set(null);
  }

  for (let index = 0; index < entries.length; index += batch) {
    const chunk = entries.slice(index, index + batch);
    const payload = {};

    for (const [id, produto] of chunk) {
      const nomeBase = [
        produto?.nomeComercial,
        produto?.nome,
        produto?.empresa,
        produto?.nome_key
      ].filter(Boolean).join(' ');

      const tokens = buildSearchTokens(nomeBase, 2);
      tokens.forEach((token) => {
        payload[`${token}/${id}`] = true;
        writes += 1;
      });
      processed += 1;
    }

    if (!dryRun && Object.keys(payload).length > 0) {
      await db.ref(indexRoot).update(payload);

      if (indexRoot === 'produtos_catalogo_busca') {
        const [sampleId, sampleProduto] = chunk[0] || [];
        if (sampleId && sampleProduto) {
          const sampleBase = [
            sampleProduto?.nomeComercial,
            sampleProduto?.nome,
            sampleProduto?.empresa,
            sampleProduto?.nome_key
          ].filter(Boolean).join(' ');
          const sampleTokens = buildSearchTokens(sampleBase, 2);
          const verifyReport = await verifyIndex(db, sampleId, sampleTokens);

          if (verifyReport.missingTokens.length > 0) {
            verifyFailures += 1;
            console.warn(`⚠️ Verificação de índice falhou para ${sampleId}: faltando ${verifyReport.missingTokens.length}/${verifyReport.total} tokens.`);
          }
        }
      }
    }
  }

  return {
    sourceLabel,
    total: entries.length,
    processed,
    writes,
    verifyFailures
  };
}

async function run() {
  const args = parseArgs(process.argv);
  const credential = readServiceAccount(args.serviceAccount);

  admin.initializeApp({
    credential: admin.credential.cert(credential),
    databaseURL: args.databaseURL
  });

  const db = admin.database();
  const reports = [];

  if (args.mode === 'catalogo' || args.mode === 'all') {
    reports.push(await indexCatalogo(db, args));
  }

  if (args.mode === 'usuarios' || args.mode === 'all') {
    const usersReports = await indexUsuarios(db, args);
    reports.push(...usersReports);
  }

  reports.forEach((report) => {
    const verificationInfo = report.verifyFailures ? `, ${report.verifyFailures} falhas de verificação` : '';
    console.log(`✅ Índice ${report.sourceLabel}: ${report.processed}/${report.total} produtos, ${report.writes} tokens${verificationInfo}${args.dryRun ? ' (dry-run)' : ''}.`);
  });
}

run().catch((error) => {
  console.error('❌ Erro ao construir índice de tokens:', error);
  process.exit(1);
});
