# 📝 Guia de Configuração Passo a Passo

## 🚀 Etapa 1: Configurar Firebase CLI

### 1.1 Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

### 1.2 Fazer Login

```bash
firebase login
```

### 1.3 Inicializar Projeto

```bash
cd seu-projeto
firebase init
```

Selecione:
- ✅ Functions
- ✅ Firestore
- ✅ Hosting (opcional)

---

## 🔧 Etapa 2: Configurar Cloud Functions

### 2.1 Criar Estrutura

```
seu-projeto/
├── functions/
│   ├── index.js          # Suas Cloud Functions
│   ├── package.json
│   └── .gitignore
├── firestore.rules       # Regras de segurança
├── web/
│   ├── admin.html        # Painel admin
│   ├── admin-panel.js    # Lógica do painel
│   └── firebase-config.js
└── set-admin.js          # Script para criar primeiro admin
```

### 2.2 Copiar Código das Functions

Copie o código do arquivo `functions/index.js` do guia principal.

### 2.3 Instalar Dependências

```bash
cd functions
npm install
cd ..
```

### 2.4 Deploy das Functions

```bash
firebase deploy --only functions
```

**Importante:** Anote as URLs das functions que aparecerem no console!

---

## 🔒 Etapa 3: Configurar Regras de Segurança

### 3.1 Editar firestore.rules

Substitua o conteúdo de `firestore.rules` pelo código fornecido no guia principal.

### 3.2 Deploy das Regras

```bash
firebase deploy --only firestore:rules
```

### 3.3 Verificar no Console

1. Acesse: https://console.firebase.google.com/
2. Selecione seu projeto
3. Vá em **Firestore Database** > **Regras**
4. Verifique se as regras foram aplicadas

---

## 👤 Etapa 4: Criar Primeiro Administrador

### Método 1: Via Script Node.js (Recomendado)

#### 4.1 Baixar Chave de Serviço

1. Firebase Console > Configurações do Projeto
2. Aba **Contas de serviço**
3. Clique em **Gerar nova chave privada**
4. Salve como `serviceAccountKey.json` na raiz do projeto

⚠️ **NUNCA COMITAR ESTE ARQUIVO NO GIT!**

#### 4.2 Configurar Script

Edite `set-admin.js`:
```javascript
const ADMIN_EMAIL = 'seu-email@exemplo.com'; // Seu email
```

#### 4.3 Executar

```bash
node set-admin.js
```

Você verá:
```
✅ Usuário promovido a ADMIN com sucesso!
```

### Método 2: Via Firebase Console (Temporário)

Se você não conseguir usar o script, pode adicionar manualmente no Firestore:

1. Firestore Database > Coleção `users`
2. Encontre seu documento (UID = seu user ID)
3. Adicione campo: `isAdmin: true`

**Nota:** Este método não define a Custom Claim, então você precisará fazer isso via script depois.

---

## 🎨 Etapa 5: Adicionar Painel Admin ao Site

### 5.1 Copiar Arquivos

Copie para sua pasta `web/` ou `public/`:
- `admin.html`
- `admin-panel.js`

### 5.2 Atualizar firebase-config.js

Certifique-se de que está carregando o Firebase SDK:

```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  // ... resto da config
};

firebase.initializeApp(firebaseConfig);
```

### 5.3 Adicionar Link no Menu

No seu `index.html`, adicione um link para o painel:

```html
<a href="admin.html" id="admin-link" style="display:none;">
  🔐 Painel Admin
</a>

<script>
// Mostrar link apenas para admins
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    const idTokenResult = await user.getIdTokenResult();
    if (idTokenResult.claims.admin) {
      document.getElementById('admin-link').style.display = 'block';
    }
  }
});
</script>
```

---

## 🚀 Etapa 6: Deploy e Testes

### 6.1 Deploy Completo

```bash
firebase deploy
```

Ou apenas hosting:
```bash
firebase deploy --only hosting
```

### 6.2 Testar Localmente

```bash
firebase serve
```

Acesse: http://localhost:5000

### 6.3 Checklist de Testes

- [ ] Login como usuário normal → Não deve ver link admin
- [ ] Login como admin → Deve ver link admin
- [ ] Acessar painel admin → Deve carregar lista de usuários
- [ ] Visualizar detalhes de um usuário → Deve mostrar todas as info
- [ ] Editar usuário → Deve salvar alterações
- [ ] Desabilitar/Habilitar usuário → Deve funcionar
- [ ] Promover usuário a admin → Deve funcionar
- [ ] Deletar usuário → Deve pedir confirmação e deletar

---

## ⚠️ Problemas Comuns

### Erro: "permission-denied"

**Causa:** Usuário não tem permissão de admin.

**Solução:**
1. Verificar se executou `set-admin.js`
2. Fazer logout e login novamente
3. Verificar custom claims no console do navegador:
```javascript
firebase.auth().currentUser.getIdTokenResult()
  .then(token => console.log(token.claims))
```

### Erro: Functions não encontradas

**Causa:** Functions não foram deployadas.

**Solução:**
```bash
firebase deploy --only functions
```

### Erro: "Error: Could not load the default credentials"

**Causa:** Falta arquivo serviceAccountKey.json

**Solução:**
1. Baixar do Firebase Console
2. Colocar na raiz do projeto
3. **NÃO** commitar no Git!

### Rules não aplicadas

**Solução:**
```bash
firebase deploy --only firestore:rules
```

Aguarde alguns minutos para propagar.

---

## 🔒 Segurança - Checklist Final

Antes de colocar em produção, verifique:

- [ ] Regras do Firestore estão configuradas
- [ ] Custom claims estão sendo verificadas
- [ ] serviceAccountKey.json NÃO está no Git
- [ ] Variáveis sensíveis estão em .env
- [ ] CORS está configurado corretamente
- [ ] HTTPS está habilitado (automático no Firebase Hosting)
- [ ] Apenas emails autorizados podem ser promovidos a admin

---

## 📚 Recursos Adicionais

### Documentação Oficial

- [Firebase Functions](https://firebase.google.com/docs/functions)
- [Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

### Comandos Úteis

```bash
# Ver logs das functions
firebase functions:log

# Deletar uma function
firebase functions:delete NOME_FUNCAO

# Emular functions localmente
firebase emulators:start

# Ver uso e custos
firebase projects:list
```

---

## 🎯 Próximos Passos

Após implementar o painel básico, você pode:

1. **Adicionar Filtros Avançados**
   - Filtrar por data de criação
   - Filtrar por último login
   - Busca por múltiplos campos

2. **Adicionar Gráficos**
   - Chart.js para estatísticas
   - Gráfico de crescimento de usuários
   - Gráfico de atividade

3. **Adicionar Logs de Auditoria**
   - Registrar todas as ações admin
   - Timestamp + Admin que executou
   - Histórico de mudanças

4. **Exportar Dados**
   - Exportar lista de usuários para CSV
   - Backup de dados
   - Relatórios em PDF

5. **Notificações**
   - Email para usuários promovidos
   - Email para usuários desabilitados
   - Notificações no app

---

## 💡 Dicas Pro

### 1. Ambiente de Dev vs Prod

Crie dois projetos Firebase:
- `seu-projeto-dev` (para testes)
- `seu-projeto-prod` (para produção)

### 2. Múltiplos Níveis de Admin

Adicione diferentes níveis:
```javascript
customClaims: {
  admin: true,
  role: 'super-admin' // ou 'moderator', 'support'
}
```

### 3. Rate Limiting

Adicione rate limiting nas functions:
```javascript
// Limitar a 10 requisições por minuto
const limiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 'minute'
});
```

### 4. Backup Automático

Configure backup automático do Firestore:
https://firebase.google.com/docs/firestore/manage-data/export-import

---

## 🆘 Precisa de Ajuda?

Se encontrar problemas:

1. Verifique os logs: `firebase functions:log`
2. Inspecione o console do navegador (F12)
3. Verifique as regras do Firestore
4. Confirme que as functions foram deployadas
5. Teste com `firebase emulators:start`

---

## ✅ Conclusão

Parabéns! Você agora tem um painel de administração completo e seguro! 🎉

Principais conquistas:
- ✅ Sistema de permissões robusto
- ✅ CRUD completo de usuários
- ✅ Interface profissional
- ✅ Segurança implementada corretamente
- ✅ Escalável para crescimento futuro

Continue aprimorando e adicionando funcionalidades conforme sua necessidade!
