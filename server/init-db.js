const fs = require("fs").promises;
const path = require("path");

const DB_DIR = path.join(__dirname, "data");

const dadosIniciais = {
  "produtos.json": [
    {
      "id": 1,
      "nome": "Glifosato 480",
      "marca": "Roundup",
      "formulacao": "SC",
      "tipo": "PRODUTO",
      "ph": 5.5
    },
    {
      "id": 2,
      "nome": "Óleo Mineral",
      "marca": "Nimbus",
      "formulacao": "ADJUVANTE",
      "tipo": "OLEO",
      "ph": 7.0
    },
    {
      "id": 3,
      "nome": "Spreader",
      "marca": "Aureo",
      "formulacao": "ESPALHANTE",
      "tipo": "ADJUVANTE",
      "ph": 6.8
    }
  ],
  "clientes.json": [],
  "responsaveis.json": [],
  "operadores.json": [],
  "simulacoes.json": []
};

async function init() {
  try {
    // Criar diretório se não existir
    await fs.mkdir(DB_DIR, { recursive: true });
    
    // Inicializar cada arquivo
    for (const [filename, data] of Object.entries(dadosIniciais)) {
      const filepath = path.join(DB_DIR, filename);
      try {
        await fs.access(filepath);
        console.log(`✅ ${filename} já existe`);
      } catch {
        await fs.writeFile(filepath, JSON.stringify(data, null, 2));
        console.log(`📁 ${filename} criado com dados iniciais`);
      }
    }
    
    console.log("✅ Banco de dados inicializado!");
  } catch (err) {
    console.error("❌ Erro ao inicializar banco:", err);
  }
}

init();