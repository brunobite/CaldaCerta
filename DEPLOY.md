# Deploy Manual - CaldaCerta

Este guia prepara o app para deploy manual em qualquer servidor Node.js.

## ✅ Requisitos

- Node.js 14+ (LTS recomendado)
- Acesso ao repositório

## 📦 Passo a passo

1. Clone o repositório no servidor:

```bash
git clone <URL_DO_REPOSITORIO>
cd CaldaCerta
```

2. Instale as dependências do backend:

```bash
cd server
npm install
```

3. Configure variáveis de ambiente:

No servidor/Render, configure:

```bash
OPENWEATHER_API_KEY=SEU_TOKEN_AQUI
# Opcional: cache em ms (padrão 180000 = 3 min)
WEATHER_CACHE_TTL_MS=180000
```

4. Configure a porta (opcional):

O servidor já usa a variável `PORT` com fallback para `10000`.

```bash
export PORT=10000
```

5. Inicie o servidor:

```bash
npm start
```

6. Acesse no navegador:

```
http://<SEU_HOST>:<PORT>
```

## 🧭 Observações

- O frontend está na pasta `web/` e é servido pelo Express.
- Se você usa um provedor (Render/Railway/VM), use o comando de start acima.
- As credenciais do Firebase continuam carregadas pelo frontend em `web/app.js`.
- No Render, adicione `OPENWEATHER_API_KEY` nas Environment Variables do serviço.
