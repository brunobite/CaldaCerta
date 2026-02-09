require('dotenv').config();
const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const path = require('path');
const cors = require('cors');
const XLSX = require('xlsx');
const app = express();

const DATA_DIR = path.join(__dirname, 'data');
const SIMULACOES_PATH = path.join(DATA_DIR, 'simulacoes.json');
const PRODUTOS_XLSX_PATH = path.resolve(__dirname, 'data', 'produtos.xlsx');
const WEATHER_CACHE_TTL_MS = Number(process.env.WEATHER_CACHE_TTL_MS) || 3 * 60 * 1000;
const weatherCache = new Map();
const GEOCODE_CACHE_TTL_MS = Number(process.env.GEOCODE_CACHE_TTL_MS) || 24 * 60 * 60 * 1000;
const geocodeCache = new Map();

const ALLOWED_ORIGINS = new Set([
  'https://caldacerta.onrender.com',
  'http://localhost:5500',
  'http://localhost:10000',
]);
const isDev = process.env.NODE_ENV !== 'production';

app.use((req, res, next) => {
  if (isDev) {
    const origin = req.headers.origin || 'sem-origin';
    console.log(`[request] ${req.method} ${req.path} origin=${origin}`);
  }
  next();
});

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (ALLOWED_ORIGINS.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origem não permitida pelo CORS.'));
  },
  methods: ['GET', 'OPTIONS', 'POST'],
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
app.options('/api/*', cors(corsOptions));

app.use(express.json({ limit: '2mb' }));

async function readJsonFile(filepath, fallback = []) {
  try {
    const content = await fs.promises.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonFile(filepath, data) {
  await fs.promises.mkdir(path.dirname(filepath), { recursive: true });
  await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2));
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

function buildWeatherCacheKey(lat, lon, hours, tz) {
  const latKey = Number(lat).toFixed(4);
  const lonKey = Number(lon).toFixed(4);
  return `${latKey}:${lonKey}:${hours}:${tz}`;
}

function computeDewPoint(temperature, humidity) {
  if (!Number.isFinite(temperature) || !Number.isFinite(humidity) || humidity <= 0) {
    return null;
  }
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100);
  const dewPoint = (b * alpha) / (a - alpha);
  return Number.isFinite(dewPoint) ? Number(dewPoint.toFixed(2)) : null;
}

function normalizeTexto(valor) {
  return (valor || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(valor) {
  return (valor || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFirstField(row, keys) {
  if (!row) return '';
  for (const key of keys) {
    if (row[key]) {
      return row[key];
    }
  }
  return '';
}

function getProdutosNome(row) {
  return getFirstField(row, [
    'nomeComercial',
    'nome_comercial',
    'Nome Comercial',
    'nome',
    'Nome',
    'produto',
    'Produto',
  ]);
}

function getProdutosEmpresa(row) {
  return getFirstField(row, [
    'empresa',
    'Empresa',
    'fabricante',
    'Fabricante',
    'marca',
    'Marca',
  ]);
}

function getProdutosFileInfo() {
  const filePath = PRODUTOS_XLSX_PATH;
  const exists = fs.existsSync(filePath);
  const stats = exists ? fs.statSync(filePath) : null;
  return { filePath, exists, stats };
}

function loadProdutosXlsx() {
  const { filePath, exists, stats } = getProdutosFileInfo();
  console.log(`[produtos] arquivo=${filePath} exists=${exists}`);
  if (!exists) {
    const error = new Error('Arquivo de produtos não encontrado.');
    error.code = 'ENOENT';
    error.filePath = filePath;
    throw error;
  }
  console.log(`[produtos] mtime=${stats.mtime.toISOString()} size=${stats.size}`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return { rows, filePath, stats };
}

function getCachedWeather(cacheKey) {
  const cached = weatherCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    weatherCache.delete(cacheKey);
    return null;
  }
  return cached.payload;
}

function setCachedWeather(cacheKey, payload) {
  weatherCache.set(cacheKey, {
    expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    payload,
  });
}

function buildGeocodeCacheKey(city, state, country) {
  return [city, state, country]
    .filter(Boolean)
    .map((part) => part.toLowerCase().trim())
    .join('|');
}

function getCachedGeocode(cacheKey) {
  const cached = geocodeCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    geocodeCache.delete(cacheKey);
    return null;
  }
  return cached.payload;
}

function setCachedGeocode(cacheKey, payload) {
  geocodeCache.set(cacheKey, {
    expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS,
    payload,
  });
}

function buildLocationName(location) {
  if (!location) return 'Localização desconhecida';
  return [location.name, location.state, location.country].filter(Boolean).join(', ');
}

function buildTimeSeriesItem({
  time,
  temperature,
  humidity,
  precipitation,
  windSpeed,
  dewPoint,
}) {
  const normalizedTemperature = Number.isFinite(temperature) ? Number(temperature) : null;
  const normalizedHumidity = Number.isFinite(humidity) ? Number(humidity) : null;
  const normalizedPrecipitation = Number.isFinite(precipitation) ? Number(precipitation) : null;
  const normalizedWind = Number.isFinite(windSpeed) ? Number(windSpeed) : null;
  let normalizedDewPoint = Number.isFinite(dewPoint) ? Number(dewPoint) : null;
  if (!Number.isFinite(normalizedDewPoint)) {
    normalizedDewPoint = computeDewPoint(normalizedTemperature, normalizedHumidity);
  }
  const deltaT = Number.isFinite(normalizedTemperature) && Number.isFinite(normalizedDewPoint)
    ? Number((normalizedTemperature - normalizedDewPoint).toFixed(2))
    : null;

  return {
    time: time || null,
    temperature: normalizedTemperature,
    humidity: normalizedHumidity,
    precipitation: normalizedPrecipitation,
    wind_speed: normalizedWind,
    dew_point: Number.isFinite(normalizedDewPoint) ? normalizedDewPoint : null,
    deltaT,
  };
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

app.get('/api/produtos/_debug', (req, res) => {
  try {
    const { rows, filePath, stats } = loadProdutosXlsx();
    const sampleFirstNames = rows
      .map((row) => getProdutosNome(row))
      .filter((name) => name)
      .slice(0, 5);
    res.json({
      filePath,
      exists: true,
      size: stats.size,
      mtime: stats.mtime,
      rowsLoaded: rows.length,
      sampleFirstNames,
    });
  } catch (error) {
    const filePath = error.filePath || PRODUTOS_XLSX_PATH;
    res.status(500).json({
      error: error.message || 'Erro ao carregar XLSX de produtos.',
      filePath,
    });
  }
});

app.get('/api/produtos', (req, res) => {
  const query = (req.query.query || '').toString().trim();
  if (!query) {
    res.json([]);
    return;
  }

  try {
    const { rows, filePath } = loadProdutosXlsx();
    const normalizedQuery = normalizeTexto(query);
    const filtered = rows
      .map((row) => {
        const nomeComercial = getProdutosNome(row);
        const empresa = getProdutosEmpresa(row);
        return {
          nomeComercial: nomeComercial || '',
          empresa: empresa || '',
          source: 'catalogo',
        };
      })
      .filter((row) => {
        const haystack = normalizeTexto(`${row.nomeComercial} ${row.empresa}`);
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 20);
    res.json(filtered);
  } catch (error) {
    const filePath = error.filePath || PRODUTOS_XLSX_PATH;
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({
      error: error.message || 'Erro ao carregar XLSX de produtos.',
      filePath,
    });
  }
});

app.post('/api/produtos/ph-lookup-log', (req, res) => {
  const { nome, key, total } = req.body || {};
  const computedKey = key || normalizeKey(nome);
  console.log(`[ph-lookup] nome=${nome || ''} key=${computedKey || ''} total=${total ?? 'n/a'}`);
  res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/weather', async (req, res) => {
  try {
    const {
      lat,
      lon,
      city,
      state,
      country = 'BR',
      hours = '24',
      tz = 'America/Sao_Paulo',
    } = req.query;

    const requestedHours = Number(hours);
    if (!Number.isFinite(requestedHours) || requestedHours <= 0 || requestedHours > 168) {
      res.status(400).json({ error: 'Parâmetro hours inválido (use 1-168).' });
      return;
    }

    let latitude = Number(lat);
    let longitude = Number(lon);
    let locationName = null;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      if (!city) {
        res.status(400).json({ error: 'Informe lat/lon ou city.' });
        return;
      }

      const cacheKey = buildGeocodeCacheKey(city, state, country);
      const cachedGeocode = getCachedGeocode(cacheKey);
      let location = cachedGeocode;
      if (!location) {
        const queryParts = [city, state, country].filter(Boolean);
        const params = new URLSearchParams({
          format: 'json',
          limit: '1',
          addressdetails: '1',
        });
        params.set('q', queryParts.join(', '));
        const geoUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
        const geoData = await fetchJson(geoUrl);
        location = Array.isArray(geoData) ? geoData[0] : null;
        if (location) {
          setCachedGeocode(cacheKey, location);
        }
      }

      if (!location) {
        res.status(404).json({ error: 'Cidade não encontrada.' });
        return;
      }

      latitude = Number(location.lat);
      longitude = Number(location.lon);
      locationName = location.display_name || buildLocationName({
        name: city,
        state,
        country,
      });
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.status(400).json({ error: 'Latitude e longitude inválidas.' });
      return;
    }

    const cacheKey = buildWeatherCacheKey(latitude, longitude, requestedHours, tz);
    const cached = getCachedWeather(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.searchParams.set('latitude', latitude);
    forecastUrl.searchParams.set('longitude', longitude);
    forecastUrl.searchParams.set(
      'hourly',
      'temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,dewpoint_2m'
    );
    forecastUrl.searchParams.set('forecast_hours', requestedHours);
    forecastUrl.searchParams.set('timezone', tz || 'America/Sao_Paulo');
    forecastUrl.searchParams.set('timeformat', 'iso8601');

    const meteoData = await fetchJson(forecastUrl.toString());
    const hourlyData = meteoData?.hourly || {};
    const timeSeries = Array.isArray(hourlyData.time) ? hourlyData.time : [];
    const temperatureSeries = Array.isArray(hourlyData.temperature_2m) ? hourlyData.temperature_2m : [];
    const humiditySeries = Array.isArray(hourlyData.relativehumidity_2m) ? hourlyData.relativehumidity_2m : [];
    const precipitationSeries = Array.isArray(hourlyData.precipitation) ? hourlyData.precipitation : [];
    const windSeries = Array.isArray(hourlyData.windspeed_10m) ? hourlyData.windspeed_10m : [];
    const dewPointSeries = Array.isArray(hourlyData.dewpoint_2m) ? hourlyData.dewpoint_2m : [];

    if (!timeSeries.length) {
      res.status(502).json({ error: 'Resposta inválida do Open-Meteo.' });
      return;
    }

    const hourly = Array.from({ length: requestedHours }, (_, index) => buildTimeSeriesItem({
      time: timeSeries[index],
      temperature: temperatureSeries[index],
      humidity: humiditySeries[index],
      precipitation: precipitationSeries[index],
      windSpeed: windSeries[index],
      dewPoint: dewPointSeries[index],
    }));

    const location = {
      name: locationName || meteoData?.timezone || `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`,
      lat: latitude,
      lon: longitude,
      timezone: meteoData?.timezone || tz || 'America/Sao_Paulo',
    };

    const payload = {
      source: 'open-meteo',
      location,
      hourly,
    };

    setCachedWeather(cacheKey, payload);
    res.json(payload);
  } catch (error) {
    console.error('Erro ao consultar Open-Meteo:', error);
    const status = error.statusCode || 502;
    const message = status === 400
      ? 'Parâmetros inválidos para consulta meteorológica.'
      : 'Falha ao consultar Open-Meteo.';
    res.status(status >= 400 && status < 600 ? status : 502).json({ error: message });
  }
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

app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS')) {
    res.status(403).json({ error: 'Origem não permitida.' });
    return;
  }
  if (isDev) {
    console.error('Erro interno:', err);
  }
  next(err);
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
