# Diagnóstico: Problema de Persistência do Nome do Personagem

## Problema Relatado
O usuário Brux0D relatou que o nome do personagem "Le Smerig" não está sendo persistido corretamente. Quando ele salva o nome e recarrega a página, o nome desaparece.

## Análise do Código

### 1. Função de Salvamento (`save-twitch-character`)
✅ **FUNCIONANDO CORRETAMENTE**
- Valida JWT corretamente
- Busca perfil existente por `twitch_username`
- Atualiza ou cria perfil conforme necessário
- Logs detalhados para debug

### 2. Função de Carregamento (`carregarDadosCompletos`)
⚠️ **POSSÍVEL PROBLEMA IDENTIFICADO**

A função `carregarDadosCompletos` tem uma lógica de priorização que pode causar o problema:

```typescript
// 1. PRIORIDADE: Buscar por twitch_user_id
if (twitchUser.twitch_user_id) {
  const { data: profileByTwitchId } = await supabase
    .from('profiles')
    .select('id, nome_personagem')
    .eq('twitch_user_id', twitchUser.twitch_user_id)
    .eq('is_active', true)
    .maybeSingle();
  profile = profileByTwitchId;
}

// 2. Fallback: Buscar por twitch_username (apenas se não achou por ID)
if (!profile) {
  const searchTerm = prepareUsernameForSearch(twitchUser.login);
  const { data: profileByUsername } = await supabase
    .from('profiles')
    .select('id, nome_personagem')
    .ilike('twitch_username', searchTerm)
    .eq('is_active', true)
    .maybeSingle();
  profile = profileByUsername;
}
```

## Cenário do Problema

### Situação Provável:
1. **Perfil Antigo**: Existe um perfil com `twitch_username = "thzxp"` mas **SEM** `twitch_user_id`
2. **Perfil Novo**: Quando o usuário faz login, pode ser criado um novo perfil com `twitch_user_id` mas **SEM** nome do personagem
3. **Conflito**: A busca prioriza `twitch_user_id`, encontra o perfil novo (vazio), ignora o perfil antigo (com dados)

### Fluxo do Problema:
1. Usuário salva nome "Le Smerig" → vai para o perfil antigo (por `twitch_username`)
2. Usuário recarrega página → busca encontra perfil novo (por `twitch_user_id`) → nome vazio
3. Sistema não encontra o nome salvo porque está no perfil "errado"

## Soluções Propostas

### Solução 1: Melhorar Mesclagem de Perfis
Modificar a função `carregarDadosCompletos` para:
1. Buscar AMBOS os perfis (por ID e por username)
2. Se encontrar ambos, mesclar os dados
3. Manter apenas um perfil ativo

### Solução 2: Atualizar Perfis Existentes
Quando encontrar perfil por `twitch_username` mas não por `twitch_user_id`:
1. Atualizar o perfil existente com o `twitch_user_id`
2. Garantir que não haja duplicatas

### Solução 3: Busca Unificada
Modificar a busca para considerar ambos os campos simultaneamente:
```sql
SELECT * FROM profiles 
WHERE (twitch_user_id = $1 OR twitch_username ILIKE $2) 
AND is_active = true
ORDER BY twitch_user_id NULLS LAST
LIMIT 1
```

## Teste Recomendado

Execute o arquivo `test_character_persistence.html` para:
1. Simular o salvamento do nome
2. Verificar se a busca encontra o perfil correto
3. Identificar se há múltiplos perfis para o mesmo usuário

## Próximos Passos

1. ✅ Criar teste específico
2. ✅ Verificar configuração do Supabase  
3. ✅ Analisar função de salvamento
4. 🔄 Implementar solução de mesclagem de perfis
5. ⏳ Testar com dados reais do usuário Brux0D