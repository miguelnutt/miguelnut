# Implementação de Consolidação de Usuários Twitch

## 📋 Resumo das Alterações

### 1. **Banco de Dados (Migration)**

#### Função `get_or_merge_profile_v2` Aprimorada
- ✅ **Lock Pessimista**: Usa `FOR UPDATE` para prevenir race conditions
- ✅ **Consolidação Automática**: Detecta e mescla duplicatas com mesmo `twitch_user_id`
- ✅ **Migração de Histórico**: Move dados de todas as tabelas relacionadas
- ✅ **Consolidação de Saldos**: Soma Rubini Coins e Tickets das duplicatas
- ✅ **Registro de Aliases**: Mantém histórico de mudanças de nome
- ✅ **Constraint de Formato**: Valida que `twitch_user_id` é numérico

#### Índices e Constraints Criados (Profiles)
```sql
-- Garante apenas um perfil ativo por twitch_user_id
CREATE UNIQUE INDEX idx_profiles_twitch_user_id_active 
ON profiles(twitch_user_id) WHERE is_active = true;

-- Otimiza busca por username
CREATE INDEX idx_profiles_twitch_username_active 
ON profiles(twitch_username) WHERE is_active = true;

-- Valida formato numérico
ALTER TABLE profiles ADD CONSTRAINT check_twitch_user_id_format 
CHECK (twitch_user_id ~ '^\d+$');
```

#### Melhorias em `ticket_ledger` (Idempotência Completa)
- ✅ **Campo `idempotency_key`**: Chave única para garantir idempotência
- ✅ **Campo `status`**: Rastreamento de status (confirmado/pendente/falhou)
- ✅ **Campo `origem`**: Identificação da fonte da transação
- ✅ **Campo `referencia_id`**: Referência externa (reward_id, game_id, etc)
- ✅ **Campo `error_message`**: Mensagem de erro para transações falhadas
- ✅ **Campo `retries`**: Contador de tentativas de reprocessamento
- ✅ **Índices de Performance**: Para `idempotency_key`, `status`, e queries de auditoria

#### Melhorias em `rubini_coins_history` (Performance)
- ✅ **Índice por origem**: Otimiza queries filtradas por fonte
- ✅ **Índice composto**: Para queries de auditoria por usuário e data
- ✅ **Índice por referencia_id**: Para rastreamento de transações relacionadas

#### Função `consolidate_duplicate_profiles()` (Batch Consolidation)
- ✅ **Consolidação em Lote**: Processa todas as duplicatas existentes no banco
- ✅ **Migração Completa**: Move todos os relacionamentos e históricos
- ✅ **Auditoria Detalhada**: Registra saldos antes/depois em `profile_merge_audit`
- ✅ **Idempotência**: Pode ser executada múltiplas vezes sem problemas
- ✅ **Logging Estruturado**: RAISE NOTICE para cada duplicata processada

### 2. **Edge Functions Atualizadas**

#### `twitch-auth-exchange` (Login/Registro)
- ✅ Validação de entrada (`code`, `code_verifier`, `redirect_uri`)
- ✅ Normalização de identificadores Twitch
- ✅ Validação de formato `twitch_user_id` (numérico)
- ✅ Busca case-insensitive para créditos provisórios
- ✅ JWT com `profile_id` e dados normalizados
- ✅ Logging estruturado para auditoria

#### `twitch-auth-me` (Validação de Sessão)
- ✅ Validação de campos obrigatórios no token
- ✅ Normalização de identificadores na resposta
- ✅ Validação de formato `twitch_user_id`
- ✅ Inclusão de `profile_id` na resposta
- ✅ Logging de validação de sessão

### 3. **Componentes Frontend**

#### `AccountSettings.tsx`
- ✅ Nova seção "Identidade Twitch"
- ✅ Exibição de `twitch_user_id` e `twitch_username`
- ✅ Indicador visual de status de vínculo
- ✅ Badges de verificação/alerta para identidade

#### `UsersSection.tsx` (Admin)
- ✅ Coluna `twitch_user_id` com badge de status
- ✅ Ação "Reconciliar saldo" para admins
- ✅ Modal de confirmação para reconciliação
- ✅ Exibição aprimorada de vínculo Twitch

## 🔄 Fluxo de Consolidação

### Primeiro Login (Novo Usuário)
```
1. Twitch OAuth → código de autorização
2. twitch-auth-exchange:
   - Valida e normaliza identificadores
   - Chama get_or_merge_profile_v2
   - Cria perfil com twitch_user_id
   - Aplica créditos provisórios
3. JWT gerado com profile_id
4. Usuário autenticado
```

### Relogin (Usuário Existente)
```
1. Twitch OAuth → código de autorização
2. twitch-auth-exchange:
   - Valida identificadores
   - get_or_merge_profile_v2 encontra perfil via twitch_user_id
   - Detecta mudança de nome (se houver)
   - Registra alias antigo
   - Atualiza display_name_canonical
3. JWT atualizado com novos dados
```

### Consolidação de Duplicatas (Automática)
```
1. get_or_merge_profile_v2 detecta múltiplos perfis ativos com mesmo twitch_user_id
2. Para cada duplicata:
   - Soma saldos (Rubini Coins + Tickets)
   - Migra históricos (ledger, rewards, games, etc)
   - Marca como is_active = false
   - Define merged_into = perfil_canonico
3. Consolida saldos no perfil canônico
4. Retorna profile_id canônico
```

## 🛡️ Garantias de Idempotência

### Consolidação de Perfis
- ✅ Lock pessimista (`FOR UPDATE`) previne race conditions
- ✅ Constraint única garante apenas 1 perfil ativo por `twitch_user_id`
- ✅ `ON CONFLICT` em criação de perfil evita duplicatas
- ✅ Índices parciais otimizam performance de busca

### Crédito de Recompensas (Rubini Coins)
- ✅ `idempotency_key` obrigatório em todas as operações
- ✅ Verificação de duplicatas com status `confirmado`
- ✅ Registro de falhas com `error_message`
- ✅ Índice específico para busca rápida por `idempotency_key`

### Crédito de Recompensas (Tickets)
- ✅ `idempotency_key` em `ticket_ledger` (novo)
- ✅ Verificação de duplicatas antes de creditar
- ✅ Validação de saldo não-negativo
- ✅ Registro de falhas com status e mensagem de erro
- ✅ Tratamento de exceções com rollback implícito

### Aplicação de Créditos Provisórios
- ✅ Flag `aplicado` previne reaplicação
- ✅ Busca case-insensitive por username/display_name
- ✅ Transação atômica ao marcar como aplicado

## 🧪 Cenários de Teste Cobertos

1. **Primeiro Login**
   - ✅ Cria perfil único com `twitch_user_id`
   - ✅ Inicializa saldos zerados
   - ✅ Aplica créditos provisórios (se houver)

2. **Relogin Simultâneo**
   - ✅ Lock pessimista previne criação de duplicatas
   - ✅ Segundo login aguarda lock e reutiliza perfil

3. **Troca de Display Name**
   - ✅ Detecta mudança de nome
   - ✅ Registra alias antigo em `user_aliases`
   - ✅ Atualiza `display_name_canonical`

4. **Múltiplas Recompensas Idênticas**
   - ✅ `idempotency_key` previne crédito duplicado
   - ✅ Segundo POST retorna sucesso mas não credita novamente

5. **Consolidação Automática de Duplicatas** (Tempo Real)
   - ✅ Detecta perfis com mesmo `twitch_user_id` em login
   - ✅ Migra todos os históricos automaticamente
   - ✅ Soma saldos no perfil canônico
   - ✅ Desativa perfis duplicados
   - ✅ Registra auditoria completa

6. **Consolidação em Lote de Duplicatas** (Batch)
   - ✅ Função `consolidate_duplicate_profiles()` para processar duplicatas existentes
   - ✅ Pode ser executada por admins via edge function
   - ✅ Retorna relatório detalhado de cada consolidação
   - ✅ Idempotente - pode ser executada múltiplas vezes

7. **Reconciliação de Saldos por Usuário** (Admin) **[NOVO]**
   - ✅ Análise com dry-run antes de aplicar correções
   - ✅ Dialog de confirmação com preview detalhado
   - ✅ Recalcula saldos a partir do histórico de transações confirmadas
   - ✅ Corrige divergências em Rubini Coins e Tickets
   - ✅ Registra auditoria completa em `balance_reconciliation_audit`
   - ✅ Idempotente - múltiplas execuções em saldos corretos não fazem alterações

## 📊 Pontos de Integração Tocados

### Tabelas do Banco
- `profiles` (unique index, constraint de formato)
- `user_aliases` (registro de mudanças de nome)
- `rubini_coins_balance` (consolidação de saldos)
- `rubini_coins_history` (migração, novos índices de performance)
- `tickets` (consolidação de saldos)
- `ticket_ledger` (migração, campos de idempotência adicionados)
- `balance_reconciliation_audit` (auditoria de reconciliações) **[NOVO]**
- `daily_rewards_history` (migração de histórico)
- `tibiatermo_user_games` (migração de jogos)
- `spins` (migração de roletas)
- `chat_messages` (migração de mensagens)
- `rubini_coins_resgates` (migração de resgates)
- `raffles` (atualização de vencedor)
- `profile_merge_audit` (auditoria de consolidações)

### Edge Functions e Database Functions
- `twitch-auth-exchange` (validação e normalização de login)
- `twitch-auth-me` (validação de sessão JWT)
- `award-reward` (idempotência completa para tickets)
- `reconcile-balance` (reconciliação de saldos com auditoria completa) **[NOVO]**
- `consolidate-profiles-batch` (consolidação batch manual)
- `get_or_merge_profile_v2` (consolidação automática em tempo real)
- `consolidate_duplicate_profiles()` (consolidação batch de duplicatas existentes)

### Componentes Frontend
- `AccountSettings.tsx` (identidade Twitch)
- `UsersSection.tsx` (admin - reconciliação de saldos com preview e confirmação) **[ATUALIZADO]**

## 🔄 Fluxo de Reconciliação de Saldos **[NOVO]**

### Quando Usar
- Suspeita de divergência entre saldo armazenado e histórico de transações
- Após migrações ou consolidações de perfis
- Verificação periódica de integridade de dados

### Fluxo Passo a Passo
```
1. Admin clica em "Reconciliar" na seção de usuário
2. Sistema executa análise (dry-run):
   - Calcula saldo correto = SUM(transações confirmadas)
   - Compara com saldo armazenado
   - Identifica divergências
3. Se houver divergências:
   - Mostra dialog com preview:
     * Saldo atual vs. saldo correto
     * Valor da divergência
     * Ações que serão tomadas
4. Admin confirma correção
5. Sistema aplica correções:
   - Atualiza rubini_coins_balance
   - Atualiza tickets
   - Registra transações de correção no histórico
   - Registra auditoria em balance_reconciliation_audit
6. Retorna relatório detalhado
```

### Garantias de Idempotência
- ✅ Reconciliação em saldos já corretos não faz alterações
- ✅ Múltiplas execuções não duplicam correções
- ✅ Correções são registradas no histórico com idempotency_key único
- ✅ Auditoria completa de cada operação

### Exemplo de Resposta
```json
{
  "success": true,
  "userId": "uuid",
  "username": "joao_gamer",
  "rubiniCoins": {
    "before": 150,
    "calculated": 125,
    "after": 125,
    "divergence": 25,
    "corrected": true
  },
  "tickets": {
    "before": 10,
    "calculated": 10,
    "after": 10,
    "divergence": 0,
    "corrected": false
  },
  "summary": {
    "hadDivergence": true,
    "correctionApplied": true,
    "reason": "Divergência detectada e corrigida"
  },
  "auditId": "audit-uuid",
  "requestId": "reconcile-..."
}
```

## 🔐 Segurança e Validação

- ✅ Validação de formato `twitch_user_id` (numérico)
- ✅ Normalização de strings (`trim`, `toLowerCase`)
- ✅ Logging estruturado para auditoria
- ✅ Transações atômicas em operações críticas
- ✅ Lock pessimista em leituras concorrentes

## 🎯 Conformidade com Requisitos

### Ação 1: Normalizar e validar identificadores
✅ Implementado em `twitch-auth-exchange` e `twitch-auth-me`

### Ação 2: Criação/atualização atômica
✅ Implementado em `get_or_merge_profile_v2` com locks e constraints

### Ação 3: Unificar contas antigas
✅ Consolidação automática em `get_or_merge_profile_v2`

### Idempotência de Recompensas
✅ `idempotency_key` em `add-rubini-coins` e `award-reward`

### Reutilização de Código
✅ Nenhuma função paralela criada, apenas aprimoramento das existentes

### Compatibilidade
✅ Rotas e componentes atuais preservados, sem breaking changes

## 📈 Melhorias de Performance

### Índices Criados
- ✅ `idx_profiles_twitch_user_id_active` - Busca única por twitch_user_id ativo
- ✅ `idx_profiles_twitch_username_active` - Busca por username ativo
- ✅ `idx_ticket_ledger_idempotency_key` - Verificação rápida de duplicatas (tickets)
- ✅ `idx_ticket_ledger_status` - Queries filtradas por status
- ✅ `idx_ticket_ledger_user_created` - Auditoria por usuário e data
- ✅ `idx_rubini_coins_history_origem` - Queries filtradas por origem
- ✅ `idx_rubini_coins_history_user_created` - Auditoria por usuário e data
- ✅ `idx_rubini_coins_history_referencia_id` - Rastreamento por referência
- ✅ `idx_balance_reconciliation_user_id` - Histórico de reconciliações por usuário **[NOVO]**
- ✅ `idx_balance_reconciliation_performed_by` - Reconciliações por admin **[NOVO]**
- ✅ `idx_balance_reconciliation_created_at` - Busca cronológica de auditorias **[NOVO]**
- ✅ `idx_balance_reconciliation_corrections` - Filtro rápido por correções aplicadas **[NOVO]**

### Benefícios
- 🚀 Redução no tempo de verificação de idempotência
- 🚀 Queries de auditoria mais rápidas
- 🚀 Busca por username case-insensitive otimizada
- 🚀 Prevenção efetiva de duplicatas em race conditions
- 🚀 Histórico completo de reconciliações acessível rapidamente **[NOVO]**

## 🔐 Segurança e Autorização

### Reconciliação de Saldos
- ✅ Requer autenticação via JWT token
- ✅ Verifica role de admin antes de executar
- ✅ Logging estruturado de todas as operações
- ✅ Auditoria completa com ID do admin executor
- ✅ Todas as correções registradas no histórico

### Consolidação de Perfis
- ✅ Função de banco `SECURITY DEFINER` para bypass controlado de RLS
- ✅ Lock pessimista previne race conditions
- ✅ Transações atômicas garantem consistência

## 🧪 Cenários de Teste Recomendados

### Reconciliação de Saldos
1. **Saldo Correto (Sem Divergência)**
   - ✅ Executar reconciliação
   - ✅ Verificar que mensagem "Saldos corretos!" é exibida
   - ✅ Confirmar que nenhuma alteração é feita

2. **Saldo Divergente (Rubini Coins)**
   - ✅ Forçar divergência manual no banco
   - ✅ Executar análise e ver preview
   - ✅ Confirmar correção
   - ✅ Verificar saldo atualizado e auditoria registrada

3. **Saldo Divergente (Tickets)**
   - ✅ Forçar divergência manual no banco
   - ✅ Executar análise e ver preview
   - ✅ Confirmar correção
   - ✅ Verificar saldo atualizado e auditoria registrada

4. **Múltiplas Reconciliações (Idempotência)**
   - ✅ Reconciliar saldo divergente
   - ✅ Executar novamente imediatamente
   - ✅ Confirmar que segunda execução não altera nada
   - ✅ Verificar apenas uma entrada de auditoria com correção

5. **Permissão Negada (Não-Admin)**
   - ✅ Tentar reconciliar sem role de admin
   - ✅ Verificar erro 403 Forbidden

---

**Status**: ✅ Implementação Completa  
**Última Atualização**: 2025-10-24  
**Versão**: 3.0 (inclui reconciliação de saldos com auditoria)
