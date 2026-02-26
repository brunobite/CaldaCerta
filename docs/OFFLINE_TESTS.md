# Offline tests (Passo 1 — base offline)

## Pré-requisitos
- Rodar o app localmente (`npm run dev`).
- Abrir o app em um navegador com DevTools.
- Garantir que o Service Worker está ativo no escopo `/`.

## Checklist BUGFIX 13 — sessão offline + Firebase SDK

### A) Login online uma vez -> fechar app -> desligar rede -> abrir pelo ícone
1. Com rede ligada, abra o PWA e faça login com uma conta válida.
2. Feche completamente o app (aba/janela ou app instalado).
3. Desligue a rede (DevTools `Network > Offline` ou modo avião).
4. Reabra o app pelo ícone.
5. Validar:
   - O app abre direto na Home `Gestão de Caldas`.
   - A tela de login não é exibida.
   - Não há erro crítico no Console.

### B) Primeiro acesso do dispositivo (sem sessão) -> abrir offline
1. Limpe dados do site (Storage/IndexedDB/Cache/Auth) para simular primeiro acesso.
2. Com rede desligada, abra o app.
3. Validar:
   - A tela de login permanece visível.
   - Botão **Entrar** fica desabilitado.
   - Mensagem exibida: `Sem conexão. Entre uma vez online para habilitar o modo offline`.

### C) Verificar disponibilidade offline do Firebase SDK
1. Abra DevTools > Application > Cache Storage.
2. Verifique no cache do SW (`calda-certa-v3`) entradas de `https://www.gstatic.com/firebasejs/...`.
3. Alternativamente, em Console, filtre requests para `firebasejs` e confirme respostas vindas de cache quando offline.

## Observações
- Nesta etapa não há sync/outbox de dados para o servidor.
- O autosave é local (IndexedDB) e persiste entre sessões.
