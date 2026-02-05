const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const app = express();

// 🔧 CONFIGURAÇÃO PARA SERVIR O FRONTEND DA PASTA 'web/'

app.use(express.json({ limit: '2mb' }));

// 1. Servir arquivos estáticos da pasta 'web'
app.use(express.static(path.join(__dirname, '../web')));

// 2. Servir também arquivos da pasta atual (server) se necessário
app.use(express.static(__dirname));

const historyCachePath = path.join(__dirname, 'history-cache.json');

async function readHistoryCache() {
  try {
    const raw = await fs.readFile(historyCachePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.data) ? parsed : { data: [] };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { data: [] };
    }
    throw error;
  }
}

async function writeHistoryCache(data) {
  const payload = {
    updatedAt: new Date().toISOString(),
    data,
  };
  await fs.writeFile(historyCachePath, JSON.stringify(payload, null, 2));
}

// 🔧 API endpoints (se houver)
app.get('/api/status', (req, res) => {
  res.json({ status: 'OK', message: 'CaldaCerta Pro Online' });
});

app.get('/api/history-cache', async (req, res) => {
  try {
    const cache = await readHistoryCache();
    res.json(cache);
  } catch (error) {
    console.error('Erro ao ler cache do histórico:', error);
    res.status(500).json({ error: 'Erro ao ler cache do histórico' });
  }
});

app.post('/api/history-cache', async (req, res) => {
  try {
    const data = Array.isArray(req.body?.data) ? req.body.data : [];
    await writeHistoryCache(data);
    res.json({ ok: true, count: data.length });
  } catch (error) {
    console.error('Erro ao salvar cache do histórico:', error);
    res.status(500).json({ error: 'Erro ao salvar cache do histórico' });
  }
});

// 3. Para todas as outras rotas, servir index.html (Single Page App)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/index.html'));
});

// 🔧 Configurar porta
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor CaldaCerta rodando na porta ${PORT}`);
  console.log(`📁 Servindo frontend de: ${path.join(__dirname, '../web')}`);
});
