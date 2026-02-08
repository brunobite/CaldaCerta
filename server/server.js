require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const path = require('path');
const app = express();

const DATA_DIR = path.join(__dirname, 'data');
const SIMULACOES_PATH = path.join(DATA_DIR, 'simulacoes.json');
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || process.env.CaldaCerta_clima;
const WEATHER_CACHE_TTL_MS = Number(process.env.WEATHER_CACHE_TTL_MS) || 3 * 60 * 1000;
const weatherCache = new Map();

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

function buildWeatherCacheKey(lat, lon, units, lang) {
  const latKey = Number(lat).toFixed(4);
  const lonKey = Number(lon).toFixed(4);
  return `${latKey}:${lonKey}:${units}:${lang}`;
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

function buildLocationName(location) {
  if (!location) return 'Localização desconhecida';
  return [location.name, location.state, location.country].filter(Boolean).join(', ');
}

function normalizeOpenWeatherDaily(days = []) {
  return days.map((day) => ({
    dt: day.dt,
    temp_min: day.temp?.min ?? day.temp_min,
    temp_max: day.temp?.max ?? day.temp_max,
    description: day.weather?.[0]?.description || '',
    icon: day.weather?.[0]?.icon || '',
    pop: day.pop ?? 0,
  }));
}

function buildHourlySeriesFromOneCall(data) {
  const timezoneOffset = data.timezone_offset || 0;
  const hourly = data.hourly || [];
  if (!hourly.length) return null;
  return {
    time: hourly.map((item) => new Date((item.dt + timezoneOffset) * 1000).toISOString()),
    temperature_2m: hourly.map((item) => item.temp),
    relativehumidity_2m: hourly.map((item) => item.humidity),
    windspeed_10m: hourly.map((item) => (Number.isFinite(item.wind_speed) ? item.wind_speed * 3.6 : 0)),
    precipitation: hourly.map((item) => item.rain?.['1h'] ?? item.snow?.['1h'] ?? 0),
  };
}

function buildHourlyListFromSeries(series) {
  if (!series?.time?.length) return [];
  return series.time.map((time, idx) => {
    const temp = Number(series.temperature_2m?.[idx] ?? 0);
    const humidity = Number(series.relativehumidity_2m?.[idx] ?? 0);
    return {
      dt: Math.floor(new Date(time).getTime() / 1000),
      temp,
      humidity,
      wind_speed: Number(series.windspeed_10m?.[idx] ?? 0),
      precipitation: Number(series.precipitation?.[idx] ?? 0),
      dew_point: computeDewPoint(temp, humidity),
    };
  });
}

function buildHourlySeriesFromForecast(list = [], timezoneOffset = 0) {
  if (!list.length) return null;
  return {
    time: list.map((item) => new Date((item.dt + timezoneOffset) * 1000).toISOString()),
    temperature_2m: list.map((item) => item.main?.temp ?? 0),
    relativehumidity_2m: list.map((item) => item.main?.humidity ?? 0),
    windspeed_10m: list.map((item) => (Number.isFinite(item.wind?.speed) ? item.wind.speed * 3.6 : 0)),
    precipitation: list.map((item) => item.rain?.['3h'] ?? item.snow?.['3h'] ?? 0),
  };
}

function buildDailyFromForecast(list = [], timezoneOffset = 0) {
  const grouped = new Map();
  list.forEach((item) => {
    const localDate = new Date((item.dt + timezoneOffset) * 1000).toISOString().split('T')[0];
    if (!grouped.has(localDate)) {
      grouped.set(localDate, []);
    }
    grouped.get(localDate).push(item);
  });

  return Array.from(grouped.entries()).map(([dateStr, items]) => {
    let tempMin = Number.POSITIVE_INFINITY;
    let tempMax = Number.NEGATIVE_INFINITY;
    let pop = 0;
    let bestItem = items[0];
    let bestScore = Infinity;

    items.forEach((item) => {
      const min = item.main?.temp_min ?? item.main?.temp ?? 0;
      const max = item.main?.temp_max ?? item.main?.temp ?? 0;
      tempMin = Math.min(tempMin, min);
      tempMax = Math.max(tempMax, max);
      pop = Math.max(pop, item.pop ?? 0);

      const localHour = new Date((item.dt + timezoneOffset) * 1000).getUTCHours();
      const score = Math.abs(localHour - 12);
      if (score < bestScore) {
        bestScore = score;
        bestItem = item;
      }
    });

    return {
      dt: bestItem?.dt || Math.floor(new Date(`${dateStr}T12:00:00Z`).getTime() / 1000) - timezoneOffset,
      temp_min: tempMin,
      temp_max: tempMax,
      description: bestItem.weather?.[0]?.description || '',
      icon: bestItem.weather?.[0]?.icon || '',
      pop,
    };
  });
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

app.get('/api/weather', async (req, res) => {
  try {
    const {
      lat,
      lon,
      city,
      state,
      country = 'BR',
      units = 'metric',
      lang = 'pt_br',
    } = req.query;

    if (!OPENWEATHER_API_KEY) {
      res.status(500).json({ error: 'OPENWEATHER_API_KEY não configurada no servidor.' });
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

      const hasComma = city.includes(',');
      const locationQuery = hasComma
        ? city
        : [city, state, country].filter(Boolean).join(', ');
      const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationQuery)}&limit=1&appid=${OPENWEATHER_API_KEY}`;
      const geoData = await fetchJson(geoUrl);
      const location = Array.isArray(geoData) ? geoData[0] : null;

      if (!location) {
        res.status(404).json({ error: 'Cidade não encontrada.' });
        return;
      }

      latitude = Number(location.lat);
      longitude = Number(location.lon);
      locationName = buildLocationName(location);
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.status(400).json({ error: 'Latitude e longitude inválidas.' });
      return;
    }

    const cacheKey = buildWeatherCacheKey(latitude, longitude, units, lang);
    const cached = getCachedWeather(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const location = {
      name: locationName || `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`,
      lat: latitude,
      lon: longitude,
    };

    let payload;

    try {
      const oneCallUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&units=${units}&lang=${lang}&exclude=minutely,alerts&appid=${OPENWEATHER_API_KEY}`;
      const oneCallData = await fetchJson(oneCallUrl);
      if (!locationName && oneCallData?.timezone) {
        location.name = oneCallData.timezone;
      }

      const hourlySeries = buildHourlySeriesFromOneCall(oneCallData);
      payload = {
        source: 'openweathermap',
        location,
        current: {
          temp: oneCallData.current?.temp,
          feels_like: oneCallData.current?.feels_like,
          humidity: oneCallData.current?.humidity,
          wind_speed: Number.isFinite(oneCallData.current?.wind_speed)
            ? oneCallData.current.wind_speed * 3.6
            : 0,
          description: oneCallData.current?.weather?.[0]?.description || '',
          icon: oneCallData.current?.weather?.[0]?.icon || '',
        },
        daily: normalizeOpenWeatherDaily(oneCallData.daily || []),
        hourly: buildHourlyListFromSeries(hourlySeries),
        hourly_series: hourlySeries,
      };
    } catch (oneCallError) {
      console.log(`OneCall 3.0 indisponível (${oneCallError.statusCode || oneCallError.message}), usando fallback 2.5`);

      const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=${units}&lang=${lang}&appid=${OPENWEATHER_API_KEY}`;
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=${units}&lang=${lang}&appid=${OPENWEATHER_API_KEY}`;
      const [currentData, forecastData] = await Promise.all([
        fetchJson(currentUrl),
        fetchJson(forecastUrl),
      ]);

      if (!locationName) {
        location.name = currentData?.name || forecastData?.city?.name || location.name;
      }

      const timezoneOffset = forecastData?.city?.timezone || 0;
      const hourlySeries = buildHourlySeriesFromForecast(forecastData.list || [], timezoneOffset);
      payload = {
        source: 'openweathermap',
        location,
        current: {
          temp: currentData.main?.temp,
          feels_like: currentData.main?.feels_like,
          humidity: currentData.main?.humidity,
          wind_speed: Number.isFinite(currentData.wind?.speed)
            ? currentData.wind.speed * 3.6
            : 0,
          description: currentData.weather?.[0]?.description || '',
          icon: currentData.weather?.[0]?.icon || '',
        },
        daily: buildDailyFromForecast(forecastData.list || [], timezoneOffset),
        hourly: buildHourlyListFromSeries(hourlySeries),
        hourly_series: hourlySeries,
      };
    }

    setCachedWeather(cacheKey, payload);
    res.json(payload);
  } catch (error) {
    console.error('Erro ao consultar OpenWeatherMap:', error);
    const status = error.statusCode || 502;
    const message = status === 429
      ? 'Limite de requisições do OpenWeatherMap atingido. Tente novamente em instantes.'
      : 'Falha ao consultar OpenWeatherMap.';
    res.status(status).json({ error: message });
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
