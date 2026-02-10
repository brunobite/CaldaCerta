/**
 * Backfill de nome_key em /produtos_catalogo
 *
 * Uso:
 * node scripts/rtdb-fix/nome_key_backfill.js ./serviceAccountKey.json https://caldacerta-pro-default-rtdb.firebaseio.com
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

function normalizeKey(valor) {
  return (valor || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const [serviceAccountPath, databaseURL] = process.argv.slice(2);

  if (!serviceAccountPath || !databaseURL) {
    console.error("❌ Uso incorreto.");
    console.error(
      "Uso correto:\nnode scripts/rtdb-fix/nome_key_backfill.js ./serviceAccountKey.json https://SEU-PROJETO.firebaseio.com"
    );
    process.exit(1);
  }

  const absKeyPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.join(process.cwd(), serviceAccountPath);

  if (!fs.existsSync(absKeyPath)) {
    console.error("❌ Arquivo serviceAccountKey.json não encontrado:");
    console.error(absKeyPath);
    process.exit(1);
  }

  const serviceAccount = require(absKeyPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL,
  });

  const ref = admin.database().ref("produtos_catalogo");

  console.log("🔎 Lendo /produtos_catalogo...");
  const snap = await ref.once("value");

  const total = snap.numChildren();
  console.log("📦 Total de produtos:", total);

  let updates = {};
  let toFix = 0;
  let skippedNoName = 0;

  snap.forEach((child) => {
    const key = child.key;
    const val = child.val() || {};

    const nome = val.nome || val.nomeProduto || val.produto || "";

    if (!nome) {
      skippedNoName++;
      return;
    }

    if (!val.nome_key) {
      const nomeKey = normalizeKey(nome);
      if (nomeKey) {
        updates[`${key}/nome_key`] = nomeKey;
        toFix++;
      }
    }
  });

  console.log("🧩 Produtos sem campo nome:", skippedNoName);
  console.log("🛠️ Produtos a corrigir (nome_key ausente):", toFix);

  if (toFix === 0) {
    console.log("✅ Nenhuma correção necessária.");
    process.exit(0);
  }

  const entries = Object.entries(updates);
  const BATCH_SIZE = 400;
  let processed = 0;

  console.log("🚀 Gravando nome_key em lotes...");

  while (processed < entries.length) {
    const batch = entries.slice(processed, processed + BATCH_SIZE);
    const batchObj = Object.fromEntries(batch);

    await ref.update(batchObj);

    processed += batch.length;
    console.log(`✅ Batch aplicado: ${processed}/${entries.length}`);
  }

  console.log("🎉 Finalizado!");
  console.log("nome_key criado para:", toFix, "produtos.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro durante execução:");
  console.error(err);
  process.exit(1);
});
