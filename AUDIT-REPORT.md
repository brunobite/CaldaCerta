# RELATÓRIO DE AUDITORIA - CaldaCerta Pro

**Data:** 2026-02-12
**Escopo:** Análise completa de todos os arquivos do repositório
**Tecnologia:** Node.js + Express (backend), Vanilla JS + Firebase v8 (frontend), PWA

---

## 1. ERROS DE CODIGO

### 1.1 Chave de API Firebase real exposta no codigo-fonte

- **Arquivo**: `web/app.js`
- **Linha(s)**: 12-20
- **Severidade**: :red_circle: Critico
- **Descricao**: A apiKey real do Firebase (`AIzaSyCWLwnpqAVyreJmj6Nsto7vox-B3SuOlFY`) esta hardcoded no inicio do `app.js`. Embora Firebase client-side SDKs esperem chaves publicas, a apiKey junto com todos os outros parametros de configuracao (projectId, appId, messagingSenderId) estao expostos diretamente, e o arquivo `firebase-config.js` separado contem chaves placeholder diferentes (`AIzaSyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`), criando inconsistencia.
- **Correcao sugerida**: Usar um unico ponto de configuracao. Se `firebase-config.js` existe, ele deveria conter as chaves reais e `app.js` deveria referencia-lo. Remover a duplicacao de inicializacao do Firebase.

### 1.2 Dupla inicializacao do Firebase

- **Arquivo**: `web/app.js` (linhas 22-29) e `web/firebase-config.js` (linhas 12-21)
- **Linha(s)**: app.js:22-29, firebase-config.js:12-21
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: O Firebase e inicializado duas vezes: uma em `app.js` (com credenciais reais) e outra em `firebase-config.js` (com credenciais placeholder). A verificacao `!firebase.apps.length` previne erro, mas a config em `firebase-config.js` nunca e efetivamente usada pois `app.js` e carregado depois e ja encontra o Firebase inicializado.
- **Correcao sugerida**: Remover a inicializacao redundante de `app.js` e colocar as credenciais reais em `firebase-config.js`, que e carregado via `<script>` no HTML antes do `app.js`.

### 1.3 Variavel `db` referenciada antes de ser declarada (hoisting)

- **Arquivo**: `web/app.js`
- **Linha(s)**: 850 (uso) vs 3190 (declaracao)
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: A variavel `db` (alias para `window.database`) e usada nas funcoes `loadHistoryFromFirebase()` (linha 850) e `_savePayloadToFirebase()` (linha 1109) muito antes de ser declarada na linha 3190. Funciona por causa de hoisting de `const` dentro do IIFE, mas o acesso so e seguro se a funcao e chamada apos a declaracao (o que ocorre via `onAuthStateChanged`). No entanto, isso torna o codigo fragil e dificil de manter.
- **Correcao sugerida**: Mover a declaracao de `db` e `auth` para o topo do IIFE, logo apos as primeiras variaves globais.

### 1.4 Funcao `preencherDatalist` pode lancer TypeError se elemento nao existir

- **Arquivo**: `web/app.js`
- **Linha(s)**: 214-217
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: A funcao acessa `datalist.innerHTML` sem verificar se `datalist` e `null`. Se o elemento DOM nao existir (id errado, DOM nao carregado), ocorre `TypeError: Cannot set properties of null`.
- **Correcao sugerida**: Adicionar `if (!datalist) return;` antes de acessar `innerHTML`.

### 1.5 `app.js` usa IIFE implicitamente sem declaracao explicita

- **Arquivo**: `web/app.js`
- **Linha(s)**: 3375
- **Severidade**: :green_circle: Baixo
- **Descricao**: O arquivo termina com `})();` indicando um IIFE, mas a abertura `(function() {` nao esta presente no inicio do arquivo. Todo o codigo comeca sem encapsulamento ate que o IIFE implicitamente engloba tudo. Na verdade, analisando o codigo, o IIFE parece nao estar propriamente aberto - o `})();` na linha 3375 tenta fechar algo que nao tem abertura correspondente no topo.
- **Correcao sugerida**: Verificar e garantir que o IIFE esta corretamente aberto e fechado.

### 1.6 `productsService.js` importado mas `productsService.js` nao esta no cache do SW

- **Arquivo**: `web/sw.js`
- **Linha(s)**: 5-16
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: O Service Worker define `LOCAL_ASSETS` para cache mas NAO inclui `productsService.js`. Isso significa que em modo offline, a busca de produtos nao funcionara pois o arquivo JS nao estara no cache.
- **Correcao sugerida**: Adicionar `/productsService.js` ao array `LOCAL_ASSETS` no Service Worker.

### 1.7 Arquivo artefato `-F` no servidor

- **Arquivo**: `server/-F`
- **Linha(s)**: N/A
- **Severidade**: :green_circle: Baixo
- **Descricao**: Existe um arquivo chamado `-F` na pasta `server/`. Isso provavelmente e um artefato de um comando curl mal executado (`curl -F` sem argumento correto). Nao causa erro mas polui o repositorio.
- **Correcao sugerida**: Remover o arquivo `server/-F`.

### 1.8 Arquivo `app-backup.js` no repositorio

- **Arquivo**: `web/app-backup.js`
- **Linha(s)**: N/A
- **Severidade**: :green_circle: Baixo
- **Descricao**: Arquivo de backup (389 linhas) mantido no repositorio. Codigos de backup devem ser gerenciados via Git, nao como arquivos separados.
- **Correcao sugerida**: Remover `app-backup.js` e confiar no historico do Git para versoes anteriores.

---

## 2. INCONSISTENCIAS DE LOGICA

### 2.1 Calculo de dose para jarra usa vazao como denominador - pode dar divisao por zero

- **Arquivo**: `web/app.js`
- **Linha(s)**: 1610-1612
- **Severidade**: :red_circle: Critico
- **Descricao**: O calculo `doseJarra = ((p.dose * jarra) / vazao).toFixed(2)` usa `vazao` como denominador. Se a vazao for 0 (campo vazio ou nao preenchido), o resultado sera `Infinity`, exibindo "Infinity ml" no card de ordem de mistura e no PDF.
- **Correcao sugerida**: Validar que vazao > 0 antes do calculo: `const doseJarra = vazao > 0 ? ((p.dose * jarra) / vazao).toFixed(2) : '0.00';`

### 2.2 Hierarquia de mistura com prioridades incorretas

- **Arquivo**: `web/app.js`
- **Linha(s)**: 946-984
- **Severidade**: :red_circle: Critico
- **Descricao**: Na funcao `sortProductsByHierarchy`, adjuvantes tem prioridade 1 (primeiro) e oleos tem prioridade 4 (ultimo). Porem, na pratica agronomica, a ordem recomendada e: (1) completar 50-70% de agua, (2) produtos WG/WP primeiro, (3) depois SC/CS, (4) EC/CE, (5) adjuvantes e oleos por ultimo. A hierarquia atual coloca adjuvantes ANTES de todos os produtos, o que pode causar problemas de compatibilidade na calda.
- **Correcao sugerida**: Revisar a hierarquia de mistura com referencia tecnica agronomica. A pratica padrao e: agua > WG/WP > SC > EC > SL > adjuvantes > oleos.

### 2.3 Fallback para ordenacao por formulacao pode lancer TypeError

- **Arquivo**: `web/app.js`
- **Linha(s)**: 978
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: Na linha 978, `a.formulacao.localeCompare(b.formulacao)` sera chamado mesmo se `a.formulacao` for `undefined` (produto sem formulacao definida), lancando `TypeError: Cannot read properties of undefined`.
- **Correcao sugerida**: Usar `(a.formulacao || '').localeCompare(b.formulacao || '')`.

### 2.4 Dureza da agua medida em uS/cm - unidade incorreta

- **Arquivo**: `web/app.js` e `web/index.html`
- **Linha(s)**: app.js:1552-1571, index.html:310
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: A dureza da agua e medida em uS/cm (microsiemens por centimetro), que na verdade e a unidade de **condutividade eletrica**, nao de dureza. Dureza da agua e tipicamente medida em mg/L de CaCO3 ou ppm. Os limites usados (0-150 mole, 150-300 moderada, 300-500 dura, >500 muito dura) parecem ser para condutividade eletrica, nao dureza.
- **Correcao sugerida**: Corrigir o label para "Condutividade Eletrica (uS/cm)" ou alterar para "Dureza (mg/L CaCO3)" e ajustar os limites de classificacao.

### 2.5 Data de aplicacao sem validacao de data futura/passada

- **Arquivo**: `web/app.js`
- **Linha(s)**: 1070-1095
- **Severidade**: :green_circle: Baixo
- **Descricao**: O campo de data de aplicacao aceita qualquer data sem validar se e uma data razoavel (ex: datas no passado distante ou futuro muito distante). Nao ha alerta se a data selecionada nao esta coberta pela previsao meteorologica (7 dias).
- **Correcao sugerida**: Adicionar validacao para alertar se a data esta fora do alcance da previsao meteorologica.

### 2.6 Produto `PRODUTO` mapeado para tipo `outros` pode perder informacao

- **Arquivo**: `web/app.js`
- **Linha(s)**: 97-104
- **Severidade**: :green_circle: Baixo
- **Descricao**: No `LEGACY_TYPE_MAP`, produtos com tipo `PRODUTO` sao mapeados para `outros`. Isso pode perder informacao sobre o tipo real do produto (herbicida, fungicida, etc.) quando dados legados sao carregados.
- **Correcao sugerida**: Considerar um mapeamento mais especifico ou solicitar reclassificacao ao usuario.

---

## 3. INCONSISTENCIAS DE UI/UX

### 3.1 Textos com erros de portugues - falta de acentuacao

- **Arquivo**: `web/app.js`
- **Linha(s)**: 1555-1571
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: Os alertas de dureza da agua usam "AGUA" ao inves de "AGUA" (com acento). Exemplos:
  - "AGUA MOLE" deveria ser "AGUA MOLE"
  - "AGUA MODERADAMENTE DURA" deveria ser "AGUA MODERADAMENTE DURA"
  - "Agua com baixa dureza" deveria ser "Agua com baixa dureza"
  Nota: "Agua" aparece sem acento em multiplos locais.
- **Correcao sugerida**: Corrigir todas as ocorrencias de "AGUA/Agua" para "AGUA/Agua".

### 3.2 CSS com 3 arquivos sobrepondo os mesmos seletores

- **Arquivo**: `web/styles.css`, `web/navbar-clean.css`, `web/layout-integration.css`
- **Linha(s)**: Multiplas
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: Tres arquivos CSS definem estilos para os mesmos seletores (`.card`, `.btn-primary`, `.input-box`, `.product-item`, `.section-header`, `.menu-card`, `.badge-primary`, etc.). Os estilos se sobrescrevem baseados na ordem de carregamento no HTML (`styles.css` > `navbar-clean.css` > `layout-integration.css`). Isso causa:
  - `nav` definido em `styles.css` com fundo azul escuro (`var(--accent)`) e sobrescrito em `navbar-clean.css` com fundo branco
  - `.card` em `styles.css` tem `border-radius: 14px` e em `layout-integration.css` tem `border-radius: 16px`
  - `.input-box` tem `border: 2px solid` em `styles.css` e `border: 1px solid` em `layout-integration.css`
- **Correcao sugerida**: Consolidar os 3 arquivos CSS em um unico, eliminando duplicacoes e conflitos.

### 3.3 Busca por Estado/Cidade permanentemente desabilitada

- **Arquivo**: `web/index.html`
- **Linha(s)**: 349-357
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: Os selects de Estado e Cidade estao permanentemente `disabled` com texto "(Indisponivel)". Nao ha logica no JS para habilita-los. Isso confunde o usuario que ve campos que nunca podem ser usados.
- **Correcao sugerida**: Implementar a funcionalidade de busca por Estado/Cidade ou remover completamente os campos se nao serao implementados.

### 3.4 Estado de loading ausente nas buscas de produtos

- **Arquivo**: `web/app.js`
- **Linha(s)**: 470-492
- **Severidade**: :green_circle: Baixo
- **Descricao**: Na funcao `buscarProdutosTypeahead`, o estado "Carregando..." e mostrado como texto estatico. Nao ha indicador visual de loading (spinner) durante a busca no Firebase. O usuario nao tem feedback claro de que a busca esta em andamento.
- **Correcao sugerida**: Adicionar um spinner ou indicador animado durante a busca.

### 3.5 Label "Dose (L ou Kg/ha)" ambiguo

- **Arquivo**: `web/index.html`
- **Linha(s)**: 513
- **Severidade**: :green_circle: Baixo
- **Descricao**: O label "Dose (L ou Kg/ha)" e ambiguo pois nao permite ao usuario especificar se a dose e em litros ou quilos. O calculo na jarra teste assume que a unidade e sempre "ml", o que nao e correto para doses em Kg/ha (WG, WP).
- **Correcao sugerida**: Adicionar um seletor de unidade (L/ha ou Kg/ha) ao lado do campo de dose, e ajustar o calculo da jarra teste para usar "ml" ou "g" conforme a unidade.

### 3.6 Navbar-redesign.css carregado mas nao utilizado

- **Arquivo**: `web/navbar-redesign.css`
- **Linha(s)**: N/A
- **Severidade**: :green_circle: Baixo
- **Descricao**: O arquivo `navbar-redesign.css` (303 linhas) existe no projeto mas NAO e referenciado no `index.html`. E um arquivo morto que aumenta o tamanho do repositorio.
- **Correcao sugerida**: Remover `navbar-redesign.css` se nao for mais necessario.

---

## 4. INCONSISTENCIAS DE DADOS

### 4.1 Regras do Realtime Database incompletas - simulacoes sem protecao

- **Arquivo**: `database.rules.json`
- **Linha(s)**: 1-14
- **Severidade**: :red_circle: Critico
- **Descricao**: As regras do Realtime Database definem permissoes apenas para `produtos_usuarios` e `produtos_catalogo`. Nao ha regras para:
  - `simulacoes/` - qualquer usuario autenticado pode ler/escrever simulacoes de TODOS os usuarios
  - `users/` - perfis de usuarios podem estar desprotegidos
  - `produtos_catalogo_busca/` e `produtos_usuarios_busca/` - indices de busca sem regras
  - Caminhos nao cobertos pelas regras podem ter regras default (deny all) ou permissivas dependendo da config.
- **Correcao sugerida**: Adicionar regras para todos os caminhos usados:
  ```json
  "simulacoes": {
    "$uid": {
      ".read": "auth != null && (auth.uid === $uid || auth.token.admin === true)",
      ".write": "auth != null && auth.uid === $uid"
    }
  }
  ```

### 4.2 Dados legados de simulacoes com estrutura inconsistente

- **Arquivo**: `web/app.js`
- **Linha(s)**: 885-898
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: A funcao `loadHistoryFromFirebase` tem um fallback para dados legados que busca simulacoes na raiz (`/simulacoes/`) ao inves da estrutura organizada por UID (`/simulacoes/{uid}/`). Isso indica que houve uma migracao de schema sem migracao dos dados existentes. Produtos tambem tem nomes de campo inconsistentes: `produto_nome` vs `nome`, `produto_marca` vs `marca`.
- **Correcao sugerida**: Criar um script de migracao para mover simulacoes da estrutura legada para a nova estrutura por UID, e normalizar nomes de campos.

### 4.3 Servidor salva simulacoes em arquivo JSON local SEM relacao com Firebase

- **Arquivo**: `server/server.js`
- **Linha(s)**: 677-695
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: O endpoint `POST /api/simulacoes` salva dados em `server/data/simulacoes.json`, enquanto o frontend salva principalmente no Firebase RTDB. Os dois datastores nao sao sincronizados, podendo causar divergencia de dados. O `saveSimulationToServer` no `app.js` (linha 1042-1067) e um "backup silencioso" que pode falhar sem o usuario saber.
- **Correcao sugerida**: Decidir por uma unica fonte de verdade (Firebase RTDB) e remover o armazenamento no servidor JSON, ou implementar sincronizacao bidirecional.

### 4.4 Arquivos JSON de dados vazios no servidor

- **Arquivo**: `server/data/clientes.json`, `server/data/operadores.json`, `server/data/responsaveis.json`, `server/data/simulacoes.json`
- **Linha(s)**: N/A
- **Severidade**: :green_circle: Baixo
- **Descricao**: Varios arquivos JSON de dados estao vazios (`[]`). Isso indica que a funcionalidade de armazenamento local no servidor nao esta sendo usada ativamente, mas o codigo ainda tenta ler/escrever neles.
- **Correcao sugerida**: Remover os endpoints de API que usam esses arquivos se o Firebase e a fonte primaria de dados.

---

## 5. PERFORMANCE E BOAS PRATICAS

### 5.1 Arquivo `app.js` monolitico com 3376 linhas

- **Arquivo**: `web/app.js`
- **Linha(s)**: 1-3376
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: Todo o codigo do frontend esta em um unico arquivo de 3376 linhas. Contem: configuracao Firebase, logica de autenticacao, CRUD de produtos, busca, calculos, geracao de PDF, graficos, offline sync, navegacao, e UI. Isso dificulta manutencao, debug e reutilizacao.
- **Correcao sugerida**: Separar em modulos:
  - `firebase-init.js` - inicializacao do Firebase
  - `auth.js` - autenticacao
  - `products.js` - logica de produtos
  - `climate.js` - dados meteorologicos e graficos
  - `pdf.js` - geracao de PDF
  - `navigation.js` - navegacao entre etapas
  - `offline-sync.js` - sincronizacao offline

### 5.2 Dados mockados de clima hardcoded como fallback

- **Arquivo**: `web/app.js`
- **Linha(s)**: 1676-1683, 1751-1756, 1809-1814, 2540-2556, 2767-2788
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: Arrays de dados climaticos mockados estao hardcoded em MULTIPLAS funcoes como fallback (`checkClimateConditions`, `buildWindAlert`, `buildWindSummary`, `initCharts`, `renderClimateTables`). O mesmo array de mock e duplicado pelo menos 5 vezes. Se os dados reais nao forem carregados, o usuario vera dados falsos sem saber.
- **Correcao sugerida**: (1) Extrair os dados mock para uma constante unica. (2) Exibir uma mensagem clara ao usuario quando dados reais nao estao disponiveis ao inves de mostrar dados falsos.

### 5.3 `loadProdutosXlsx()` rele o arquivo XLSX a cada requisicao

- **Arquivo**: `server/server.js`
- **Linha(s)**: 259-274, 390-424
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: Cada chamada a `GET /api/produtos` executa `loadProdutosXlsx()` que le e parseia o arquivo XLSX do disco. Nao ha cache em memoria. Para muitas requisicoes simultaneas, isso causa I/O desnecessario e lentidao.
- **Correcao sugerida**: Implementar cache em memoria para o conteudo do XLSX, invalidando quando o arquivo e modificado (verificar mtime).

### 5.4 Cache de clima sem limite de tamanho

- **Arquivo**: `server/server.js`
- **Linha(s)**: 16-18, 276-291
- **Severidade**: :green_circle: Baixo
- **Descricao**: Os caches `weatherCache` e `geocodeCache` usam `Map` sem limite de tamanho. Em producao com muitos usuarios, isso pode causar memory leak.
- **Correcao sugerida**: Implementar um LRU cache com limite maximo de entradas (ex: 1000).

### 5.5 Codigo duplicado entre `normalizeTexto` e `normalizeKey`

- **Arquivo**: `web/productsService.js` (linhas 20-40) e `server/server.js` (linhas 196-217)
- **Linha(s)**: Multiplas
- **Severidade**: :green_circle: Baixo
- **Descricao**: As funcoes `normalizeTexto()` e `normalizeKey()` estao duplicadas entre o frontend (`productsService.js`) e o backend (`server.js`). Ambas fazem a mesma coisa (normalizar texto removendo acentos e caracteres especiais).
- **Correcao sugerida**: Extrair para um modulo compartilhado ou pelo menos manter sincronizadas.

### 5.6 Funcao `generatePDF` muito longa (~470 linhas)

- **Arquivo**: `web/app.js`
- **Linha(s)**: 2061-2527
- **Severidade**: :green_circle: Baixo
- **Descricao**: A funcao `generatePDF` tem aproximadamente 470 linhas, misturando logica de salvamento no Firebase, construcao de layout PDF (3 paginas), calculos de doses e analise tecnica. Extremamente dificil de manter e testar.
- **Correcao sugerida**: Separar em funcoes menores: `buildPDFPage1()`, `buildPDFPage2()`, `buildPDFPage3()`, e mover o salvamento automatico para antes da geracao.

---

## 6. SEGURANCA

### 6.1 Chaves Firebase reais hardcoded no codigo frontend

- **Arquivo**: `web/app.js`
- **Linha(s)**: 12-20
- **Severidade**: :red_circle: Critico
- **Descricao**: A API key do Firebase (`AIzaSyCWLwnpqAVyreJmj6Nsto7vox-B3SuOlFY`), project ID, app ID e messaging sender ID estao hardcoded no codigo-fonte. Embora Firebase client SDKs usem chaves publicas, isso expoe completamente a configuracao do projeto. Qualquer pessoa pode:
  - Criar contas no Firebase Auth do projeto
  - Ler dados publicos do Realtime Database
  - Abusar da cota de uso do projeto
- **Correcao sugerida**: (1) Configurar restricoes de dominio na Firebase Console para a API key. (2) Implementar Firebase App Check para proteger contra abuso. (3) Garantir que as regras do RTDB estao completas (ver item 4.1).

### 6.2 XSS potencial via `innerHTML` com dados do usuario

- **Arquivo**: `web/app.js`
- **Linha(s)**: 671, 1200-1232, 1498-1522, 3144
- **Severidade**: :red_circle: Critico
- **Descricao**: Multiplos locais usam `innerHTML` para renderizar dados que vem do usuario ou do banco de dados sem sanitizacao:
  - Linha 671: `container.innerHTML = \`<a href="${url}"...\`` - URL do FISPQ sem sanitizacao (pode injetar JS via `javascript:` URLs)
  - Linha 1200-1232: `renderHistoryList` renderiza `item.cliente`, `item.propriedade`, `item.cultura` diretamente em HTML
  - Linha 1498-1522: `renderProductList` renderiza `p.nome`, `p.marca`, `p.urlFispq` sem escape
  - Linha 3144: `toast.innerHTML = message` - se a mensagem contem HTML nao-confiavel
- **Correcao sugerida**: Usar `textContent` ao inves de `innerHTML` para dados do usuario, ou implementar uma funcao de escape HTML: `function escapeHtml(str) { return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }`

### 6.3 Endpoint da API sem autenticacao

- **Arquivo**: `server/server.js`
- **Linha(s)**: 362-695
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: Todos os endpoints da API (`/api/produtos`, `/api/simulacoes`, `/api/weather`, `/api/inmet`) nao exigem autenticacao. Qualquer pessoa pode:
  - Consultar todos os produtos (`GET /api/produtos`)
  - Listar TODAS as simulacoes (`GET /api/simulacoes` sem uid)
  - Criar simulacoes falsas (`POST /api/simulacoes`)
  - Ver debug info (`GET /api/produtos/_debug`)
- **Correcao sugerida**: Implementar middleware de autenticacao usando Firebase Admin SDK para verificar tokens JWT nos headers das requisicoes.

### 6.4 Endpoint de debug exposto em producao

- **Arquivo**: `server/server.js`
- **Linha(s)**: 366-388
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: O endpoint `GET /api/produtos/_debug` retorna informacoes sensiveis: caminho do arquivo no servidor, tamanho, data de modificacao, e dados de exemplo. Acessivel publicamente.
- **Correcao sugerida**: Proteger o endpoint com verificacao de admin ou remover em producao.

### 6.5 CORS permite localhost sem restricao de ambiente

- **Arquivo**: `server/server.js`
- **Linha(s)**: 20-24
- **Severidade**: :green_circle: Baixo
- **Descricao**: `ALLOWED_ORIGINS` inclui `http://localhost:5500` e `http://127.0.0.1:5500` mesmo em producao. Embora nao seja uma vulnerabilidade direta, permite desenvolvimento contra a API de producao.
- **Correcao sugerida**: Condicionar as origens de localhost a `NODE_ENV !== 'production'`.

### 6.6 Simulacoes POST nao valida payload no servidor

- **Arquivo**: `server/server.js`
- **Linha(s)**: 677-695
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: O endpoint `POST /api/simulacoes` aceita qualquer JSON e salva diretamente com spread (`...payload`). Nao ha validacao de schema. Um atacante pode injetar campos arbitrarios, dados enormes, ou scripts maliciosos.
- **Correcao sugerida**: Validar e sanitizar o payload antes de salvar. Usar whitelist de campos aceitos.

---

## 7. ARQUITETURA E ORGANIZACAO

### 7.1 Duas pastas de servidor: `server/` e `servidor/`

- **Arquivo**: `server/` e `servidor/`
- **Linha(s)**: N/A
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: Existem duas pastas de servidor: `server/` (principal) e `servidor/` (aparentemente legada/alternativa). A pasta `servidor/` contem apenas `package.json` e um script de importacao. Causa confusao sobre qual e a pasta correta.
- **Correcao sugerida**: Remover a pasta `servidor/` se nao for mais utilizada.

### 7.2 Scripts de migracao/fix duplicados e desorganizados

- **Arquivo**: `scripts/`, `rtdb-fix/`, `servidor/scripts/`
- **Linha(s)**: N/A
- **Severidade**: :green_circle: Baixo
- **Descricao**: Existem multiplos scripts de migracao, importacao e correcao espalhados em diferentes pastas:
  - `scripts/reset-produtos.js`, `scripts/reset-produtos-backup.js`, `scripts/reset-produtos-backup2.js` (3 versoes!)
  - `scripts/firestore-import/`, `scripts/rtdb-import/`, `scripts/firestore-migrate/`
  - `rtdb-fix/` na raiz
  - `servidor/scripts/` com mais um script de importacao
- **Correcao sugerida**: Consolidar em uma unica pasta `scripts/` com subpastas organizadas. Remover scripts de backup/duplicados.

### 7.3 Ausencia total de testes

- **Arquivo**: N/A
- **Linha(s)**: N/A
- **Severidade**: :red_circle: Critico
- **Descricao**: O projeto NAO possui nenhum teste unitario, de integracao ou e2e. Funcoes criticas sem testes incluem:
  - `sortProductsByHierarchy` - ordem de mistura de produtos
  - `computeDeltaT` / `computeDewPoint` - calculos meteorologicos
  - Calculos de dose (jarra, tanque, area)
  - `buildAITechnicalAnalysis` - analise tecnica de aplicacao
  - `normalizeKey` / `normalizeTexto` - normalizacao de busca
  - Fluxo completo de autenticacao
- **Correcao sugerida**: Implementar testes unitarios para todas as funcoes de calculo e logica de negocio. Usar Jest ou Vitest.

### 7.4 Firebase v8 SDK (legado) ao inves de v9+ (modular)

- **Arquivo**: `web/index.html`
- **Linha(s)**: 23-25
- **Severidade**: :green_circle: Baixo
- **Descricao**: O projeto usa Firebase v8 SDK (`8.10.0`) que e a API compativel/legada. O SDK modular v9+ oferece tree-shaking para bundles menores e performance melhor.
- **Correcao sugerida**: Migrar para Firebase v9+ modular SDK quando possivel.

### 7.5 Multiplos `package.json` sem workspace configurado

- **Arquivo**: `package.json`, `server/package.json`, `servidor/package.json`, `scripts/firestore-import/package.json`
- **Linha(s)**: N/A
- **Severidade**: :green_circle: Baixo
- **Descricao**: Existem 4 arquivos `package.json` no projeto sem npm workspaces configurado. Dependencias como `firebase-admin` e `xlsx` estao duplicadas entre `package.json` raiz e `server/package.json`.
- **Correcao sugerida**: Configurar npm workspaces ou consolidar as dependencias em um unico `package.json`.

### 7.6 Logica de negocio misturada com UI no `app.js`

- **Arquivo**: `web/app.js`
- **Linha(s)**: 1-3376
- **Severidade**: :yellow_circle: Moderado
- **Descricao**: Funcoes puras de calculo (ex: `computeDeltaT`, `sortProductsByHierarchy`, `buildAITechnicalAnalysis`) estao no mesmo arquivo que manipulacao de DOM e geracao de PDF. Nao ha separacao de responsabilidades.
- **Correcao sugerida**: Separar calculos puros em modulos independentes que possam ser testados isoladamente.

---

## RESUMO EXECUTIVO

### Total de Problemas por Severidade

| Severidade | Quantidade |
|---|---|
| :red_circle: Critico | **6** |
| :yellow_circle: Moderado | **17** |
| :green_circle: Baixo | **12** |
| **TOTAL** | **35** |

### Top 5 Problemas Mais Urgentes

1. **:red_circle: XSS via innerHTML (6.2)** - Dados do usuario renderizados sem sanitizacao. Um atacante pode injetar scripts maliciosos via nomes de clientes/produtos no Firebase. Impacto: comprometimento de contas de todos os usuarios.

2. **:red_circle: Regras RTDB incompletas (4.1)** - Simulacoes de todos os usuarios podem estar acessiveis sem restricao. Um usuario autenticado pode ler/editar simulacoes de outros usuarios.

3. **:red_circle: Ausencia total de testes (7.3)** - Funcoes de calculo agronomico (dose, hierarquia de mistura, delta T) nao tem testes. Erros nessas funcoes podem causar dosagens incorretas em campo.

4. **:red_circle: Divisao por zero no calculo de dose (2.1)** - Se vazao for 0, os calculos de dose retornam Infinity, exibindo valores incorretos na tela e no PDF impresso.

5. **:red_circle: Hierarquia de mistura potencialmente incorreta (2.2)** - Adjuvantes sendo adicionados antes dos produtos pode causar problemas de compatibilidade na calda real.

### Sugestoes de Melhorias Gerais

1. **Modularizar o codigo** - Separar o `app.js` monolitico em modulos independentes com responsabilidades claras.

2. **Implementar testes** - Priorizar testes unitarios para funcoes de calculo (dosagem, delta T, hierarquia) que impactam decisoes agronomicas reais.

3. **Consolidar CSS** - Unificar os 3 arquivos CSS com estilos conflitantes em um unico arquivo consistente.

4. **Completar regras de seguranca** - Adicionar regras do Firebase RTDB para todos os caminhos usados, especialmente simulacoes e perfis de usuarios.

5. **Sanitizar inputs/outputs** - Implementar escape HTML em todos os pontos onde dados do usuario sao renderizados via innerHTML.

6. **Remover codigo morto** - Eliminar arquivos nao utilizados (`app-backup.js`, `navbar-redesign.css`, `server/-F`, pasta `servidor/`), scripts duplicados e dados mock hardcoded.

7. **Revisar formulas agronomicas** - Validar com engenheiro agronomo a hierarquia de mistura, unidades de medida (dureza vs condutividade), e calculos de dose para diferentes formulacoes (L/ha vs Kg/ha).

8. **Autenticar a API do servidor** - Adicionar middleware de verificacao de token Firebase nos endpoints que manipulam dados sensiveis.

---

*Relatorio gerado por auditoria automatizada em 2026-02-12.*
