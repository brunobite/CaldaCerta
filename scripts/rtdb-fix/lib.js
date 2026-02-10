const fs = require('fs');
const path = require('path');

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

function buildSearchTokens(text, minLength = 2) {
  const normalized = normalizeKey(text);
  if (!normalized) return [];

  const tokens = new Set();
  const words = normalized.split(' ').filter(Boolean);

  for (const word of words) {
    if (word.length < minLength) continue;
    for (let size = minLength; size <= word.length; size += 1) {
      tokens.add(word.slice(0, size));
    }
  }

  return [...tokens];
}

function parseArgs(argv) {
  const args = {
    serviceAccount: '',
    databaseURL: 'https://caldacerta-pro-default-rtdb.firebaseio.com',
    mode: 'all',
    dryRun: false,
    batch: 250
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;

    const [rawKey, rawValue] = arg.split('=');
    const key = rawKey.replace(/^--/, '');
    const next = rawValue !== undefined ? rawValue : argv[index + 1];

    switch (key) {
      case 'serviceAccount':
        args.serviceAccount = next;
        if (rawValue === undefined) index += 1;
        break;
      case 'databaseURL':
        args.databaseURL = next;
        if (rawValue === undefined) index += 1;
        break;
      case 'mode':
        args.mode = next;
        if (rawValue === undefined) index += 1;
        break;
      case 'batch':
        args.batch = Number(next) || args.batch;
        if (rawValue === undefined) index += 1;
        break;
      case 'dry-run':
        args.dryRun = true;
        break;
      default:
        break;
    }
  }

  if (!args.serviceAccount) {
    throw new Error('Parâmetro obrigatório: --serviceAccount <caminho>');
  }

  if (!['catalogo', 'usuarios', 'all'].includes(args.mode)) {
    throw new Error('Parâmetro --mode inválido. Use catalogo|usuarios|all');
  }

  return args;
}

function readServiceAccount(serviceAccountPath) {
  const absolutePath = path.resolve(serviceAccountPath);
  const fileContent = fs.readFileSync(absolutePath, 'utf8');
  return JSON.parse(fileContent);
}

module.exports = {
  normalizeKey,
  buildSearchTokens,
  parseArgs,
  readServiceAccount
};
