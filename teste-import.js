console.log("Testando importação de lib.js");
console.log("Diretório atual:", __dirname);

try {
  // Tentar importar de diferentes formas
  const lib1 = require('./lib.js');
  console.log("✅ Importação com './lib.js' funcionou");
} catch (e1) {
  console.log("❌ Falha com './lib.js':", e1.message);
  
  try {
    const lib2 = require('./lib');
    console.log("✅ Importação com './lib' funcionou");
  } catch (e2) {
    console.log("❌ Falha com './lib':", e2.message);
    
    try {
      const lib3 = require('./scripts/lib.js');
      console.log("✅ Importação com './scripts/lib.js' funcionou");
    } catch (e3) {
      console.log("❌ Falha com './scripts/lib.js':", e3.message);
    }
  }
}
