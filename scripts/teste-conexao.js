const admin = require('firebase-admin');
const fs = require('fs');

console.log('🧪 Teste de conexão com Firebase');

async function testConnection() {
  try {
    // Carregar service account
    const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
    console.log('✅ Service Account carregado');
    console.log('   Projeto:', serviceAccount.project_id);
    
    // Inicializar Firebase Admin
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://caldacerta-pro-default-rtdb.firebaseio.com'
      });
      console.log('✅ Firebase Admin inicializado');
    }
    
    const db = admin.database();
    
    // Testar conexão
    const testRef = db.ref('teste_conexao');
    await testRef.set({
      timestamp: Date.now(),
      message: 'Teste de conexão'
    });
    
    console.log('✅ Escrita no Firebase OK');
    
    // Ler de volta
    const snapshot = await testRef.once('value');
    console.log('✅ Leitura do Firebase OK');
    
    // Limpar
    await testRef.remove();
    console.log('✅ Dados de teste removidos');
    
    return true;
  } catch (error) {
    console.error('❌ Erro:', error.message);
    return false;
  }
}

// Executar
testConnection().then(success => {
  if (success) {
    console.log('\n🎯 Conexão funcionando!');
    process.exit(0);
  } else {
    process.exit(1);
  }
});
