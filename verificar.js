const http = require('http');

console.log('🔍 VERIFICADOR DE SISTEMA - CALDACERTA\n');

// Teste 1: Verificar se Node.js está instalado
console.log('✓ Node.js instalado:', process.version);

// Teste 2: Verificar arquivos essenciais
const fs = require('fs');
const path = require('path');

const arquivos = [
  '../web/index.html',
  '../web/api-config.js',
  './server.js',
  './package.json'
];

console.log('\n📁 Verificando arquivos...');
arquivos.forEach(arquivo => {
  const existe = fs.existsSync(path.join(__dirname, arquivo));
  console.log(existe ? '✓' : '✗', arquivo, existe ? '(OK)' : '(FALTANDO)');
});

// Teste 3: Verificar se servidor está rodando
console.log('\n🌐 Testando conexão com servidor...');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/stats',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log('✓ Servidor respondendo na porta 3000');
  console.log('✓ Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const stats = JSON.parse(data);
      console.log('\n📊 Estatísticas do banco:');
      console.log('  - Simulações:', stats.total_simulacoes || 0);
      console.log('  - Produtos:', stats.total_produtos || 0);
      console.log('  - Clientes:', stats.total_clientes || 0);
      console.log('  - Operadores:', stats.total_operadores || 0);
      console.log('\n✅ SISTEMA FUNCIONANDO PERFEITAMENTE!\n');
    } catch (e) {
      console.log('⚠️  Resposta do servidor:', data);
    }
  });
});

req.on('error', (error) => {
  console.log('✗ Servidor NÃO está rodando');
  console.log('💡 Inicie o servidor com: npm start');
  console.log('\n❌ ERRO:', error.message, '\n');
});

req.end();

// Teste 4: Verificar banco de dados
setTimeout(() => {
  const dbPath = path.join(__dirname, '../database/caldacerta.db');
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('\n💾 Banco de dados:');
    console.log('  - Localização:', dbPath);
    console.log('  - Tamanho:', Math.round(stats.size / 1024), 'KB');
    console.log('  - Última modificação:', stats.mtime.toLocaleString('pt-BR'));
  } else {
    console.log('\n⚠️  Banco de dados ainda não foi criado');
    console.log('   Será criado automaticamente na primeira execução');
  }
}, 1000);
