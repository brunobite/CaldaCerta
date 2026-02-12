#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Importar funções do lib.js
const { normalizeForSearch, extractWords, parseArgs, readServiceAccount } = require('./lib');

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
    
    // Dados do produto
    const produtoData = {
      nomeComercial: produto.NOME_COMERCIAL || produto.nome || '',
      empresa: produto.EMPRESA || produto.fabricante || '',
      tipoProduto: produto.TIPO || 'Não informado',
      phFispq: parseFloat(produto.PH || produto.pH || 0) || null,
      urlFispq: produto.URL_FISPQ || produto.fispq || '',
      nome_key: normalizeForSearch(produto.NOME_COMERCIAL || produto.nome || ''),
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
  
  process.exit(0);
}

resetDatabase().catch(error => {
  console.error('❌ ERRO NO RESET:', error);
  process.exit(1);
});
