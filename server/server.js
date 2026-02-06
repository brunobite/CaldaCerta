const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();

const DATA_DIR = path.join(__dirname, 'data');
const SIMULACOES_PATH = path.join(DATA_DIR, 'simulacoes.json');

app.use(express.json({ limit: '2mb' }));

async function readJsonFile(filepath, fallback = []) {
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonFile(filepath, data) {
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 🔧 CONFIGURAÇÃO PARA SERVIR O FRONTEND DA PASTA 'web/'

// 1. Servir arquivos estáticos da pasta 'web'
app.use(express.static(path.join(__dirname, '../web')));

// 2. Servir também arquivos da pasta atual (server) se necessário
app.use(express.static(__dirname));

// 3. Para todas as outras rotas, servir index.html (Single Page App)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/index.html'));
});

// 🔧 API endpoints (se houver)
app.get('/api/status', (req, res) => {
  res.json({ status: 'OK', message: 'CaldaCerta Pro Online' });
});

app.get('/api/simulacoes', async (req, res) => {
  try {
    const { uid } = req.query;
    const simulacoes = await readJsonFile(SIMULACOES_PATH, []);
    const filtered = uid ? simulacoes.filter(item => item.uid === uid) : simulacoes;
    res.json(filtered);
  } catch (error) {
    console.error('Erro ao carregar simulações:', error);
    res.status(500).json({ error: 'Erro ao carregar simulações' });
  }
});

app.get('/api/simulacoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.query;
    const simulacoes = await readJsonFile(SIMULACOES_PATH, []);
    const item = simulacoes.find(sim => sim.id === id && (!uid || sim.uid === uid));
    if (!item) {
      res.status(404).json({ error: 'Simulação não encontrada' });
      return;
    }
    res.json(item);
  } catch (error) {
    console.error('Erro ao carregar simulação:', error);
    res.status(500).json({ error: 'Erro ao carregar simulação' });
  }
});

app.post('/api/simulacoes', async (req, res) => {
  try {
    const payload = req.body || {};
    const simulacoes = await readJsonFile(SIMULACOES_PATH, []);
    const now = new Date().toISOString();
    const novoRegistro = {
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      ...payload
    };
    simulacoes.push(novoRegistro);
    await writeJsonFile(SIMULACOES_PATH, simulacoes);
    res.json(novoRegistro);
  } catch (error) {
    console.error('Erro ao salvar simulação:', error);
    res.status(500).json({ error: 'Erro ao salvar simulação' });
  }
});

app.put('/api/simulacoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const simulacoes = await readJsonFile(SIMULACOES_PATH, []);
    const index = simulacoes.findIndex(sim => sim.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Simulação não encontrada' });
      return;
    }
    const updatedAt = new Date().toISOString();
    simulacoes[index] = {
      ...simulacoes[index],
      ...payload,
      id,
      updatedAt
    };
    await writeJsonFile(SIMULACOES_PATH, simulacoes);
    res.json(simulacoes[index]);
  } catch (error) {
    console.error('Erro ao atualizar simulação:', error);
    res.status(500).json({ error: 'Erro ao atualizar simulação' });
  }
});

// 🔧 Configurar porta
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor CaldaCerta rodando na porta ${PORT}`);
  console.log(`📁 Servindo frontend de: ${path.join(__dirname, '../web')}`);
});
