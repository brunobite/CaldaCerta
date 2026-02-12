const fs = require("fs");
const path = require("path");

function normalizeForSearch(text) {
  return (text || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractWords(text, minLength = 2) {
  const normalized = normalizeForSearch(text);
  const words = normalized.split(" ")
    .filter(word => word.length >= minLength)
    .filter((word, index, self) => self.indexOf(word) === index);
  
  return words;
}

function parseArgs(argv) {
  const args = {
    serviceAccount: "",
    databaseURL: "https://caldacerta-pro-default-rtdb.firebaseio.com",
    excelPath: "./produtos.xlsx"
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--serviceAccount=")) {
      args.serviceAccount = arg.split("=")[1];
    } else if (arg.startsWith("--databaseURL=")) {
      args.databaseURL = arg.split("=")[1];
    } else if (arg.startsWith("--excelPath=")) {
      args.excelPath = arg.split("=")[1];
    } else if (arg === "--help") {
      console.log(`
Uso: node reset-produtos.js [opções]

Opções:
  --serviceAccount=<caminho>  Caminho para o arquivo serviceAccountKey.json
  --databaseURL=<url>         URL do Realtime Database
  --excelPath=<caminho>       Caminho para o arquivo Excel
  --help                      Mostra esta ajuda
      `);
      process.exit(0);
    }
  }

  if (!args.serviceAccount) {
    console.error("❌ ERRO: --serviceAccount é obrigatório");
    process.exit(1);
  }

  return args;
}

function readServiceAccount(serviceAccountPath) {
  const absolutePath = path.resolve(serviceAccountPath);
  const fileContent = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(fileContent);
}

module.exports = {
  normalizeForSearch,
  extractWords,
  parseArgs,
  readServiceAccount
};