# Offline tests (Passo 1 — base offline)

## Pré-requisitos
- Rodar o app localmente (`npm run dev`).
- Abrir o app em um navegador com DevTools.

## Passo a passo
1. Abra o app em modo online.
2. Entre no fluxo de simulação.
3. Preencha campos de identificação, equipamento, água e clima.
4. Adicione ao menos 1 produto na etapa de produtos.
5. Feche a aba do navegador.
6. Em DevTools, ative `Network > Offline`.
7. Reabra o app.
8. Valide:
   - O app abre sem tela branca.
   - Campos retornam preenchidos (draft carregado do IndexedDB).
   - Badge no header mostra `Offline (modo campo)`.
9. Desative o modo offline no DevTools.
10. Confirme que o badge muda para `Online`.
11. Abra o Console e confirme ausência de erros críticos.

## Observações
- Nesta etapa não há sync/outbox de dados para o servidor.
- O autosave é local (IndexedDB) e persiste entre sessões.
