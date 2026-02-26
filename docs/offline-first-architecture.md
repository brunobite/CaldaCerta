# Dossiê Técnico – Arquitetura Offline First (Calda Certa)

## 1) Visão geral
A aplicação foi estruturada para operar em **modo offline-first**:
- UI e shell carregam do cache do Service Worker.
- Sessão de autenticação é reidratada localmente.
- Dados críticos são persistidos em IndexedDB.
- Escritas offline entram em fila (`sync_queue`) e sincronizam automaticamente ao voltar conexão.

## 2) Estratégia do Service Worker
Arquivo: `web/sw.js`

### Cache de App Shell
`ASSETS_TO_CACHE` inclui:
- `index.html`, `app.js`, CSS, manifestos, ícones, páginas auxiliares (`offline.html`, `historico/lista.html`).

### Estratégia por tipo
- **Cache First** para:
  - App shell local
  - Firebase SDK CDN (`www.gstatic.com/firebasejs/...`)
  - CDNs estáticos (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `fonts.googleapis.com`, `fonts.gstatic.com`)
- **Network First** para APIs Firebase/Google (`firebaseio.com`, `googleapis.com`)
- **Navigate requests**: fallback para `APP_SHELL`.

## 3) Persistência de autenticação
Arquivos: `web/firebase-config.js`, `web/app.js`

- Firebase Auth usa `Auth.Persistence.LOCAL`.
- Sessão offline auxiliar em `localStorage` (`offlineSession`) para fallback de bootstrap.
- Quando offline no bootstrap, a aplicação restaura sessão local sem bloquear em chamadas remotas.

## 4) Estrutura IndexedDB adotada
Arquivo: `web/offline/db.js`

DB: `calda_certa` (v2)

Stores:
- `mix_drafts_local` – rascunhos de formulário.
- `simulations` – simulações/caldas persistidas localmente.
- `products` – produtos (usuário + catálogo) para consulta offline.
- `user_libraries` – bibliotecas/configs por usuário.
- `settings` – configurações locais.
- `sync_queue` – fila de sincronização offline.

### Estrutura de item da fila
```js
{
  id,
  type: 'create' | 'update' | 'delete',
  path: 'simulacoes/{uid}/{id}',
  payload,
  timestamp,
  synced: false,
  attempts,
  fingerprint
}
```

## 5) Fluxo de dados (simplificado)

### Leitura
1. Tenta Firebase (quando online).
2. Se falhar/vazio, consulta IndexedDB.
3. Se online e sucesso remoto, atualiza cache local.

### Escrita
1. Salva imediatamente no IndexedDB.
2. Se offline, adiciona operação na `sync_queue`.
3. Se online, escreve no Firebase e atualiza cache local.

### Sincronização
- `window.addEventListener('online', ...)` executa `syncPendingData()`.
- Cada item da fila tenta operação remota.
- Em sucesso: marca `synced=true`.
- Em erro: incrementa `attempts`, mantém para próxima tentativa.

## 6) Listener de conectividade
Arquivo: `web/app.js`

- `online`:
  - processa `sync_queue`
  - processa filas legadas (`OfflineSync` e `OutboxSync`)
- `offline`:
  - ativa handler de modo offline
- Indicador visual já existente no header (`connection-status-badge` + `sync-status-icon`).

## 7) Remoção de dependência exclusiva de stream em tempo real
- Leitura de histórico e produtos agora possui fallback IndexedDB.
- Busca de produtos (`productsService`) funciona offline com cache local.
- Visualização de simulação tenta IndexedDB quando indisponível remoto.

## 8) Fluxograma simplificado
```text
[Usuário abre app]
      |
      v
[Service Worker entrega shell]
      |
      v
[Auth local reidratada?]--não-->[Login online obrigatório inicial]
      |
     sim
      |
      v
[Operação de leitura/escrita]
      |
      +--> Leitura: Firebase -> IndexedDB fallback
      |
      +--> Escrita: IndexedDB imediato
                     |
                     +-- online -> Firebase
                     +-- offline -> sync_queue

[Evento online]
      |
      v
[syncPendingData processa fila]
      |
      +--> sucesso: marca synced
      +--> erro: mantém na fila
```
