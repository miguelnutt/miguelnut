-- =====================================================
-- APLICAÇÃO IMEDIATA DA SOLUÇÃO DEFINITIVA DE DUPLICATAS
-- =====================================================
-- Esta migration aplica a solução definitiva AGORA
-- =====================================================

-- Habilitar logs detalhados
SET client_min_messages = NOTICE;

\echo '🚀 APLICANDO SOLUÇÃO DEFINITIVA DE DUPLICATAS...'

-- ===== REMOVER FUNÇÕES ANTIGAS CONFLITANTES =====

\echo '🗑️ Removendo funções antigas conflitantes...'

-- Remover todas as funções antigas de consolidação
DROP FUNCTION IF EXISTS consolidate_all_duplicate_users() CASCADE;
DROP FUNCTION IF EXISTS consolidate_user_data(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS consolidate_user_balances(UUID, UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS consolidate_duplicate_profiles() CASCADE;
DROP FUNCTION IF EXISTS get_or_merge_profile(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS merge_duplicate_profiles(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS prevent_duplicate_profiles() CASCADE;

-- Remover triggers antigos
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_profiles ON profiles;

\echo '✅ Funções antigas removidas!'

-- ===== CRIAR TABELAS DE BACKUP E AUDITORIA =====

\echo '📋 Criando tabelas de backup e auditoria...'

-- Tabela de backup dos perfis antes da consolidação
CREATE TABLE IF NOT EXISTS profiles_backup_pre_consolidation (
  id UUID,
  twitch_user_id TEXT,
  nome TEXT,
  nome_personagem TEXT,
  twitch_username TEXT,
  is_active BOOLEAN,
  merged_into UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  backup_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de auditoria da consolidação
CREATE TABLE IF NOT EXISTS consolidation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_name TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  canonical_id UUID,
  duplicate_id UUID,
  consolidation_type TEXT,
  rubini_consolidated DECIMAL(10,2) DEFAULT 0,
  tickets_consolidated INTEGER DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fazer backup dos perfis atuais
INSERT INTO profiles_backup_pre_consolidation 
SELECT *, NOW() FROM profiles
ON CONFLICT DO NOTHING;

\echo '✅ Backup criado!'

-- ===== FUNÇÃO PARA CONSOLIDAR DADOS COMPLETOS =====

\echo '🔧 Criando função de consolidação completa...'

CREATE OR REPLACE FUNCTION consolidar_dados_usuario_completo(
  p_source_user_id UUID,
  p_target_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_rubini_migrated DECIMAL(10,2) := 0;
  v_tickets_migrated INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Migrar Rubini Coins History
  UPDATE rubini_coins_history 
  SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- Migrar Ticket Ledger
  UPDATE ticket_ledger 
  SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- Migrar Daily Rewards
  UPDATE daily_rewards 
  SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- Migrar Game Data
  UPDATE game_data 
  SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- Migrar Spins
  UPDATE spins 
  SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- Migrar Raffles
  UPDATE raffles 
  SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- Migrar Chat Messages
  UPDATE chat_messages 
  SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- Migrar Rubini Coins Redemptions
  UPDATE rubini_coins_redemptions 
  SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- Migrar User Daily Logins
  UPDATE user_daily_logins 
  SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- Migrar Tibiatermo User Games
  UPDATE tibiatermo_user_games 
  SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- Consolidar saldos
  SELECT 
    COALESCE(SUM(rubini_coins), 0),
    COALESCE(SUM(tickets), 0)
  INTO v_rubini_migrated, v_tickets_migrated
  FROM profiles 
  WHERE id IN (p_source_user_id, p_target_user_id);
  
  -- Atualizar saldos no perfil canonical
  UPDATE profiles 
  SET 
    rubini_coins = v_rubini_migrated,
    tickets = v_tickets_migrated,
    updated_at = NOW()
  WHERE id = p_target_user_id;
  
  -- Zerar saldos do perfil duplicado
  UPDATE profiles 
  SET 
    rubini_coins = 0,
    tickets = 0,
    updated_at = NOW()
  WHERE id = p_source_user_id;
  
  v_result := jsonb_build_object(
    'rubini_migrated', v_rubini_migrated,
    'tickets_migrated', v_tickets_migrated,
    'source_user_id', p_source_user_id,
    'target_user_id', p_target_user_id
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

\echo '✅ Função de consolidação criada!'

-- ===== FUNÇÃO PRINCIPAL DE CONSOLIDAÇÃO =====

\echo '🔧 Criando função principal de consolidação...'

CREATE OR REPLACE FUNCTION consolidacao_definitiva_usuarios()
RETURNS JSONB AS $$
DECLARE
  v_total_consolidados INTEGER := 0;
  v_total_rubini DECIMAL(10,2) := 0;
  v_total_tickets INTEGER := 0;
  v_resultado JSONB;
  v_consolidacao_result JSONB;
  rec RECORD;
BEGIN
  -- ETAPA 1: Consolidação por twitch_user_id
  \echo '📊 ETAPA 1: Consolidação por twitch_user_id...'
  
  FOR rec IN (
    SELECT 
      twitch_user_id,
      array_agg(id ORDER BY created_at ASC) as profile_ids,
      COUNT(*) as total_profiles
    FROM profiles 
    WHERE twitch_user_id IS NOT NULL 
      AND twitch_user_id != '' 
      AND is_active = true
    GROUP BY twitch_user_id 
    HAVING COUNT(*) > 1
  ) LOOP
    
    DECLARE
      v_canonical_id UUID := rec.profile_ids[1];
      v_duplicate_id UUID;
    BEGIN
      -- Consolidar cada duplicata
      FOR i IN 2..array_length(rec.profile_ids, 1) LOOP
        v_duplicate_id := rec.profile_ids[i];
        
        -- Consolidar dados
        SELECT consolidar_dados_usuario_completo(v_duplicate_id, v_canonical_id) 
        INTO v_consolidacao_result;
        
        -- Marcar como merged
        UPDATE profiles 
        SET 
          is_active = false,
          merged_into = v_canonical_id,
          updated_at = NOW()
        WHERE id = v_duplicate_id;
        
        -- Log da consolidação
        INSERT INTO consolidation_audit (
          step_name, action_taken, canonical_id, duplicate_id, 
          consolidation_type, rubini_consolidated, tickets_consolidated, details
        ) VALUES (
          'ETAPA_1_TWITCH_USER_ID',
          'PROFILE_MERGED',
          v_canonical_id,
          v_duplicate_id,
          'BY_TWITCH_USER_ID',
          (v_consolidacao_result->>'rubini_migrated')::DECIMAL,
          (v_consolidacao_result->>'tickets_migrated')::INTEGER,
          v_consolidacao_result
        );
        
        v_total_consolidados := v_total_consolidados + 1;
        v_total_rubini := v_total_rubini + (v_consolidacao_result->>'rubini_migrated')::DECIMAL;
        v_total_tickets := v_total_tickets + (v_consolidacao_result->>'tickets_migrated')::INTEGER;
      END LOOP;
    END;
  END LOOP;
  
  -- ETAPA 2: Consolidação por nome normalizado
  \echo '📊 ETAPA 2: Consolidação por nome normalizado...'
  
  FOR rec IN (
    SELECT 
      LOWER(TRIM(nome)) as nome_normalizado,
      array_agg(id ORDER BY created_at ASC) as profile_ids,
      COUNT(*) as total_profiles
    FROM profiles 
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
      AND nome IS NOT NULL 
      AND nome != ''
      AND is_active = true
    GROUP BY LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
  ) LOOP
    
    DECLARE
      v_canonical_id UUID := rec.profile_ids[1];
      v_duplicate_id UUID;
    BEGIN
      FOR i IN 2..array_length(rec.profile_ids, 1) LOOP
        v_duplicate_id := rec.profile_ids[i];
        
        SELECT consolidar_dados_usuario_completo(v_duplicate_id, v_canonical_id) 
        INTO v_consolidacao_result;
        
        UPDATE profiles 
        SET 
          is_active = false,
          merged_into = v_canonical_id,
          updated_at = NOW()
        WHERE id = v_duplicate_id;
        
        INSERT INTO consolidation_audit (
          step_name, action_taken, canonical_id, duplicate_id, 
          consolidation_type, rubini_consolidated, tickets_consolidated, details
        ) VALUES (
          'ETAPA_2_NOME_NORMALIZADO',
          'PROFILE_MERGED',
          v_canonical_id,
          v_duplicate_id,
          'BY_NORMALIZED_NAME',
          (v_consolidacao_result->>'rubini_migrated')::DECIMAL,
          (v_consolidacao_result->>'tickets_migrated')::INTEGER,
          v_consolidacao_result
        );
        
        v_total_consolidados := v_total_consolidados + 1;
        v_total_rubini := v_total_rubini + (v_consolidacao_result->>'rubini_migrated')::DECIMAL;
        v_total_tickets := v_total_tickets + (v_consolidacao_result->>'tickets_migrated')::INTEGER;
      END LOOP;
    END;
  END LOOP;
  
  v_resultado := jsonb_build_object(
    'total_profiles_consolidated', v_total_consolidados,
    'total_rubini_consolidated', v_total_rubini,
    'total_tickets_consolidated', v_total_tickets,
    'consolidation_completed_at', NOW()
  );
  
  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;

\echo '✅ Função principal criada!'

-- ===== FUNÇÃO GET_OR_MERGE_PROFILE_V2 MELHORADA =====

\echo '🔧 Criando get_or_merge_profile_v2 melhorada...'

CREATE OR REPLACE FUNCTION get_or_merge_profile_v2(
  p_twitch_user_id TEXT DEFAULT NULL,
  p_nome TEXT DEFAULT NULL,
  p_twitch_username TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_profile_id UUID;
  v_canonical_id UUID;
  v_duplicate_ids UUID[];
  v_duplicate_id UUID;
  v_consolidacao_result JSONB;
  v_lock_key BIGINT;
BEGIN
  -- Gerar chave de lock baseada nos parâmetros
  v_lock_key := abs(hashtext(COALESCE(p_twitch_user_id, '') || '|' || COALESCE(p_nome, '') || '|' || COALESCE(p_twitch_username, '')));
  
  -- Adquirir lock advisory para evitar condições de corrida
  PERFORM pg_advisory_lock(v_lock_key);
  
  BEGIN
    -- 1. Buscar por twitch_user_id primeiro (mais confiável)
    IF p_twitch_user_id IS NOT NULL AND p_twitch_user_id != '' THEN
      SELECT id INTO v_profile_id
      FROM profiles 
      WHERE twitch_user_id = p_twitch_user_id 
        AND is_active = true
      LIMIT 1;
      
      IF v_profile_id IS NOT NULL THEN
        -- Verificar se há duplicatas por twitch_user_id
        SELECT array_agg(id) INTO v_duplicate_ids
        FROM profiles 
        WHERE twitch_user_id = p_twitch_user_id 
          AND is_active = true 
          AND id != v_profile_id;
        
        -- Consolidar duplicatas encontradas
        IF array_length(v_duplicate_ids, 1) > 0 THEN
          FOREACH v_duplicate_id IN ARRAY v_duplicate_ids LOOP
            SELECT consolidar_dados_usuario_completo(v_duplicate_id, v_profile_id) 
            INTO v_consolidacao_result;
            
            UPDATE profiles 
            SET 
              is_active = false,
              merged_into = v_profile_id,
              updated_at = NOW()
            WHERE id = v_duplicate_id;
            
            INSERT INTO consolidation_audit (
              step_name, action_taken, canonical_id, duplicate_id, 
              consolidation_type, details
            ) VALUES (
              'GET_OR_MERGE_REALTIME',
              'DUPLICATE_MERGED',
              v_profile_id,
              v_duplicate_id,
              'BY_TWITCH_USER_ID',
              v_consolidacao_result
            );
          END LOOP;
        END IF;
        
        PERFORM pg_advisory_unlock(v_lock_key);
        RETURN v_profile_id;
      END IF;
    END IF;
    
    -- 2. Buscar por nome normalizado
    IF p_nome IS NOT NULL AND p_nome != '' THEN
      SELECT id INTO v_profile_id
      FROM profiles 
      WHERE LOWER(TRIM(nome)) = LOWER(TRIM(p_nome))
        AND is_active = true
        AND (twitch_user_id IS NULL OR twitch_user_id = '')
      LIMIT 1;
      
      IF v_profile_id IS NOT NULL THEN
        -- Atualizar com twitch_user_id se fornecido
        IF p_twitch_user_id IS NOT NULL AND p_twitch_user_id != '' THEN
          UPDATE profiles 
          SET 
            twitch_user_id = p_twitch_user_id,
            twitch_username = COALESCE(p_twitch_username, twitch_username),
            updated_at = NOW()
          WHERE id = v_profile_id;
        END IF;
        
        PERFORM pg_advisory_unlock(v_lock_key);
        RETURN v_profile_id;
      END IF;
    END IF;
    
    -- 3. Criar novo perfil se não encontrou
    INSERT INTO profiles (
      twitch_user_id,
      nome,
      twitch_username,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      p_twitch_user_id,
      p_nome,
      p_twitch_username,
      true,
      NOW(),
      NOW()
    ) RETURNING id INTO v_profile_id;
    
    PERFORM pg_advisory_unlock(v_lock_key);
    RETURN v_profile_id;
    
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(v_lock_key);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

\echo '✅ get_or_merge_profile_v2 criada!'

-- ===== CRIAR ÍNDICE ÚNICO PARA PREVENÇÃO =====

\echo '🔒 Criando índice único para prevenção...'

-- Remover índice antigo se existir
DROP INDEX IF EXISTS idx_profiles_unique_twitch_user_id;

-- Criar índice único para twitch_user_id (apenas para ativos e não nulos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_twitch_user_id_active
ON profiles (twitch_user_id) 
WHERE twitch_user_id IS NOT NULL 
  AND twitch_user_id != '' 
  AND is_active = true;

\echo '✅ Índice único criado!'

-- ===== TRIGGER PARA PREVENÇÃO AUTOMÁTICA =====

\echo '🔒 Criando trigger de prevenção...'

CREATE OR REPLACE FUNCTION prevent_duplicate_profiles_v2()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar duplicata por twitch_user_id
  IF NEW.twitch_user_id IS NOT NULL AND NEW.twitch_user_id != '' AND NEW.is_active = true THEN
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE twitch_user_id = NEW.twitch_user_id 
        AND is_active = true 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    ) THEN
      RAISE EXCEPTION 'Duplicate profile detected for twitch_user_id: %', NEW.twitch_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_profiles_v2 ON profiles;
CREATE TRIGGER trigger_prevent_duplicate_profiles_v2
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_profiles_v2();

\echo '✅ Trigger de prevenção criado!'

-- ===== EXECUTAR CONSOLIDAÇÃO DEFINITIVA =====

\echo '🚀 EXECUTANDO CONSOLIDAÇÃO DEFINITIVA...'

SELECT consolidacao_definitiva_usuarios() as resultado_consolidacao;

\echo '✅ CONSOLIDAÇÃO DEFINITIVA CONCLUÍDA!'

-- ===== VERIFICAÇÃO FINAL =====

\echo '🔍 VERIFICAÇÃO FINAL...'

-- Verificar duplicatas restantes
SELECT 
  'DUPLICATAS_TWITCH_USER_ID_RESTANTES' as categoria,
  COUNT(*) as grupos_duplicados,
  COALESCE(SUM(cnt - 1), 0) as total_duplicatas
FROM (
  SELECT twitch_user_id, COUNT(*) as cnt
  FROM profiles
  WHERE twitch_user_id IS NOT NULL 
    AND twitch_user_id != '' 
    AND is_active = true
  GROUP BY twitch_user_id
  HAVING COUNT(*) > 1
) dups;

-- Verificar perfis ativos
SELECT 
  'PERFIS_ATIVOS_FINAL' as categoria,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE twitch_user_id IS NOT NULL AND twitch_user_id != '') as com_twitch_id,
  COUNT(*) FILTER (WHERE twitch_user_id IS NULL OR twitch_user_id = '') as sem_twitch_id
FROM profiles 
WHERE is_active = true;

-- Verificar consolidações realizadas
SELECT 
  'CONSOLIDACOES_REALIZADAS' as categoria,
  COUNT(*) as total_consolidacoes,
  SUM(rubini_consolidated) as total_rubini_consolidado,
  SUM(tickets_consolidated) as total_tickets_consolidado
FROM consolidation_audit;

\echo '🎉 SOLUÇÃO DEFINITIVA APLICADA COM SUCESSO!'
\echo ''
\echo '📊 RESUMO:'
\echo '✅ Funções antigas removidas'
\echo '✅ Consolidação definitiva executada'
\echo '✅ Prevenção automática ativada'
\echo '✅ Índice único criado'
\echo '✅ Sistema limpo e otimizado'