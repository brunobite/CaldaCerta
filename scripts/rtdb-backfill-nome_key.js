/**
 * Backfill nome_key no Firebase Realtime Database
 *
 * Alvos:
 *  - /produtos_catalogo/{id}
 *  - /produtos_usuarios/{uid}/{id}
 *
 * Regras:
 *  - nome_key = normalizeKey(nomeComercial || nome || "")
 *  - Só escreve se estiver faltando ou diferente
 *
 * Uso:
 *   node scripts/rtdb-backfill-nome_key.js --serviceAccount ./serviceAccount.json --databaseURL https://SEU-PROJETO-default-rtdb.firebaseio.com
 *
 * Dry-run (não escreve):
 *   node scripts/rtdb-backfill-nome_key.js --serviceAccount ./serviceAccount.json --databaseURL https://... --dry-run
 *
 * Ajustar limites:
 *   --limit-catalogo 999999
 *   --limit-usuarios 999999
 *   --batch 300
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.replace(/^--/, "");
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function normalizeKey(valor) {
  return (valor || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const args = parseArgs(process.argv);

  const serviceAccountPath = args["serviceAccount"] || args["service-account"];
  const databaseURL = args["databaseURL"] || args["database-url"];

  const dryRun = !!args["dry-run"];
  const batchSize = Number(args["batch"] || 300);

  const limitCatalogo = Number(args["limit-catalogo"] || 9999999);
  const limitUsuarios = Number(args["limit-usuarios"] || 9999999);

  const PATH_CATALOGO = (args["path-catalogo"] || "produtos_catalogo").replace(/^\/+/, "");
  const PATH_USUARIOS = (args["path-usuarios"] || "produtos_usuarios").replace(/^\/+/, "");

  if (!serviceAccountPath || !databaseURL) {
    console.error("❌ Parâmetros obrigatórios faltando.");
    console.error("Use: --serviceAccount ./serviceAccount.json --databaseURL https://<projeto>-default-rtdb.firebaseio.com");
    process.exit(1);
  }

  const resolvedServiceAccount = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.join(process.cwd(), serviceAccountPath);

  if (!fs.existsSync(resolvedServiceAccount)) {
    console.error(`❌ serviceAccount não encontrado: ${resolvedServiceAccount}`);
    process.exit(1);
  }

  const serviceAccount = require(resolvedServiceAccount);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL
  });

  const db = admin.database();

  console.log("==================================================");
  console.log("RTDB Backfill nome_key");
  console.log("Database:", databaseURL);
  console.log("Paths:", { catalogo: "/" + PATH_CATALOGO, usuarios: "/" + PATH_USUARIOS });
  console.log("Batch:", batchSize, "| Dry-run:", dryRun);
  console.log("Início:", nowIso());
  console.log("==================================================");

  // -------------------------
  // 1) CATALOGO
  // -------------------------
  console.log(`\n[1/2] Lendo catálogo: /${PATH_CATALOGO} ...`);
  const catSnap = await db.ref(PATH_CATALOGO).once("value");
  const catData = catSnap.val() || {};
  const catEntries = Object.entries(catData).slice(0, limitCatalogo);

  console.log(`Catálogo itens lidos: ${catEntries.length}`);

  const catUpdates = {};
  let catNeed = 0;

  for (const [id, p] of catEntries) {
    const nome = (p && (p.nomeComercial || p.nome)) || "";
    const computed = normalizeKey(nome);

    if (!computed) continue; // sem nome não dá pra gerar nome_key

    const current = (p && p.nome_key) ? p.nome_key.toString() : "";
    if (current !== computed) {
      catNeed++;
      catUpdates[`${PATH_CATALOGO}/${id}/nome_key`] = computed;
    }
  }

  console.log(`Catálogo: ${catNeed} itens precisam atualização de nome_key`);

  if (!dryRun && catNeed > 0) {
    const keys = Object.keys(catUpdates);
    const chunks = chunkArray(keys, batchSize);

    console.log(`Aplicando updates catálogo em ${chunks.length} lote(s)...`);

    let applied = 0;
    for (let i = 0; i < chunks.length; i++) {
      const batchKeys = chunks[i];
      const batchUpdateObj = {};
      for (const k of batchKeys) batchUpdateObj[k] = catUpdates[k];

      await db.ref().update(batchUpdateObj);
      applied += batchKeys.length;

      console.log(` - Lote ${i + 1}/${chunks.length}: ${applied}/${keys.length} campos atualizados`);
    }
    console.log("✅ Catálogo atualizado.");
  } else if (dryRun) {
    console.log("🟡 Dry-run: nenhuma escrita feita no catálogo.");
  } else {
    console.log("ℹ️ Nada para atualizar no catálogo.");
  }

  // -------------------------
  // 2) PRODUTOS USUÁRIOS
  // -------------------------
  console.log(`\n[2/2] Lendo usuários: /${PATH_USUARIOS} ...`);
  const usersSnap = await db.ref(PATH_USUARIOS).once("value");
  const usersData = usersSnap.val() || {};
  const userUids = Object.keys(usersData);

  console.log(`Usuários encontrados: ${userUids.length}`);

  const userUpdates = {};
  let userNeed = 0;
  let userProductsRead = 0;

  for (const uid of userUids) {
    const userNode = usersData[uid] || {};
    const prodEntries = Object.entries(userNode);

    for (const [id, p] of prodEntries) {
      userProductsRead++;
      if (userProductsRead > limitUsuarios) break;

      const nome = (p && (p.nomeComercial || p.nome)) || "";
      const computed = normalizeKey(nome);
      if (!computed) continue;

      const current = (p && p.nome_key) ? p.nome_key.toString() : "";
      if (current !== computed) {
        userNeed++;
        userUpdates[`${PATH_USUARIOS}/${uid}/${id}/nome_key`] = computed;
      }
    }

    if (userProductsRead > limitUsuarios) break;
  }

  console.log(`Produtos usuários lidos: ${Math.min(userProductsRead, limitUsuarios)}`);
  console.log(`Usuários: ${userNeed} itens precisam atualização de nome_key`);

  if (!dryRun && userNeed > 0) {
    const keys = Object.keys(userUpdates);
    const chunks = chunkArray(keys, batchSize);

    console.log(`Aplicando updates usuários em ${chunks.length} lote(s)...`);

    let applied = 0;
    for (let i = 0; i < chunks.length; i++) {
      const batchKeys = chunks[i];
      const batchUpdateObj = {};
      for (const k of batchKeys) batchUpdateObj[k] = userUpdates[k];

      await db.ref().update(batchUpdateObj);
      applied += batchKeys.length;

      console.log(` - Lote ${i + 1}/${chunks.length}: ${applied}/${keys.length} campos atualizados`);
    }

    console.log("✅ Produtos de usuários atualizados.");
  } else if (dryRun) {
    console.log("🟡 Dry-run: nenhuma escrita feita em produtos de usuários.");
  } else {
    console.log("ℹ️ Nada para atualizar em produtos de usuários.");
  }

  console.log("\n==================================================");
  console.log("Fim:", nowIso());
  console.log("==================================================");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
