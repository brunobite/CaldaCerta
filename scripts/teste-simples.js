const fs = require("fs");
const xlsx = require("xlsx");

console.log("🧪 TESTE SIMPLIFICADO");

// 1. Testar leitura do service account
try {
  const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"));
  console.log("✅ Service Account carregado");
  console.log("   Projeto:", serviceAccount.project_id);
} catch (error) {
  console.error("❌ Erro service account:", error.message);
}

// 2. Testar leitura do Excel
try {
  const workbook = xlsx.readFile("./produtos.xlsx");
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const produtos = xlsx.utils.sheet_to_json(worksheet);
  console.log("✅ Excel carregado");
  console.log("   Total produtos:", produtos.length);
  
  // Mostrar alguns produtos para ver estrutura
  console.log("\n📋 Amostra de produtos:");
  for (let i = 0; i < 3; i++) {
    const p = produtos[i];
    console.log(`\n   Produto ${i + 1}:`);
    console.log(`     Nome: ${p["Nome Comercial"]}`);
    console.log(`     Empresa: ${p.Empresa}`);
    console.log(`     Classe: ${p.Classe}`);
    console.log(`     pH: ${p.pH_FISPQ}`);
    console.log(`     URL: ${p.FISPQ_url}`);
  }
} catch (error) {
  console.error("❌ Erro Excel:", error.message);
}

console.log("\n🎯 PRONTO!");
