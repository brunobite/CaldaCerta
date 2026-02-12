#!/usr/bin/env node

const admin = require('firebase-admin');
const { normalizeKey, parseArgs, readServiceAccount } = require('./lib');

async function processCollection(db, path, { dryRun = false, batch = 250 }) {
  const snapshot = await db.ref(path).once('value');
  const data = snapshot.val() || {};
  const entries = Object.entries(data);
  let updates = 0;

  for (let index = 0; index < entries.length; index += batch) {
    const chunk = entries.slice(index, index + batch);
    const payload = {};

    chunk.forEach(([id, produto]) => {
      if (!produto || typeof produto !== 'object') return;
      if (produto.nome_key) return;
      const nome = produto.nomeComercial || produto.nome || '';
      const nomeKey = normalizeKey(nome);
      if (!nomeKey) return;
      payload[`${id}/nome_key`] = nomeKey;
      updates += 1;
    });

    if (!dryRun && Object.keys(payload).length > 0) {
      await db.ref(path).update(payload);
    }
  }

  return { path, total: entries.length, updates };
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
    reports.push(await processCollection(db, 'produtos_catalogo', args));
  }

  if (args.mode === 'usuarios' || args.mode === 'all') {
    const usuariosSnap = await db.ref('produtos_usuarios').once('value');
    const usuarios = usuariosSnap.val() || {};

    for (const uid of Object.keys(usuarios)) {
      reports.push(await processCollection(db, `produtos_usuarios/${uid}`, args));
    }
  }

  reports.forEach((report) => {
    console.log(`✅ ${report.path}: ${report.updates}/${report.total} registros com nome_key atualizado${args.dryRun ? ' (dry-run)' : ''}.`);
  });
}

run().catch((error) => {
  console.error('❌ Erro no backfill de nome_key:', error);
  process.exit(1);
});
