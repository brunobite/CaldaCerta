# 📦 INSTALAÇÃO COMPLETA - CALDACERTA

## 🎯 Pré-requisitos

✅ **Node.js instalado** (versão 16 ou superior)
   - Download: https://nodejs.org/
   - Escolha: LTS (Long Term Support)
   
## 📂 Estrutura de Pastas

Certifique-se que sua estrutura está assim:

```
Calda-Certa/
├── 📄 INICIO-RAPIDO.txt
├── 📄 README.md
├── 📄 PLANILHA-PRODUTOS.md
├── 🚀 INICIAR.bat (Windows)
├── 📁 server/
│   ├── server.js
│   ├── package.json
│   ├── importar-produtos.js
│   └── produtos-exemplo.csv
├── 📁 web/
│   ├── index.html
│   └── api-config.js
└── 📁 database/
    └── (vazio - será criado automaticamente)
```

## 🚀 Instalação Passo a Passo

### ⚡ Método Rápido (Windows)

1. **Duplo clique** em `INICIAR.bat`
2. Aguarde instalação das dependências
3. Quando ver "Servidor rodando em: http://localhost:3000"
4. Abra navegador em: `http://localhost:3000`
5. ✅ Pronto!

### 🖥️ Método Manual (Windows/Mac/Linux)

#### Passo 1: Abrir Terminal
- **Windows**: Abra CMD ou PowerShell
- **Mac/Linux**: Abra Terminal

#### Passo 2: Navegar até a pasta
```bash
cd caminho/para/Calda-Certa/server
```

#### Passo 3: Instalar Dependências
```bash
npm install
```

Aguarde... pode demorar 2-5 minutos.

#### Passo 4: Iniciar Servidor
```bash
npm start
```

#### Passo 5: Acessar Sistema
Abra navegador: `http://localhost:3000`

## 📊 Importar Seus Produtos

### Opção 1: Via Script (Recomendado)

1. Prepare arquivo Excel `produtos.xlsx` com colunas:
   - nome, marca, formulacao, tipo, ph, ingrediente_ativo, concentracao

2. Coloque na pasta `server/`

3. Execute:
```bash
cd server
node importar-produtos.js
```

### Opção 2: Usar CSV de Exemplo

O arquivo `produtos-exemplo.csv` já está pronto!

Para importar (precisa converter para .xlsx primeiro):
1. Abra `produtos-exemplo.csv` no Excel
2. Salve como `produtos.xlsx`
3. Execute script acima

## ✅ Verificar se Funcionou

### 1. Console deve mostrar:
```
🚀 ================================
🌱 CALDACERTA - SERVIDOR ATIVO
🚀 ================================
📡 Servidor rodando em: http://localhost:3000
📂 Banco de dados: ../database/caldacerta.db

📋 Endpoints disponíveis:
   GET  /api/clientes
   GET  /api/produtos
   GET  /api/simulacoes
   POST /api/produtos/upload
```

### 2. Navegador deve abrir a tela:
```
┌────────────────────────────────┐
│      CALDACERTA                │
│  Gestão de Caldas              │
├────────────────────────────────┤
│  [ Nova Simulação ]            │
│  [ Histórico ]                 │
└────────────────────────────────┘
```

### 3. Console do navegador (F12):
```
✅ Conectado ao servidor CaldaCerta
📡 Carregando dados da API...
✅ X produtos carregados
✅ Bancos de dados carregados com sucesso!
```

## 🔧 Solução de Problemas

### ❌ "Porta 3000 já está em uso"

**Solução 1:** Feche outros programas que usam porta 3000

**Solução 2:** Mude a porta no `server.js`:
```javascript
const PORT = 3001; // linha 12
```

### ❌ "Cannot find module..."

**Solução:**
```bash
cd server
rm -rf node_modules
npm install
```

### ❌ "ENOENT: no such file or directory"

**Solução:** Crie a pasta manualmente:
```bash
mkdir database
```

### ❌ Página não carrega

**Verificar:**
1. Servidor está rodando? (veja console)
2. URL correta? `http://localhost:3000`
3. Porta correta? (veja no console do servidor)

### ❌ "Erro ao conectar com servidor"

**Verificar:**
1. `api-config.js` tem a URL correta?
2. Servidor está rodando?
3. Firewall bloqueando?

## 📱 Acessar de Outro Dispositivo

### Mesmo WiFi:

1. Descubra IP do computador:
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig`
   
2. Exemplo: `192.168.1.100`

3. No celular/tablet:
   - Acesse: `http://192.168.1.100:3000`

## 💾 Backup

### Fazer Backup:
1. Copie pasta `database/`
2. Salve em local seguro
3. Pronto!

### Restaurar Backup:
1. Cole `caldacerta.db` de volta em `database/`
2. Reinicie servidor
3. Pronto!

## 📞 Suporte

### Logs Úteis:
- **Servidor**: Veja console onde executou `npm start`
- **Frontend**: Pressione F12 no navegador → Console

### Arquivos Importantes:
- `database/caldacerta.db` - TODOS os seus dados
- `server/server.js` - Servidor backend
- `web/index.html` - Interface do sistema

---

## 🎉 Tudo Pronto!

Agora você tem:
✅ Sistema rodando localmente
✅ Banco de dados funcionando
✅ Produtos cadastrados
✅ Backup simples
✅ Acesso de qualquer dispositivo na rede

**Bom trabalho! 🚜🌾**
