# 🗑️ Edge Functions para Remover/Desativar

## ⚠️ IMPORTANTE
Estas Edge Functions devem ser **REMOVIDAS** ou **DESATIVADAS** antes de aplicar a solução definitiva de duplicatas, pois elas contêm lógicas conflitantes que podem causar:
- Sobrecarga do sistema
- Conflitos de consolidação
- Duplicação de esforços
- Inconsistências nos dados

---

## 🚨 Edge Functions CRÍTICAS para Remoção

### 1. `consolidate-profiles`
**Localização:** `supabase/functions/consolidate-profiles/index.ts`
**Problema:** API manual para consolidação que conflita com a solução automática
**Ações que realiza:**
- Recebe `duplicateId` e `canonicalId`
- Migra saldos manualmente
- Faz log em `profile_merge_audit`
- Desativa perfil duplicado

**❌ DEVE SER REMOVIDA:** Conflita com consolidação automática

### 2. `consolidate-profiles-batch`
**Localização:** `supabase/functions/consolidate-profiles-batch/index.ts`
**Problema:** Consolidação em lote que pode conflitar
**Ações que realiza:**
- Usa `consolidate_duplicate_profiles` via RPC
- Suporte a dry-run
- Log de erros
- Relatórios de consolidação

**❌ DEVE SER REMOVIDA:** Usa função que será removida

### 3. `auto-consolidate-profiles`
**Localização:** `supabase/functions/auto-consolidate-profiles/index.ts`
**Problema:** Consolidação automática conflitante
**Ações que realiza:**
- Identifica duplicatas por username
- Migra saldos automaticamente
- Log em `profile_merge_audit`
- Desativa duplicados

**❌ DEVE SER REMOVIDA:** Lógica automática conflitante

### 4. `populate-twitch-user-ids`
**Localização:** `supabase/functions/populate-twitch-user-ids/index.ts`
**Problema:** Script específico com consolidação hardcoded
**Ações que realiza:**
- Consolidação hardcoded de IDs específicos
- Migração de saldos
- Log em `profile_merge_audit`

**❌ DEVE SER REMOVIDA:** Script específico desnecessário

---

## ⚠️ Edge Functions que USAM get_or_merge_profile_v2

### 5. `submit-tibiatermo-guess`
**Status:** ✅ MANTER (mas monitorar)
**Motivo:** Usa `get_or_merge_profile_v2` que será atualizada na solução definitiva

### 6. `get-tibiatermo-word`
**Status:** ✅ MANTER (mas monitorar)
**Motivo:** Usa `get_or_merge_profile_v2` que será atualizada na solução definitiva

### 7. `twitch-auth-exchange`
**Status:** ✅ MANTER (mas monitorar)
**Motivo:** Usa `get_or_merge_profile_v2` que será atualizada na solução definitiva

---

## 🔧 Edge Functions com Lógica de Duplicatas

### 8. `reconcile-rubini-coins`
**Status:** ✅ MANTER
**Motivo:** Lógica para evitar eventos duplicados (diferente de perfis duplicados)

### 9. `add-rubini-coins`
**Status:** ✅ MANTER
**Motivo:** Lógica para evitar awards duplicados (diferente de perfis duplicados)

### 10. `award-reward`
**Status:** ✅ MANTER
**Motivo:** Lógica para evitar rewards duplicados (diferente de perfis duplicados)

### 11. `claim-daily-reward`
**Status:** ✅ MANTER
**Motivo:** Flag `ignoreDuplicates` para rewards (diferente de perfis duplicados)

### 12. `resolve-user-identity`
**Status:** ⚠️ REVISAR
**Motivo:** Identifica duplicatas e consolida saldos em memória
**Ação:** Verificar se conflita com solução definitiva

---

## 📋 Plano de Remoção

### Passo 1: Backup
```bash
# Fazer backup das Edge Functions antes de remover
mkdir -p backup/edge-functions/$(date +%Y%m%d)
cp -r supabase/functions/consolidate-profiles backup/edge-functions/$(date +%Y%m%d)/
cp -r supabase/functions/consolidate-profiles-batch backup/edge-functions/$(date +%Y%m%d)/
cp -r supabase/functions/auto-consolidate-profiles backup/edge-functions/$(date +%Y%m%d)/
cp -r supabase/functions/populate-twitch-user-ids backup/edge-functions/$(date +%Y%m%d)/
```

### Passo 2: Remover Edge Functions
```bash
# Remover as Edge Functions problemáticas
rm -rf supabase/functions/consolidate-profiles
rm -rf supabase/functions/consolidate-profiles-batch
rm -rf supabase/functions/auto-consolidate-profiles
rm -rf supabase/functions/populate-twitch-user-ids
```

### Passo 3: Verificar Dependências
- Verificar se alguma aplicação frontend chama essas funções
- Verificar se há cron jobs ou webhooks que usam essas funções
- Verificar logs de uso recente

### Passo 4: Atualizar Deployment
```bash
# Fazer deploy para remover as funções do Supabase
supabase functions deploy
```

---

## 🎯 Resultado Esperado

Após a remoção:
- ✅ Apenas a solução definitiva gerenciará duplicatas
- ✅ Não haverá conflitos entre diferentes lógicas
- ✅ Sistema mais limpo e eficiente
- ✅ Menor sobrecarga de processamento
- ✅ Consolidação consistente e confiável

---

## 🚨 ATENÇÃO

**EXECUTE PRIMEIRO:** `DESATIVAR_SCRIPTS_ANTIGOS_DUPLICATAS.sql`
**DEPOIS REMOVA:** As Edge Functions listadas acima
**FINALMENTE APLIQUE:** A solução definitiva

**NÃO PULE ETAPAS** - A ordem é importante para evitar inconsistências!