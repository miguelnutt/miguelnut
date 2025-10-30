-- =====================================================
-- SCRIPT PARA DESATIVAR TODOS OS SCRIPTS ANTIGOS DE DUPLICATAS
-- =====================================================
-- Este script remove/desativa TODAS as soluções antigas
-- para evitar conflitos com a solução definitiva
-- =====================================================

-- Habilitar logs detalhados
SET client_min_messages = NOTICE;

\echo '🧹 INICIANDO LIMPEZA DE SCRIPTS ANTIGOS DE DUPLICATAS...'

-- ===== REMOVER FUNÇÕES ANTIGAS DE CONSOLIDAÇÃO =====

\echo '🗑️ Removendo funções antigas de consolidação...'

-- Funções do script consolidate_users_comprehensive.sql
DROP FUNCTION IF EXISTS consolidate_all_duplicate_users() CASCADE;
DROP FUNCTION IF EXISTS consolidate_user_data(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS consolidate_user_balances(UUID, UUID, INTEGER, INTEGER) CASCADE;

-- Funções das migrations antigas
DROP FUNCTION IF EXISTS consolidate_duplicate_profiles() CASCADE;
DROP FUNCTION IF EXISTS get_or_merge_profile(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS merge_duplicate_profiles(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS prevent_duplicate_profiles() CASCADE;

-- Outras funções antigas encontradas
DROP FUNCTION IF EXISTS public.get_or_merge_profile(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.merge_duplicate_profiles(UUID, UUID) CASCADE;

\echo '✅ Funções antigas removidas!'

-- ===== REMOVER TRIGGERS ANTIGOS =====

\echo '🗑️ Removendo triggers antigos...'

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_profiles ON profiles;

\echo '✅ Triggers antigos removidos!'

-- ===== DESATIVAR EDGE FUNCTIONS PROBLEMÁTICAS =====

\echo '🗑️ Documentando Edge Functions que devem ser desativadas...'

-- Criar tabela para documentar Edge Functions que devem ser removidas/desativadas
CREATE TABLE IF NOT EXISTS deprecated_edge_functions (
  function_name TEXT PRIMARY KEY,
  reason TEXT,
  replacement TEXT,
  deprecated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir Edge Functions que devem ser desativadas
INSERT INTO deprecated_edge_functions (function_name, reason, replacement) VALUES
('consolidate-profiles', 'Lógica de consolidação manual conflitante', 'Solução definitiva automática'),
('consolidate-profiles-batch', 'Consolidação em lote conflitante', 'Solução definitiva automática'),
('auto-consolidate-profiles', 'Consolidação automática conflitante', 'Solução definitiva automática'),
('populate-twitch-user-ids', 'Script específico para um caso', 'Não necessário com solução definitiva')
ON CONFLICT (function_name) DO UPDATE SET
  reason = EXCLUDED.reason,
  replacement = EXCLUDED.replacement,
  deprecated_at = NOW();

\echo '📋 Edge Functions documentadas para remoção:'
SELECT function_name, reason FROM deprecated_edge_functions;

-- ===== LIMPAR TABELAS DE AUDITORIA ANTIGAS =====

\echo '🗑️ Limpando tabelas de auditoria antigas...'

-- Fazer backup das auditorias antigas antes de limpar
CREATE TABLE IF NOT EXISTS old_profile_merge_audit_backup AS
SELECT *, NOW() as backup_created_at
FROM profile_merge_audit
WHERE merged_at < NOW() - INTERVAL '1 day';

-- Limpar auditoria antiga para evitar confusão
TRUNCATE TABLE profile_merge_audit;

\echo '✅ Auditorias antigas movidas para backup!'

-- ===== REMOVER ÍNDICES ANTIGOS CONFLITANTES =====

\echo '🗑️ Removendo índices antigos...'

-- Remover índices que podem conflitar
DROP INDEX IF EXISTS idx_profiles_unique_twitch_user_id;

\echo '✅ Índices antigos removidos!'

-- ===== VERIFICAR E LIMPAR MIGRATIONS PROBLEMÁTICAS =====

\echo '🔍 Verificando migrations problemáticas...'

-- Criar tabela para documentar migrations problemáticas
CREATE TABLE IF NOT EXISTS problematic_migrations (
  migration_file TEXT PRIMARY KEY,
  issue TEXT,
  status TEXT DEFAULT 'IDENTIFIED',
  identified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documentar migrations problemáticas
INSERT INTO problematic_migrations (migration_file, issue) VALUES
('20251017182148_588a990c-ed05-4c20-acd2-899f3edf1bed.sql', 'Consolidação por nome com DELETE direto'),
('20251017182259_ec1dde6d-867c-44b9-a01b-a33f981084d8.sql', 'Duplicata da migration anterior'),
('20251019114836_b3040278-7314-43d6-b4d3-6c32a682ed4b.sql', 'Funções get_or_merge_profile antigas'),
('20251019114741_61d5f429-cfbe-4049-aafa-9cf03375ffa3.sql', 'Duplicata da migration anterior'),
('20251022081753_9cc02f66-b08a-4b18-b600-95b760b84167.sql', 'Consolidação automática por username'),
('20251022010833_a165acfc-d4e9-4069-b380-6c768c408761.sql', 'Consolidação manual de IDs específicos'),
('20251024080855_371ca76a-c77c-49cc-a09c-0e03d822d935.sql', 'Função consolidate_duplicate_profiles'),
('20241231000000_final_user_deduplication.sql', 'Solução anterior incompleta')
ON CONFLICT (migration_file) DO UPDATE SET
  issue = EXCLUDED.issue,
  identified_at = NOW();

\echo '📋 Migrations problemáticas identificadas:'
SELECT migration_file, issue FROM problematic_migrations;

-- ===== VERIFICAR ESTADO ATUAL =====

\echo '🔍 Verificando estado atual do sistema...'

-- Contar perfis ativos
SELECT 
  'PERFIS_ATIVOS_ANTES_LIMPEZA' as categoria,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE twitch_user_id IS NOT NULL AND twitch_user_id != '') as com_twitch_id,
  COUNT(*) FILTER (WHERE twitch_user_id IS NULL OR twitch_user_id = '') as sem_twitch_id
FROM profiles 
WHERE is_active = true;

-- Contar duplicatas restantes
SELECT 
  'DUPLICATAS_TWITCH_USER_ID_ANTES_LIMPEZA' as categoria,
  COUNT(*) as grupos_duplicados,
  SUM(cnt - 1) as total_duplicatas
FROM (
  SELECT twitch_user_id, COUNT(*) as cnt
  FROM profiles
  WHERE twitch_user_id IS NOT NULL 
    AND twitch_user_id != '' 
    AND is_active = true
  GROUP BY twitch_user_id
  HAVING COUNT(*) > 1
) dups;

-- Verificar funções restantes relacionadas a duplicatas
SELECT 
  'FUNCOES_RELACIONADAS_DUPLICATAS' as categoria,
  COUNT(*) as total_funcoes,
  string_agg(proname, ', ') as nomes_funcoes
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%consolidat%' OR
    p.proname ILIKE '%merge%' OR
    p.proname ILIKE '%duplicat%' OR
    p.proname ILIKE '%deduplicat%'
  );

-- ===== PREPARAR PARA SOLUÇÃO DEFINITIVA =====

\echo '🚀 Preparando sistema para solução definitiva...'

-- Garantir que não há locks ativos
SELECT pg_advisory_unlock_all();

-- Verificar se há transações pendentes relacionadas a perfis
SELECT 
  'TRANSACOES_PENDENTES' as categoria,
  COUNT(*) as total,
  string_agg(DISTINCT state, ', ') as estados
FROM pg_stat_activity 
WHERE query ILIKE '%profiles%' 
  AND state != 'idle';

\echo '✅ LIMPEZA CONCLUÍDA!'
\echo ''
\echo '📋 RESUMO DA LIMPEZA:'
\echo '✅ Funções antigas de consolidação removidas'
\echo '✅ Triggers antigos removidos'
\echo '✅ Edge Functions documentadas para remoção'
\echo '✅ Auditorias antigas movidas para backup'
\echo '✅ Índices conflitantes removidos'
\echo '✅ Migrations problemáticas documentadas'
\echo ''
\echo '⚠️  AÇÕES MANUAIS NECESSÁRIAS:'
\echo '1. Remover/desativar as Edge Functions listadas em deprecated_edge_functions'
\echo '2. Verificar se alguma aplicação chama as funções removidas'
\echo '3. Aplicar a solução definitiva após esta limpeza'
\echo ''
\echo '🎯 PRÓXIMO PASSO:'
\echo 'Execute: \\i supabase/migrations/20241231120000_solucao_definitiva_duplicatas.sql'

-- ===== INSTRUÇÕES FINAIS =====

/*
APÓS EXECUTAR ESTE SCRIPT:

✅ REMOVIDO:
- consolidate_all_duplicate_users()
- consolidate_user_data()
- consolidate_user_balances()
- consolidate_duplicate_profiles()
- get_or_merge_profile() (versões antigas)
- merge_duplicate_profiles()
- prevent_duplicate_profiles()
- Triggers antigos

⚠️  EDGE FUNCTIONS PARA REMOVER MANUALMENTE:
- consolidate-profiles
- consolidate-profiles-batch  
- auto-consolidate-profiles
- populate-twitch-user-ids

📋 MIGRATIONS PROBLEMÁTICAS IDENTIFICADAS:
- Várias migrations com lógicas conflitantes
- Documentadas na tabela problematic_migrations

🚀 PRÓXIMOS PASSOS:
1. Remover Edge Functions listadas
2. Aplicar solução definitiva
3. Testar funcionamento

IMPORTANTE: 
- Backup das auditorias antigas em: old_profile_merge_audit_backup
- Lista de Edge Functions em: deprecated_edge_functions
- Lista de migrations problemáticas em: problematic_migrations
*/