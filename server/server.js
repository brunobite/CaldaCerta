const express = require('express');
const fs = require('fs').promises;
const http = require('http');
const https = require('https');
const zlib = require('zlib');
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

function fetchJson(url, options = {}) {
  const maxRedirects = options.maxRedirects ?? 3;
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const transport = requestUrl.protocol === 'http:' ? http : https;
    const requestOptions = {
      headers: {
        'User-Agent': 'CaldaCerta/1.0 (+https://caldacerta.onrender.com)',
        Accept: 'application/json,text/plain,*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        ...options.headers,
      },
      timeout: options.timeoutMs ?? 10000,
    };

    const req = transport.get(requestUrl, requestOptions, (res) => {
      let data = '';
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) {
          const error = new Error(`HTTP ${res.statusCode}`);
          error.statusCode = res.statusCode;
          error.body = data;
          reject(error);
          return;
        }
        const redirectUrl = new URL(res.headers.location, requestUrl).toString();
        resolve(fetchJson(redirectUrl, { ...options, maxRedirects: maxRedirects - 1 }));
        return;
      }
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      stream.on('data', (chunk) => {
        data += chunk;
      });
      stream.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(`HTTP ${res.statusCode}`);
          error.statusCode = res.statusCode;
          error.body = data;
          reject(error);
          return;
        }
        if (!data) {
          resolve([]);
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          error.body = data;
          reject(error);
        }
      });
      stream.on('error', reject);
    });

    req.on('timeout', () => {
      req.destroy(new Error('Timeout ao consultar serviço externo.'));
    });
    req.on('error', reject);
  });
}

async function fetchInmetJson(path) {
  const endpoints = [
    `https://apitempo.inmet.gov.br${path}`,
    `http://apitempo.inmet.gov.br${path}`,
  ];
  let lastError;
  for (const url of endpoints) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function buildInmetTimestamp(dateStr, hourStr) {
  const hour = String(hourStr || '0000').padStart(4, '0');
  const formattedHour = `${hour.slice(0, 2)}:${hour.slice(2, 4)}`;
  return `${dateStr}T${formattedHour}:00`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateISO(date) {
  return date.toISOString().split('T')[0];
}

// 🔧 CONFIGURAÇÃO PARA SERVIR O FRONTEND DA PASTA 'web/'

// 1. Servir arquivos estáticos da pasta 'web'
app.use(express.static(path.join(__dirname, '../web')));

// 2. Servir também arquivos da pasta atual (server) se necessário
app.use(express.static(__dirname));

// 🔧 API endpoints
app.get('/api/status', (req, res) => {
  res.json({ status: 'OK', message: 'CaldaCerta Pro Online' });
});

app.get('/api/inmet', async (req, res) => {
  try {
    const { lat, lon, start_date, end_date } = req.query;
    if (!lat || !lon || !start_date || !end_date) {
      res.status(400).json({ error: 'Parâmetros lat, lon, start_date, end_date são obrigatórios.' });
      return;
    }

    const stations = await fetchInmetJson(`/estacao/proximas/${lat}/${lon}`);
    const station = Array.isArray(stations) ? stations[0] : null;
    const stationCode = station?.CD_ESTACAO || station?.cd_estacao;
    if (!stationCode) {
      res.status(404).json({ error: 'Nenhuma estação INMET encontrada.' });
      return;
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const days = [];
    for (let day = new Date(startDate); day <= endDate; day = addDays(day, 1)) {
      days.push(formatDateISO(day));
    }

    const responses = await Promise.all(
      days.map((day) => fetchInmetJson(`/estacao/dados/${day}/${stationCode}`))
    );
    const records = responses.flat().filter(Boolean);
    const sorted = records.sort((a, b) => {
      const aTime = buildInmetTimestamp(a.DT_MEDICAO || a.dt_medicao, a.HR_MEDICAO || a.hr_medicao);
      const bTime = buildInmetTimestamp(b.DT_MEDICAO || b.dt_medicao, b.HR_MEDICAO || b.hr_medicao);
      return new Date(aTime) - new Date(bTime);
    });

    const time = [];
    const temperature = [];
    const humidity = [];
    const windspeed = [];
    const precipitation = [];

    sorted.forEach((item) => {
      const dateStr = item.DT_MEDICAO || item.dt_medicao;
      const hourStr = item.HR_MEDICAO || item.hr_medicao;
      if (!dateStr || !hourStr) return;

      time.push(buildInmetTimestamp(dateStr, hourStr));
      temperature.push(Number(item.TEM_INS || item.tem_ins || item.TEMPERATURA || item.temperatura || 0));
      humidity.push(Number(item.UMD_INS || item.umd_ins || item.UMIDADE || item.umidade || 0));

      const windValue = Number(item.VEN_VEL || item.ven_vel || item.VENTO || item.vento || 0);
      windspeed.push(Number.isFinite(windValue) ? windValue * 3.6 : 0);
      const rainValue = Number(
        item.CHUVA ||
        item.chuva ||
        item.PREC ||
        item.prec ||
        item.PRECIPITACAO ||
        item.precipitacao ||
        0
      );
      precipitation.push(Number.isFinite(rainValue) ? rainValue : 0);
    });

    res.json({
      source: 'inmet',
      station: stationCode,
      hourly: {
        time,
        temperature_2m: temperature,
        relativehumidity_2m: humidity,
        windspeed_10m: windspeed,
        precipitation,
      },
    });
  } catch (error) {
    console.error('Erro ao consultar INMET:', error);
    res.status(502).json({ error: 'Falha ao consultar INMET.' });
  }
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
