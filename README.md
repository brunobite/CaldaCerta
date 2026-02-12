# 🌱 CALDACERTA - Sistema de Gestão de Caldas Agrícolas

Sistema completo para gerenciamento de simulações de caldas fitossanitárias com banco de dados.

## 📁 Estrutura do Projeto

```
Calda-Certa/
├── server/              # Backend Node.js
│   ├── server.js       # Servidor Express
│   └── package.json    # Dependências
├── web/                # Frontend (HTML/CSS/JS)
│   └── index.html      # Aplicação principal
└── database/           # Banco de dados SQLite
    └── caldacerta.db   # Será criado automaticamente
```

## 🚀 Instalação

### 1. Instalar Node.js
Baixe e instale o Node.js: https://nodejs.org/ (versão LTS recomendada)

### 2. Instalar Dependências
Abra o terminal/CMD na pasta `server` e execute:

```bash
cd server
npm install
```

### 3. Configurar OpenWeatherMap

O backend usa a API do OpenWeatherMap via proxy para evitar expor a chave no frontend. Crie um arquivo `server/.env` com:

```bash
OPENWEATHER_API_KEY=SEU_TOKEN_AQUI
# Opcional: cache em ms (padrão 180000 = 3 min)
WEATHER_CACHE_TTL_MS=180000
```

## ☁️ Deploy Manual

Para publicar o app em um servidor remoto, siga o guia em `DEPLOY.md`.

## ▶️ Como Usar

### Iniciar o Servidor

```bash
cd server
npm start
```

Ou para desenvolvimento (reinicia automaticamente):

```bash
npm run dev
```

### Acessar o Sistema

Abra seu navegador e acesse:
```
http://localhost:3000
```

## 📊 Importar Planilha de Produtos

### Formato da Planilha Excel (.xlsx)

A planilha deve conter as seguintes colunas:

| nome | marca | formulacao | tipo | ph | ingrediente_ativo | concentracao |
|------|-------|------------|------|----|--------------------|--------------|
| Glifosato 480 | Roundup | SC | PRODUTO | 4.5 | Glifosato | 480 g/L |
| Atrazina | Gesaprim 500 | SC | PRODUTO | 9.5 | Atrazina | 500 g/L |

### Importar via API

Use o endpoint para upload:

```
POST http://localhost:3000/api/produtos/upload
Content-Type: multipart/form-data
Field: file (arquivo .xlsx)
```

Ou use o Postman/Insomnia para fazer o upload.

### Script de Importação (Opcional)

Crie um arquivo `importar-produtos.js` na pasta `server`:

```javascript
const XLSX = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../database/caldacerta.db'));
const workbook = XLSX.readFile('produtos.xlsx'); // Coloque seu arquivo aqui
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const produtos = XLSX.utils.sheet_to_json(sheet);

const stmt = db.prepare(`
  INSERT INTO produtos (nome, marca, formulacao, tipo, ph, ingrediente_ativo, concentracao)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

produtos.forEach(p => {
  stmt.run(p.nome, p.marca, p.formulacao, p.tipo, p.ph, p.ingrediente_ativo, p.concentracao);
});

stmt.finalize();
db.close();
console.log(`✅ ${produtos.length} produtos importados!`);
```

Execute:
```bash
node importar-produtos.js
```

## 🗄️ Estrutura do Banco de Dados

### Tabelas

- **clientes**: Nome dos clientes
- **propriedades**: Propriedades vinculadas a clientes
- **talhoes**: Talhões vinculados a propriedades
- **responsaveis**: Responsáveis técnicos
- **operadores**: Operadores de máquinas
- **produtos**: Banco de dados de produtos fitossanitários
- **simulacoes**: Simulações/aplicações realizadas
- **simulacao_produtos**: Produtos usados em cada simulação

## 📡 API Endpoints

### Clientes
- `GET /api/clientes` - Listar todos
- `POST /api/clientes` - Criar novo

### Produtos
- `GET /api/produtos` - Listar todos
- `POST /api/produtos` - Criar novo
- `POST /api/produtos/upload` - Upload em massa (Excel)

### Simulações
- `GET /api/simulacoes` - Listar todas
- `GET /api/simulacoes/:id` - Buscar uma
- `POST /api/simulacoes` - Criar nova
- `DELETE /api/simulacoes/:id` - Deletar

### Estatísticas
- `GET /api/stats` - Estatísticas gerais

## 🔧 Manutenção

### Backup do Banco de Dados
Copie o arquivo `database/caldacerta.db` regularmente.

### Resetar Banco
Delete o arquivo `caldacerta.db` e reinicie o servidor (será criado vazio).

## 💡 Funcionalidades

✅ Cadastro de clientes, propriedades e talhões
✅ Banco de dados de produtos
✅ Upload de planilha Excel com produtos
✅ Autocomplete inteligente
✅ Hierarquia de mistura configurável
✅ Ordem de produtos por pH
✅ Geração de PDF profissional
✅ Histórico completo de simulações
✅ Busca e filtros
✅ Dados salvos permanentemente

## 🐛 Problemas Comuns

**Porta 3000 já em uso?**
```bash
# Mude a porta no server.js:
const PORT = 3001; // ou outra porta
```

**Banco de dados travado?**
```bash
# Feche todas as conexões e reinicie o servidor
```

## 📞 Suporte

Para dúvidas, entre em contato ou consulte a documentação do Node.js e SQLite.

---

**Versão:** 1.0.0  
**Desenvolvido para gestão profissional de caldas agrícolas** 🌾

## 🔎 Busca abrangente de produtos (RTDB com índice por tokens)

A busca typeahead agora usa índice em Realtime Database, sem depender de `limitToLast(50)` para o universo pesquisável.

### Estrutura de índice

- Catálogo global: `/produtos_catalogo_busca/{token}/{produtoId}: true`
- Produtos de usuário: `/produtos_usuarios_busca/{uid}/{token}/{produtoId}: true`

A tokenização normaliza texto (lowercase, sem acentos) e gera prefixos (mínimo 2 caracteres).

### 1) Gerar `nome_key` (backfill)

> **Não versionar o arquivo de chave**. Use um arquivo local fora do Git.

```bash
npm run rtdb:backfill-nome-key -- --serviceAccount /caminho/seguro/serviceAccountKey.json --databaseURL https://caldacerta-pro-default-rtdb.firebaseio.com --mode all --batch 250
```

Dry-run:

```bash
npm run rtdb:backfill-nome-key -- --serviceAccount /caminho/seguro/serviceAccountKey.json --databaseURL https://caldacerta-pro-default-rtdb.firebaseio.com --mode all --dry-run
```

### 2) Construir/atualizar índice de tokens

```bash
npm run rtdb:build-index -- --serviceAccount /caminho/seguro/serviceAccountKey.json --databaseURL https://caldacerta-pro-default-rtdb.firebaseio.com --mode all --batch 250
```

Dry-run:

```bash
npm run rtdb:build-index -- --serviceAccount /caminho/seguro/serviceAccountKey.json --databaseURL https://caldacerta-pro-default-rtdb.firebaseio.com --mode all --dry-run
```

### 3) Testar localmente

1. Inicie o app.
2. Abra o campo de busca de produtos.
3. Digite `Abamectin` (ou `abam`).
4. Se existir no RTDB indexado, o produto deve aparecer no dropdown.

### Regras do RTDB (documentação)

- Para leitura direta por path (`/produtos_catalogo_busca/{token}` e `/produtos_usuarios_busca/{uid}/{token}`), geralmente não é necessário `.indexOn`.
- Mantenha `.indexOn` nas coleções de produtos para campos já usados por queries ordenadas, como `nome_key` e `createdAt`.
