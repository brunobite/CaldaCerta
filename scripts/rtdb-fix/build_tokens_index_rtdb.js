#!/usr/bin/env node

const admin = require('firebase-admin');
const { buildSearchTokens, parseArgs, readServiceAccount } = require('./lib');

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
    }
  }

  return {
    sourceLabel,
    total: entries.length,
    processed,
    writes
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
    console.log(`✅ Índice ${report.sourceLabel}: ${report.processed}/${report.total} produtos, ${report.writes} tokens${args.dryRun ? ' (dry-run)' : ''}.`);
  });
}

run().catch((error) => {
  console.error('❌ Erro ao construir índice de tokens:', error);
  process.exit(1);
});
