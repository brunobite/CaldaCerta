# Offline tests (Passo 2 — bootstrap robusto + sessão local)

## Pré-requisitos
- Rodar o app localmente (`npm run dev`).
- Abrir o app em um navegador com DevTools.
- Garantir que o Service Worker está ativo no escopo `/`.

## Checklist BUGFIX 14 — Offline Start robusto (Firebase + fallback local)

### A) Login online uma vez -> fechar app -> desligar rede -> abrir pelo ícone
1. Com rede ligada, abra o PWA e faça login com uma conta válida.
2. Feche completamente o app (aba/janela ou app instalado).
3. Desligue a rede (DevTools `Network > Offline` ou modo avião).
4. Reabra o app pelo ícone.
5. Validar:
   - O app abre direto na Home `Gestão de Caldas`.
   - A tela de login não é exibida.
   - Badge visível: `Offline (sessão local)`.
   - Não há erro crítico no Console.

### B) Dispositivo sem offlineSession -> abrir offline
1. Limpe dados do site (Storage/IndexedDB/Cache/Auth/localStorage) para simular primeiro acesso.
2. Com rede desligada, abra o app.
3. Validar:
   - A tela de login permanece visível.
   - Botão **Entrar** fica desabilitado.
   - Mensagem exibida: `Sem conexão. Entre uma vez online para habilitar o modo offline`.

### C) Voltar online -> estado normaliza sem relogar
1. Partindo do cenário A (Home aberta com sessão local), reative a internet.
2. Aguarde o `onAuthStateChanged` reconectar e reassumir a sessão Firebase.
3. Validar:
   - Badge `Offline (sessão local)` desaparece.
   - O app continua na Home sem exigir novo login.
   - Se o `uid` retornado pelo Firebase divergir da sessão local, o app força logout e pede login.

### D) Verificar disponibilidade offline do Firebase SDK
1. Abra DevTools > Application > Cache Storage.
2. Verifique no cache do SW (`calda-certa-v3`) entradas de `https://www.gstatic.com/firebasejs/...`.
3. Alternativamente, em Console, filtre requests para `firebasejs` e confirme respostas vindas de cache quando offline.

## Observações
- Login por e-mail/senha continua exigindo rede (comportamento esperado do Firebase Auth).
- O fallback local é confiável apenas no mesmo dispositivo e serve para continuidade operacional em campo.
