const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Importar funções do lib.js - usar caminho relativo correto
const { normalizeForSearch, extractWords, parseArgs, readServiceAccount } = require('./lib.js');

function parsePhValue(phString) {
  if (!phString) return null;

  // Substituir vírgula por ponto e converter para número
  const normalized = phString.toString().replace(',', '.');
  const parsed = parseFloat(normalized);

  // Verificar se é um número válido
  if (isNaN(parsed)) {
    console.warn(\⚠️  Valor de pH inválido: \"\\"\);
    return null;
  }

  return parsed;
}

async function resetDatabase() {
  const args = parseArgs(process.argv);
  const serviceAccount = readServiceAccount(args.serviceAccount);

  console.log('🚀 INICIANDO RESET COMPLETO DO BANCO DE PRODUTOS');

  // Inicializar Firebase Admin
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: args.databaseURL
    });
  }

  const db = admin.database();

  // 1. LIMPAR TODOS OS DADOS EXISTENTES
  console.log('🗑️  Limpando dados existentes...');
  await Promise.all([
    db.ref('produtos_catalogo').set(null),
    db.ref('produtos_catalogo_busca').set(null),
    db.ref('produtos_usuarios').set(null),
    db.ref('produtos_usuarios_busca').set(null)
  ]);

  // 2. CARREGAR PRODUTOS DO EXCEL
  console.log('📂 Carregando produtos do Excel...');
  const workbook = xlsx.readFile(args.excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const produtos = xlsx.utils.sheet_to_json(worksheet);

  console.log(\📊 \ produtos encontrados no Excel\);

  // 3. SALVAR NO CATÁLOGO GLOBAL
  console.log('💾 Salvando no catálogo global...');
  const catalogoUpdates = {};
  const buscaUpdates = {};

  for (let i = 0; i < produtos.length; i++) {
    const produto = produtos[i];
    const produtoId = \prod_\_\\;

    // Mapear colunas do Excel para nosso formato
    const nomeComercial = produto['Nome Comercial'] || '';
    const empresa = produto.Empresa || '';
    const classe = produto.Classe || 'Não informado';
    const phFispq = parsePhValue(produto.pH_FISPQ);
    const urlFispq = produto.FISPQ_url || '';

    // Dados do produto
    const produtoData = {
      nomeComercial,
      empresa,
      tipoProduto: classe,
      phFispq,
      urlFispq,
      nome_key: normalizeForSearch(nomeComercial),
      createdAt: Date.now() + i,
      createdBy: 'system',
      createdByEmail: 'system@caldacerta.com'
    };

    // Salvar no catálogo
    catalogoUpdates[\\\] = produtoData;

    // Criar índice de busca
    const searchText = \\ \\;
    const words = extractWords(searchText);

    words.forEach(word => {
      if (!buscaUpdates[word]) buscaUpdates[word] = {};
      buscaUpdates[word][produtoId] = true;
    });

    // Log a cada 100 produtos
    if (i % 100 === 0) {
      console.log(\  Processados \ produtos...\);
    }
  }

  // 4. SALVAR EM BATCHES
  console.log('🔥 Salvando catálogo...');
  await db.ref('produtos_catalogo').update(catalogoUpdates);

  console.log('🔍 Salvando índice de busca...');
  await db.ref('produtos_catalogo_busca').update(buscaUpdates);

  console.log('✅ RESET COMPLETADO COM SUCESSO!');
  console.log(\📈 \ produtos indexados\);
  console.log(\🔤 \ palavras-chave criadas\);

  // Contar produtos com pH
  const produtosComPh = Object.values(catalogoUpdates).filter(p => p.phFispq !== null).length;
  console.log(\🧪 \ produtos com pH FISPQ\);

  process.exit(0);
}

resetDatabase().catch(error => {
  console.error('❌ ERRO NO RESET:', error);
  process.exit(1);
});
