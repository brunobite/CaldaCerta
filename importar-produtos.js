const XLSX = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('📊 Importador de Produtos - CaldaCerta');
console.log('=====================================\n');

// Conectar ao banco
const dbPath = path.join(__dirname, '../database/caldacerta.db');
const db = new sqlite3.Database(dbPath);

// Nome do arquivo Excel (coloque na mesma pasta que este arquivo)
const excelFile = 'produtos.xlsx';

try {
  // Ler planilha
  console.log(`📖 Lendo arquivo: ${excelFile}`);
  const workbook = XLSX.readFile(excelFile);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const produtos = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`✅ ${produtos.length} produtos encontrados na planilha\n`);
  
  // Preparar inserção
  const stmt = db.prepare(`
    INSERT INTO produtos (nome, marca, formulacao, tipo, ph, ingrediente_ativo, concentracao)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  let inserted = 0;
  let errors = 0;
  
  // Inserir cada produto
  produtos.forEach((p, index) => {
    try {
      stmt.run(
        p.nome || p.Nome || p.NOME,
        p.marca || p.Marca || p.MARCA || '',
        p.formulacao || p.Formulacao || p.FORMULACAO || 'SC',
        p.tipo || p.Tipo || p.TIPO || 'PRODUTO',
        p.ph || p.pH || p.PH || null,
        p.ingrediente_ativo || p['Ingrediente Ativo'] || p.INGREDIENTE_ATIVO || '',
        p.concentracao || p.Concentracao || p.CONCENTRACAO || ''
      );
      inserted++;
      console.log(`✓ [${index + 1}/${produtos.length}] ${p.nome || p.Nome}`);
    } catch (err) {
      errors++;
      console.log(`✗ [${index + 1}/${produtos.length}] Erro: ${err.message}`);
    }
  });
  
  stmt.finalize();
  
  console.log('\n=====================================');
  console.log(`✅ Importação concluída!`);
  console.log(`   Sucesso: ${inserted} produtos`);
  console.log(`   Erros: ${errors}`);
  console.log('=====================================\n');
  
} catch (error) {
  console.error('❌ Erro ao importar:', error.message);
  console.log('\n💡 Dicas:');
  console.log('   1. Certifique-se que o arquivo "produtos.xlsx" está nesta pasta');
  console.log('   2. Verifique se as colunas estão corretas: nome, marca, formulacao, tipo, ph');
  console.log('   3. Execute "npm install xlsx" se ainda não instalou\n');
}

db.close();
