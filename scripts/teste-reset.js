const admin = require('firebase-admin');
const fs = require('fs');
const xlsx = require('xlsx');

console.log('🧪 TESTE DE CONEXÃO E ESTRUTURA');

// 1. Testar leitura do service account
try {
  const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
  console.log('✅ Service Account carregado com sucesso');
  console.log('   Projeto:', serviceAccount.project_id);
} catch (error) {
  console.error('❌ Erro ao ler service account:', error.message);
}

// 2. Testar leitura do Excel
try {
  const workbook = xlsx.readFile('./produtos.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const produtos = xlsx.utils.sheet_to_json(worksheet);
  console.log('✅ Excel carregado com sucesso');
  console.log('   Total de produtos:', produtos.length);
  console.log('   Amostra de nomes (primeiros 5):');
  produtos.slice(0, 5).forEach((p, i) => {
    const nome = p.NOME_COMERCIAL || p.nome || 'Sem nome';
    console.log(\   \. \\);
  });
} catch (error) {
  console.error('❌ Erro ao ler Excel:', error.message);
}

// 3. Testar normalização
const testText = 'ZAPP QI 620 - Syngenta';
console.log('📝 Teste de normalização:');
console.log('   Original:', testText);
console.log('   Normalizado:', testText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

console.log('\n🎯 PRONTO PARA EXECUTAR O RESET!');
console.log('Para executar: npm run fix-all');
