# Sistema de Pontos (Loyalty) - Guia de Configuração

Este projeto suporta múltiplos provedores de pontos através de um sistema de adapters. O sistema escolhe automaticamente qual adapter usar baseado nas secrets configuradas.

## Provedores Suportados

### 1. StreamElements (Recomendado)

StreamElements é o provedor padrão e tem prioridade sobre outros adapters.

#### Configuração

1. Acesse [StreamElements Dashboard](https://streamelements.com/dashboard)
2. Vá em **Account Settings** → **Channels** → **Show Secrets**
3. Copie o **JWT Token**
4. Copie o **Channel ID**

#### Adicionar Secrets no Lovable

1. **STREAMELEMENTS_JWT_TOKEN**: O JWT Token do StreamElements
2. **STREAMELEMENTS_CHANNEL_ID**: O ID do seu canal

#### API Endpoint

```
GET https://api.streamelements.com/kappa/v2/points/{channel_id}/{username}
Authorization: Bearer {jwt_token}
```

#### Exemplo de Resposta

```json
{
  "channel": "12345",
  "username": "viewer123",
  "points": 1500,
  "pointsAlltime": 5000,
  "watchtime": 3600,
  "rank": 42
}
```

### 2. API REST Genérica (Fallback)

Se você usa um sistema de pontos customizado ou outro provedor, pode configurar uma API REST genérica.

#### Requisitos

Sua API deve ter um endpoint que:
- Aceita `twitch_login` como query parameter
- Retorna JSON com campo `balance`
- Suporta autenticação via Bearer token

#### Configuração

Adicione os seguintes secrets no Lovable:

1. **LOYALTY_API_BASE**: URL base da sua API (ex: `https://api.seusite.com`)
2. **LOYALTY_API_KEY**: Token de autenticação

#### API Endpoint Esperado

```
GET {LOYALTY_API_BASE}/balance?twitch_login={username}
Authorization: Bearer {LOYALTY_API_KEY}
```

#### Exemplo de Resposta Esperada

```json
{
  "balance": 1500
}
```

#### Exemplo de Implementação

Se você precisa criar uma API REST genérica, aqui está um exemplo básico:

```javascript
// Express.js example
app.get('/balance', authenticateToken, async (req, res) => {
  const { twitch_login } = req.query;
  
  if (!twitch_login) {
    return res.status(400).json({ error: 'twitch_login required' });
  }
  
  // Buscar saldo do seu banco de dados
  const balance = await db.getUserBalance(twitch_login);
  
  res.json({ balance });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  
  next();
}
```

## Prioridade de Adapters

O sistema escolhe o adapter nesta ordem:

1. **StreamElements**: Se `STREAMELEMENTS_JWT_TOKEN` e `STREAMELEMENTS_CHANNEL_ID` estão configurados
2. **API REST Genérica**: Se `LOYALTY_API_BASE` e `LOYALTY_API_KEY` estão configurados
3. **Erro**: Se nenhum adapter está configurado

## Testando a Configuração

### Usando Browser DevTools

1. Faça login com Twitch
2. Abra o Console do navegador (F12)
3. Execute:

```javascript
const response = await fetch('/functions/v1/loyalty-balance', {
  credentials: 'include'
});
const data = await response.json();
console.log(data);
```

Resposta esperada:
```json
{
  "success": true,
  "balance": 1500,
  "twitch_login": "seu_username"
}
```

### Verificando Logs

Os logs da edge function `loyalty-balance` mostram qual adapter está sendo usado:

```
Using StreamElements adapter
Fetching StreamElements balance for username123
```

ou

```
Using Generic REST adapter
Fetching balance from generic API for username123
```

## Troubleshooting

### Erro: "No loyalty provider configured"

**Causa**: Nenhum adapter está configurado.

**Solução**: Configure pelo menos um dos adapters (StreamElements ou API REST Genérica).

### Erro: "StreamElements API error: 404"

**Causa**: Usuário não encontrado no StreamElements.

**Possíveis soluções**:
- Verifique se o usuário já participou do chat da sua live
- Confirme que o `twitch_login` está correto
- Verifique se o Channel ID está correto

### Erro: "Generic API error: 401"

**Causa**: Token de autenticação inválido.

**Solução**: Verifique se o `LOYALTY_API_KEY` está correto.

### Saldo sempre retorna 0

**Causa**: Usuário existe mas não tem pontos.

**Solução**: Isso é esperado para novos usuários. Eles precisam acumular pontos primeiro.

### Saldo não atualiza automaticamente

**Causa**: O auto-refresh está configurado para 60 segundos.

**Solução**: Use o botão "Atualizar saldo" para forçar uma atualização imediata.

## Mudando de Provedor

Para trocar de provedor, basta:

1. Remover os secrets do provedor atual
2. Adicionar os secrets do novo provedor
3. Reiniciar a aplicação (não é necessário alterar código)

O sistema detectará automaticamente qual adapter usar baseado nos secrets disponíveis.

## Exemplo de Uso em Código

```typescript
import { supabase } from '@/integrations/supabase/client';

async function getUserBalance(twitchLogin: string) {
  const { data, error } = await supabase.functions.invoke('loyalty-balance', {
    headers: { 'Content-Type': 'application/json' },
  });

  if (error) {
    console.error('Failed to fetch balance:', error);
    return 0;
  }

  return data.balance;
}
```

## Segurança

- ✅ **Secrets nunca expostos**: Todas as credenciais ficam no servidor
- ✅ **Autenticação obrigatória**: Apenas usuários logados podem consultar saldo
- ✅ **Rate limiting**: Auto-refresh limitado a 1x por minuto
- ✅ **Error handling**: Erros não expõem informações sensíveis
