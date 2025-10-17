# 🎮 Guia Completo: Login com Twitch (Passo a Passo)

Este guia vai te ensinar a configurar o login com Twitch no seu site, passo a passo, mesmo sem experiência técnica.

---

## 📋 Pré-requisitos

- Uma conta na Twitch
- Acesso ao projeto no Lovable

---

## 🔧 PASSO 1: Criar Aplicação na Twitch

### 1.1 Acessar o Console de Desenvolvedor

1. Abra seu navegador
2. Acesse: **https://dev.twitch.tv/console/apps**
3. Faça login com sua conta Twitch
4. Clique no botão **"Register Your Application"** (Registrar Seu Aplicativo)

### 1.2 Preencher Informações do App

Na tela de registro, preencha:

- **Name** (Nome): `Meu Site Login` (ou qualquer nome que quiser)
- **OAuth Redirect URLs**: Adicione DUAS URLs:
  ```
  https://2db03593-d5b5-43f1-8504-c80592c12e9f.lovableproject.com/auth/twitch/callback
  ```
  E depois clique em **"Add"** e adicione:
  ```
  http://localhost:5173/auth/twitch/callback
  ```
  (Para testes locais, se necessário)

- **Category** (Categoria): Selecione `Website Integration`
- **Client Type**: Selecione `Confidential`

4. Clique em **"Create"** (Criar)

### 1.3 Copiar Client ID e Client Secret

Após criar:

1. Você verá uma tela com o **Client ID** - COPIE este valor
2. Clique no botão **"New Secret"** (Novo Segredo)
3. Vai aparecer o **Client Secret** - COPIE este valor também
   
   ⚠️ **IMPORTANTE**: O Client Secret aparece apenas UMA VEZ! Guarde-o em lugar seguro.

---

## 🔐 PASSO 2: Adicionar Secrets no Lovable

### 2.1 Acessar Secrets

1. No seu projeto Lovable, clique em **"Settings"** (Configurações) no topo
2. Vá em **"Cloud"** ou **"Backend"**
3. Clique em **"Secrets"**

### 2.2 Adicionar TWITCH_CLIENT_ID

1. Clique em **"Add Secret"** ou **"New Secret"**
2. Em **"Secret Name"**, digite: `TWITCH_CLIENT_ID`
3. Em **"Secret Value"**, COLE o **Client ID** que você copiou da Twitch
4. Clique em **"Save"** ou **"Add"**

### 2.3 Adicionar TWITCH_CLIENT_SECRET

1. Clique novamente em **"Add Secret"**
2. Em **"Secret Name"**, digite: `TWITCH_CLIENT_SECRET`
3. Em **"Secret Value"**, COLE o **Client Secret** que você copiou da Twitch
4. Clique em **"Save"** ou **"Add"**

### 2.4 Adicionar JWT_SECRET (Opcional mas Recomendado)

1. Clique em **"Add Secret"**
2. Em **"Secret Name"**, digite: `JWT_SECRET`
3. Em **"Secret Value"**, digite uma senha forte aleatória, exemplo: `minha-chave-super-secreta-2024`
4. Clique em **"Save"**

---

## 🚀 PASSO 3: Configurar as Edge Functions

As funções serverless já foram criadas no código. Agora precisamos torná-las públicas (acessíveis sem autenticação).

### 3.1 Editar supabase/config.toml

No arquivo `supabase/config.toml`, adicione no FINAL do arquivo:

```toml
[functions.twitch-auth-exchange]
verify_jwt = false

[functions.twitch-auth-me]
verify_jwt = false

[functions.twitch-auth-logout]
verify_jwt = false
```

---

## ✅ PASSO 4: Testar o Login

### 4.1 Publicar o Site

1. No Lovable, clique em **"Publish"** (Publicar) ou **"Deploy"**
2. Aguarde o deploy terminar

### 4.2 Testar em Janela Anônima

1. Abra uma janela anônima/privativa no navegador
2. Acesse seu site publicado
3. Clique no botão **"Entrar com Twitch"**
4. Você será redirecionado para a Twitch
5. Clique em **"Authorize"** (Autorizar)
6. Você será redirecionado de volta para o site, já logado!

### 4.3 Verificar se Funcionou

Você deve ver:
- Seu avatar da Twitch
- Seu nome de usuário

---

## 🔍 PASSO 5: Como Verificar a API (Teste Avançado)

Se você quiser testar a API diretamente:

### 5.1 Testar Endpoint /api/auth/me

1. Após fazer login, abra o Console do Navegador (F12)
2. Vá na aba **"Console"**
3. Cole e execute:

```javascript
fetch('https://qkwctrccuqkjygqurqxt.supabase.co/functions/v1/twitch-auth-me', {
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

Você deve ver um JSON com seus dados:
```json
{
  "success": true,
  "user": {
    "twitch_user_id": "123456789",
    "login": "seu_usuario",
    "display_name": "Seu Nome",
    ...
  }
}
```

---

## 🎯 RESUMO - Checklist

Marque cada item conforme completa:

- [ ] Criar app na Twitch Developer Console
- [ ] Copiar Client ID e Client Secret
- [ ] Adicionar TWITCH_CLIENT_ID nos Secrets do Lovable
- [ ] Adicionar TWITCH_CLIENT_SECRET nos Secrets do Lovable
- [ ] Adicionar JWT_SECRET nos Secrets do Lovable (opcional)
- [ ] Adicionar configuração das edge functions no config.toml
- [ ] Publicar o site
- [ ] Testar login em janela anônima
- [ ] Verificar que nome e avatar aparecem após login

---

## 🆘 Problemas Comuns

### "invalid client"
- ✅ Verifique se o Client ID e Secret estão corretos nos Secrets
- ✅ Verifique se adicionou a Redirect URL correta na Twitch

### "redirect_uri mismatch"
- ✅ A URL de redirect na Twitch deve ser EXATAMENTE: `https://SEU-DOMINIO.lovableproject.com/auth/twitch/callback`
- ✅ Não esqueça o `/auth/twitch/callback` no final

### Cookie não está sendo setado
- ✅ Certifique-se que está usando HTTPS (não HTTP)
- ✅ Verifique se as edge functions estão com `verify_jwt = false`

### "Not authenticated" ao chamar /api/auth/me
- ✅ Faça login primeiro
- ✅ Use `credentials: 'include'` no fetch

---

## 📚 Estrutura de Arquivos Criados

```
supabase/functions/
  ├── twitch-auth-exchange/index.ts    # Troca código por token
  ├── twitch-auth-me/index.ts          # Retorna usuário logado
  └── twitch-auth-logout/index.ts      # Faz logout

src/
  ├── components/TwitchLoginButton.tsx  # Botão de login
  ├── pages/TwitchCallback.tsx          # Página de callback
  └── hooks/useTwitchAuth.tsx           # Hook de autenticação

supabase/config.toml                    # Configuração das functions
```

---

## 🎉 Pronto!

Agora você tem login com Twitch funcionando no seu site! 🚀

Qualquer dúvida, revise os passos acima ou entre em contato.
