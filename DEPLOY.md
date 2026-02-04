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

3. Configure a porta (opcional):

O servidor já usa a variável `PORT` com fallback para `10000`.

```bash
export PORT=10000
```

4. Inicie o servidor:

```bash
npm start
```

5. Acesse no navegador:

```
http://<SEU_HOST>:<PORT>
```

## 🧭 Observações

- O frontend está na pasta `web/` e é servido pelo Express.
- Se você usa um provedor (Render/Railway/VM), use o comando de start acima.
- As credenciais do Firebase continuam carregadas pelo frontend em `web/app.js`.
