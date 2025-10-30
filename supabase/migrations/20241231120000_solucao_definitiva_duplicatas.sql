-- =====================================================
-- MIGRATION: SOLUÇÃO DEFINITIVA PARA DUPLICATAS
-- =====================================================
-- Esta migration resolve TODOS os problemas de duplicatas
-- de uma vez por todas, preservando históricos
-- =====================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== BACKUP E AUDITORIA =====

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

-- ===== FUNÇÃO AUXILIAR: CONSOLIDAR DADOS COMPLETOS =====

CREATE OR REPLACE FUNCTION consolidar_dados_usuario_completo(
  p_source_user_id UUID,
  p_target_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_rubini_source DECIMAL(10,2) := 0;
  v_tickets_source INTEGER := 0;
  v_rubini_target DECIMAL(10,2) := 0;
  v_tickets_target INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Obter saldos atuais
  SELECT COALESCE(balance, 0) INTO v_rubini_source 
  FROM rubini_coins_balance WHERE user_id = p_source_user_id;
  
  SELECT COALESCE(balance, 0) INTO v_tickets_source 
  FROM tickets WHERE user_id = p_source_user_id;
  
  SELECT COALESCE(balance, 0) INTO v_rubini_target 
  FROM rubini_coins_balance WHERE user_id = p_target_user_id;
  
  SELECT COALESCE(balance, 0) INTO v_tickets_target 
  FROM tickets WHERE user_id = p_target_user_id;

  -- Migrar dados relacionados
  
  -- 1. Ticket Ledger
  UPDATE ticket_ledger SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- 2. Rubini Coins History
  UPDATE rubini_coins_history SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- 3. Daily Rewards
  UPDATE daily_rewards SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- 4. Game Data
  UPDATE game_data SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- 5. Spins
  UPDATE spins SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- 6. Chat Messages
  UPDATE chat_messages SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- 7. Rubini Coins Redemptions
  UPDATE rubini_coins_redemptions SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- 8. Raffles
  UPDATE raffles SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- 9. User Daily Logins
  UPDATE user_daily_logins SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- 10. Temporary Credits
  UPDATE temporary_credits SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;
  
  -- 11. User Aliases
  UPDATE user_aliases SET user_id = p_target_user_id 
  WHERE user_id = p_source_user_id;

  -- Consolidar saldos
  
  -- Rubini Coins
  IF v_rubini_source > 0 THEN
    INSERT INTO rubini_coins_balance (user_id, balance, updated_at)
    VALUES (p_target_user_id, v_rubini_target + v_rubini_source, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      balance = rubini_coins_balance.balance + v_rubini_source,
      updated_at = NOW();
      
    -- Registrar transação
    INSERT INTO rubini_coins_history (user_id, amount, transaction_type, description)
    VALUES (p_target_user_id, v_rubini_source, 'consolidation', 'Consolidação de perfil duplicado');
  END IF;
  
  -- Tickets
  IF v_tickets_source > 0 THEN
    INSERT INTO tickets (user_id, balance, updated_at)
    VALUES (p_target_user_id, v_tickets_target + v_tickets_source, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      balance = tickets.balance + v_tickets_source,
      updated_at = NOW();
      
    -- Registrar transação
    INSERT INTO ticket_ledger (user_id, amount, transaction_type, description)
    VALUES (p_target_user_id, v_tickets_source, 'consolidation', 'Consolidação de perfil duplicado');
  END IF;
  
  -- Remover saldos do perfil origem
  DELETE FROM rubini_coins_balance WHERE user_id = p_source_user_id;
  DELETE FROM tickets WHERE user_id = p_source_user_id;
  
  v_result := jsonb_build_object(
    'rubini_migrated', v_rubini_source,
    'tickets_migrated', v_tickets_source,
    'new_rubini_total', v_rubini_target + v_rubini_source,
    'new_tickets_total', v_tickets_target + v_tickets_source
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ===== FUNÇÃO PRINCIPAL: CONSOLIDAÇÃO DEFINITIVA =====

CREATE OR REPLACE FUNCTION consolidacao_definitiva_usuarios()
RETURNS TABLE(
  etapa TEXT,
  acao TEXT,
  perfil_canonico UUID,
  perfil_duplicado UUID,
  criterio TEXT,
  rubini_consolidado DECIMAL(10,2),
  tickets_consolidados INTEGER,
  detalhes JSONB
) AS $$
DECLARE
  v_canonical_profile RECORD;
  v_duplicate_profile RECORD;
  v_consolidation_result JSONB;
  v_step_counter INTEGER := 0;
BEGIN
  -- ===== ETAPA 1: CONSOLIDAR POR TWITCH_USER_ID =====
  
  FOR v_canonical_profile IN
    SELECT 
      twitch_user_id,
      MIN(id) as canonical_id,
      ARRAY_AGG(id ORDER BY 
        CASE WHEN nome_personagem IS NOT NULL AND nome_personagem != '' THEN 0 ELSE 1 END,
        created_at
      ) as all_ids
    FROM profiles
    WHERE twitch_user_id IS NOT NULL 
      AND twitch_user_id != ''
      AND is_active = true
    GROUP BY twitch_user_id
    HAVING COUNT(*) > 1
  LOOP
    v_step_counter := v_step_counter + 1;
    
    -- Selecionar perfil canônico (com nome_personagem ou mais antigo)
    SELECT * INTO v_canonical_profile
    FROM profiles
    WHERE id = ANY(v_canonical_profile.all_ids)
      AND is_active = true
    ORDER BY 
      CASE WHEN nome_personagem IS NOT NULL AND nome_personagem != '' THEN 0 ELSE 1 END,
      created_at
    LIMIT 1;
    
    -- Processar duplicatas
    FOR v_duplicate_profile IN
      SELECT * FROM profiles
      WHERE id = ANY(v_canonical_profile.all_ids)
        AND id != v_canonical_profile.canonical_id
        AND is_active = true
    LOOP
      -- Consolidar dados
      v_consolidation_result := consolidar_dados_usuario_completo(
        v_duplicate_profile.id,
        v_canonical_profile.canonical_id
      );
      
      -- Registrar auditoria
      INSERT INTO consolidation_audit (
        step_name, action_taken, canonical_id, duplicate_id,
        consolidation_type, rubini_consolidated, tickets_consolidated, details
      ) VALUES (
        'ETAPA_1_TWITCH_USER_ID',
        'CONSOLIDACAO_DUPLICATA',
        v_canonical_profile.canonical_id,
        v_duplicate_profile.id,
        'BY_TWITCH_USER_ID',
        (v_consolidation_result->>'rubini_migrated')::DECIMAL,
        (v_consolidation_result->>'tickets_migrated')::INTEGER,
        v_consolidation_result
      );
      
      -- Desativar perfil duplicado
      UPDATE profiles SET 
        is_active = false,
        merged_into = v_canonical_profile.canonical_id,
        updated_at = NOW()
      WHERE id = v_duplicate_profile.id;
      
      -- Retornar resultado
      etapa := 'ETAPA_1_TWITCH_USER_ID';
      acao := 'CONSOLIDACAO_DUPLICATA';
      perfil_canonico := v_canonical_profile.canonical_id;
      perfil_duplicado := v_duplicate_profile.id;
      criterio := 'BY_TWITCH_USER_ID';
      rubini_consolidado := (v_consolidation_result->>'rubini_migrated')::DECIMAL;
      tickets_consolidados := (v_consolidation_result->>'tickets_migrated')::INTEGER;
      detalhes := v_consolidation_result;
      
      RETURN NEXT;
    END LOOP;
  END LOOP;
  
  -- ===== ETAPA 2: CONSOLIDAR POR NOME (SEM TWITCH_USER_ID) =====
  
  FOR v_canonical_profile IN
    SELECT 
      LOWER(TRIM(nome)) as nome_normalizado,
      MIN(id) as canonical_id,
      ARRAY_AGG(id ORDER BY created_at) as all_ids
    FROM profiles
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
      AND nome IS NOT NULL 
      AND nome != ''
      AND is_active = true
    GROUP BY LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
  LOOP
    v_step_counter := v_step_counter + 1;
    
    -- Selecionar perfil canônico (mais antigo)
    SELECT * INTO v_canonical_profile
    FROM profiles
    WHERE id = ANY(v_canonical_profile.all_ids)
      AND is_active = true
    ORDER BY created_at
    LIMIT 1;
    
    -- Processar duplicatas
    FOR v_duplicate_profile IN
      SELECT * FROM profiles
      WHERE id = ANY(v_canonical_profile.all_ids)
        AND id != v_canonical_profile.canonical_id
        AND is_active = true
    LOOP
      -- Consolidar dados
      v_consolidation_result := consolidar_dados_usuario_completo(
        v_duplicate_profile.id,
        v_canonical_profile.canonical_id
      );
      
      -- Registrar auditoria
      INSERT INTO consolidation_audit (
        step_name, action_taken, canonical_id, duplicate_id,
        consolidation_type, rubini_consolidated, tickets_consolidated, details
      ) VALUES (
        'ETAPA_2_NOME_NORMALIZADO',
        'CONSOLIDACAO_DUPLICATA',
        v_canonical_profile.canonical_id,
        v_duplicate_profile.id,
        'BY_NORMALIZED_NAME',
        (v_consolidation_result->>'rubini_migrated')::DECIMAL,
        (v_consolidation_result->>'tickets_migrated')::INTEGER,
        v_consolidation_result
      );
      
      -- Desativar perfil duplicado
      UPDATE profiles SET 
        is_active = false,
        merged_into = v_canonical_profile.canonical_id,
        updated_at = NOW()
      WHERE id = v_duplicate_profile.id;
      
      -- Retornar resultado
      etapa := 'ETAPA_2_NOME_NORMALIZADO';
      acao := 'CONSOLIDACAO_DUPLICATA';
      perfil_canonico := v_canonical_profile.canonical_id;
      perfil_duplicado := v_duplicate_profile.id;
      criterio := 'BY_NORMALIZED_NAME';
      rubini_consolidado := (v_consolidation_result->>'rubini_migrated')::DECIMAL;
      tickets_consolidados := (v_consolidation_result->>'tickets_migrated')::INTEGER;
      detalhes := v_consolidation_result;
      
      RETURN NEXT;
    END LOOP;
  END LOOP;
  
  -- ===== ETAPA 3: CONSOLIDAR POR TWITCH_USERNAME (SEM TWITCH_USER_ID) =====
  
  FOR v_canonical_profile IN
    SELECT 
      LOWER(TRIM(twitch_username)) as twitch_username_normalizado,
      MIN(id) as canonical_id,
      ARRAY_AGG(id ORDER BY created_at) as all_ids
    FROM profiles
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
      AND twitch_username IS NOT NULL 
      AND twitch_username != ''
      AND is_active = true
    GROUP BY LOWER(TRIM(twitch_username))
    HAVING COUNT(*) > 1
  LOOP
    v_step_counter := v_step_counter + 1;
    
    -- Selecionar perfil canônico (mais antigo)
    SELECT * INTO v_canonical_profile
    FROM profiles
    WHERE id = ANY(v_canonical_profile.all_ids)
      AND is_active = true
    ORDER BY created_at
    LIMIT 1;
    
    -- Processar duplicatas
    FOR v_duplicate_profile IN
      SELECT * FROM profiles
      WHERE id = ANY(v_canonical_profile.all_ids)
        AND id != v_canonical_profile.canonical_id
        AND is_active = true
    LOOP
      -- Consolidar dados
      v_consolidation_result := consolidar_dados_usuario_completo(
        v_duplicate_profile.id,
        v_canonical_profile.canonical_id
      );
      
      -- Registrar auditoria
      INSERT INTO consolidation_audit (
        step_name, action_taken, canonical_id, duplicate_id,
        consolidation_type, rubini_consolidated, tickets_consolidated, details
      ) VALUES (
        'ETAPA_3_TWITCH_USERNAME',
        'CONSOLIDACAO_DUPLICATA',
        v_canonical_profile.canonical_id,
        v_duplicate_profile.id,
        'BY_TWITCH_USERNAME',
        (v_consolidation_result->>'rubini_migrated')::DECIMAL,
        (v_consolidation_result->>'tickets_migrated')::INTEGER,
        v_consolidation_result
      );
      
      -- Desativar perfil duplicado
      UPDATE profiles SET 
        is_active = false,
        merged_into = v_canonical_profile.canonical_id,
        updated_at = NOW()
      WHERE id = v_duplicate_profile.id;
      
      -- Retornar resultado
      etapa := 'ETAPA_3_TWITCH_USERNAME';
      acao := 'CONSOLIDACAO_DUPLICATA';
      perfil_canonico := v_canonical_profile.canonical_id;
      perfil_duplicado := v_duplicate_profile.id;
      criterio := 'BY_TWITCH_USERNAME';
      rubini_consolidado := (v_consolidation_result->>'rubini_migrated')::DECIMAL;
      tickets_consolidados := (v_consolidation_result->>'tickets_migrated')::INTEGER;
      detalhes := v_consolidation_result;
      
      RETURN NEXT;
    END LOOP;
  END LOOP;
  
  -- Registrar conclusão
  INSERT INTO consolidation_audit (
    step_name, action_taken, details
  ) VALUES (
    'CONSOLIDACAO_DEFINITIVA_CONCLUIDA',
    'PROCESSO_FINALIZADO',
    jsonb_build_object(
      'total_steps', v_step_counter,
      'completed_at', NOW()
    )
  );
  
END;
$$ LANGUAGE plpgsql;

-- ===== FUNÇÃO DE VERIFICAÇÃO DE INTEGRIDADE =====

CREATE OR REPLACE FUNCTION verificar_integridade_pos_consolidacao()
RETURNS TABLE(
  verificacao TEXT,
  status TEXT,
  detalhes JSONB
) AS $$
BEGIN
  -- Verificar duplicatas por twitch_user_id
  verificacao := 'DUPLICATAS_TWITCH_USER_ID';
  SELECT 
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERRO' END,
    jsonb_build_object(
      'grupos_duplicados', COUNT(*),
      'detalhes', COALESCE(jsonb_agg(jsonb_build_object('twitch_user_id', twitch_user_id, 'count', cnt)), '[]'::jsonb)
    )
  INTO status, detalhes
  FROM (
    SELECT twitch_user_id, COUNT(*) as cnt
    FROM profiles
    WHERE twitch_user_id IS NOT NULL 
      AND twitch_user_id != '' 
      AND is_active = true
    GROUP BY twitch_user_id
    HAVING COUNT(*) > 1
  ) dups;
  
  RETURN NEXT;
  
  -- Verificar saldos órfãos
  verificacao := 'SALDOS_ORFAOS';
  SELECT 
    CASE WHEN (
      (SELECT COUNT(*) FROM rubini_coins_balance rcb LEFT JOIN profiles p ON rcb.user_id = p.id WHERE p.id IS NULL OR p.is_active = false) +
      (SELECT COUNT(*) FROM tickets t LEFT JOIN profiles p ON t.user_id = p.id WHERE p.id IS NULL OR p.is_active = false)
    ) = 0 THEN 'OK' ELSE 'ERRO' END,
    jsonb_build_object(
      'rubini_orfaos', (SELECT COUNT(*) FROM rubini_coins_balance rcb LEFT JOIN profiles p ON rcb.user_id = p.id WHERE p.id IS NULL OR p.is_active = false),
      'tickets_orfaos', (SELECT COUNT(*) FROM tickets t LEFT JOIN profiles p ON t.user_id = p.id WHERE p.id IS NULL OR p.is_active = false)
    )
  INTO status, detalhes;
  
  RETURN NEXT;
  
  -- Verificar integridade geral
  verificacao := 'INTEGRIDADE_GERAL';
  SELECT 
    'OK',
    jsonb_build_object(
      'perfis_ativos', (SELECT COUNT(*) FROM profiles WHERE is_active = true),
      'perfis_consolidados', (SELECT COUNT(*) FROM profiles WHERE is_active = false AND merged_into IS NOT NULL),
      'total_auditoria', (SELECT COUNT(*) FROM consolidation_audit),
      'backup_disponivel', (SELECT COUNT(*) FROM profiles_backup_pre_consolidation)
    )
  INTO status, detalhes;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ===== FUNÇÃO GET_OR_MERGE_PROFILE_V2 MELHORADA =====

CREATE OR REPLACE FUNCTION get_or_merge_profile_v2(
  p_twitch_user_id TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_twitch_username TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_profile_id UUID;
  v_existing_profile RECORD;
  v_duplicate_profile RECORD;
  v_consolidation_result JSONB;
  v_lock_key BIGINT;
BEGIN
  -- Validar entrada
  IF p_twitch_user_id IS NULL OR p_twitch_user_id = '' THEN
    RAISE EXCEPTION 'twitch_user_id não pode ser nulo ou vazio';
  END IF;
  
  -- Criar chave de lock baseada no twitch_user_id
  v_lock_key := abs(hashtext(p_twitch_user_id));
  
  -- Adquirir lock para prevenir condições de corrida
  PERFORM pg_advisory_lock(v_lock_key);
  
  BEGIN
    -- Buscar perfil ativo por twitch_user_id
    SELECT * INTO v_existing_profile
    FROM profiles
    WHERE twitch_user_id = p_twitch_user_id
      AND is_active = true
    ORDER BY 
      CASE WHEN nome_personagem IS NOT NULL AND nome_personagem != '' THEN 0 ELSE 1 END,
      created_at
    LIMIT 1;
    
    IF FOUND THEN
      -- Verificar se há duplicatas ativas com o mesmo twitch_user_id
      FOR v_duplicate_profile IN
        SELECT * FROM profiles
        WHERE twitch_user_id = p_twitch_user_id
          AND is_active = true
          AND id != v_existing_profile.id
      LOOP
        -- Consolidar duplicata automaticamente
        v_consolidation_result := consolidar_dados_usuario_completo(
          v_duplicate_profile.id,
          v_existing_profile.id
        );
        
        -- Registrar auditoria
        INSERT INTO consolidation_audit (
          step_name, action_taken, canonical_id, duplicate_id,
          consolidation_type, rubini_consolidated, tickets_consolidated, details
        ) VALUES (
          'GET_OR_MERGE_AUTO_CONSOLIDATION',
          'CONSOLIDACAO_AUTOMATICA',
          v_existing_profile.id,
          v_duplicate_profile.id,
          'BY_TWITCH_USER_ID_REALTIME',
          (v_consolidation_result->>'rubini_migrated')::DECIMAL,
          (v_consolidation_result->>'tickets_migrated')::INTEGER,
          v_consolidation_result
        );
        
        -- Desativar duplicata
        UPDATE profiles SET 
          is_active = false,
          merged_into = v_existing_profile.id,
          updated_at = NOW()
        WHERE id = v_duplicate_profile.id;
      END LOOP;
      
      -- Atualizar informações se necessário
      IF p_display_name IS NOT NULL AND p_display_name != COALESCE(v_existing_profile.nome, '') THEN
        -- Salvar alias antigo se diferente
        IF v_existing_profile.nome IS NOT NULL AND v_existing_profile.nome != '' AND v_existing_profile.nome != p_display_name THEN
          INSERT INTO user_aliases (user_id, alias_name, alias_type, created_at)
          VALUES (v_existing_profile.id, v_existing_profile.nome, 'old_display_name', NOW())
          ON CONFLICT (user_id, alias_name, alias_type) DO NOTHING;
        END IF;
        
        UPDATE profiles SET 
          nome = p_display_name,
          updated_at = NOW()
        WHERE id = v_existing_profile.id;
      END IF;
      
      IF p_twitch_username IS NOT NULL AND p_twitch_username != COALESCE(v_existing_profile.twitch_username, '') THEN
        UPDATE profiles SET 
          twitch_username = p_twitch_username,
          updated_at = NOW()
        WHERE id = v_existing_profile.id;
      END IF;
      
      v_profile_id := v_existing_profile.id;
    ELSE
      -- Buscar perfil órfão por nome ou twitch_username
      SELECT * INTO v_existing_profile
      FROM profiles
      WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
        AND is_active = true
        AND (
          (p_display_name IS NOT NULL AND LOWER(TRIM(nome)) = LOWER(TRIM(p_display_name))) OR
          (p_twitch_username IS NOT NULL AND LOWER(TRIM(twitch_username)) = LOWER(TRIM(p_twitch_username)))
        )
      ORDER BY created_at
      LIMIT 1;
      
      IF FOUND THEN
        -- Atualizar perfil órfão com twitch_user_id
        UPDATE profiles SET 
          twitch_user_id = p_twitch_user_id,
          nome = COALESCE(p_display_name, nome),
          twitch_username = COALESCE(p_twitch_username, twitch_username),
          updated_at = NOW()
        WHERE id = v_existing_profile.id;
        
        -- Verificar e consolidar duplicatas criadas por esta atualização
        FOR v_duplicate_profile IN
          SELECT * FROM profiles
          WHERE twitch_user_id = p_twitch_user_id
            AND is_active = true
            AND id != v_existing_profile.id
        LOOP
          v_consolidation_result := consolidar_dados_usuario_completo(
            v_duplicate_profile.id,
            v_existing_profile.id
          );
          
          INSERT INTO consolidation_audit (
            step_name, action_taken, canonical_id, duplicate_id,
            consolidation_type, rubini_consolidated, tickets_consolidated, details
          ) VALUES (
            'GET_OR_MERGE_ORPHAN_CONSOLIDATION',
            'CONSOLIDACAO_ORFAO',
            v_existing_profile.id,
            v_duplicate_profile.id,
            'ORPHAN_UPDATE_CONSOLIDATION',
            (v_consolidation_result->>'rubini_migrated')::DECIMAL,
            (v_consolidation_result->>'tickets_migrated')::INTEGER,
            v_consolidation_result
          );
          
          UPDATE profiles SET 
            is_active = false,
            merged_into = v_existing_profile.id,
            updated_at = NOW()
          WHERE id = v_duplicate_profile.id;
        END LOOP;
        
        v_profile_id := v_existing_profile.id;
      ELSE
        -- Criar novo perfil
        v_profile_id := gen_random_uuid();
        
        INSERT INTO profiles (
          id, twitch_user_id, nome, twitch_username, is_active, created_at, updated_at
        ) VALUES (
          v_profile_id, p_twitch_user_id, p_display_name, p_twitch_username, true, NOW(), NOW()
        );
        
        -- Inicializar saldos
        INSERT INTO rubini_coins_balance (user_id, balance, updated_at)
        VALUES (v_profile_id, 0, NOW())
        ON CONFLICT (user_id) DO NOTHING;
        
        INSERT INTO tickets (user_id, balance, updated_at)
        VALUES (v_profile_id, 0, NOW())
        ON CONFLICT (user_id) DO NOTHING;
      END IF;
    END IF;
    
    -- Liberar lock
    PERFORM pg_advisory_unlock(v_lock_key);
    
    RETURN v_profile_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Liberar lock em caso de erro
    PERFORM pg_advisory_unlock(v_lock_key);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- ===== FUNÇÃO DE LIMPEZA AUTOMÁTICA =====

CREATE OR REPLACE FUNCTION auto_cleanup_duplicates()
RETURNS TABLE(
  perfis_processados INTEGER,
  duplicatas_encontradas INTEGER,
  consolidacoes_realizadas INTEGER
) AS $$
DECLARE
  v_processed INTEGER := 0;
  v_duplicates INTEGER := 0;
  v_consolidations INTEGER := 0;
  v_twitch_user_id TEXT;
BEGIN
  -- Processar cada twitch_user_id com duplicatas
  FOR v_twitch_user_id IN
    SELECT DISTINCT p.twitch_user_id
    FROM profiles p
    WHERE p.twitch_user_id IS NOT NULL 
      AND p.twitch_user_id != ''
      AND p.is_active = true
    GROUP BY p.twitch_user_id
    HAVING COUNT(*) > 1
  LOOP
    v_processed := v_processed + 1;
    
    -- Contar duplicatas antes
    SELECT COUNT(*) - 1 INTO v_duplicates
    FROM profiles
    WHERE twitch_user_id = v_twitch_user_id
      AND is_active = true;
    
    -- Executar get_or_merge_profile_v2 para consolidar
    PERFORM get_or_merge_profile_v2(v_twitch_user_id, NULL, NULL);
    
    v_consolidations := v_consolidations + v_duplicates;
  END LOOP;
  
  perfis_processados := v_processed;
  duplicatas_encontradas := v_consolidations;
  consolidacoes_realizadas := v_consolidations;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ===== CONSTRAINTS E PREVENÇÕES =====

-- Índice único para prevenir duplicatas por twitch_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_twitch_user_id 
ON profiles (twitch_user_id) 
WHERE is_active = true AND twitch_user_id IS NOT NULL AND twitch_user_id != '';

-- Trigger para prevenir criação de duplicatas
CREATE OR REPLACE FUNCTION trigger_prevent_duplicate_profiles()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se já existe perfil ativo com este twitch_user_id
  IF NEW.twitch_user_id IS NOT NULL AND NEW.twitch_user_id != '' AND NEW.is_active = true THEN
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE twitch_user_id = NEW.twitch_user_id 
        AND is_active = true 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    ) THEN
      RAISE EXCEPTION 'Perfil ativo já existe para twitch_user_id: %. Use get_or_merge_profile_v2() para consolidar.', NEW.twitch_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_profiles ON profiles;
CREATE TRIGGER trigger_prevent_duplicate_profiles
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_prevent_duplicate_profiles();

-- ===== EXECUTAR CONSOLIDAÇÃO DEFINITIVA =====

-- Executar a consolidação
SELECT 
  etapa,
  acao,
  perfil_canonico,
  perfil_duplicado,
  criterio,
  rubini_consolidado,
  tickets_consolidados
FROM consolidacao_definitiva_usuarios();

-- Verificar integridade
SELECT 
  verificacao,
  status,
  detalhes
FROM verificar_integridade_pos_consolidacao();

-- ===== COMENTÁRIOS FINAIS =====

COMMENT ON FUNCTION consolidacao_definitiva_usuarios() IS 'Função principal que consolida TODOS os usuários duplicados preservando históricos';
COMMENT ON FUNCTION consolidar_dados_usuario_completo(UUID, UUID) IS 'Função auxiliar que migra todos os dados de um usuário para outro';
COMMENT ON FUNCTION verificar_integridade_pos_consolidacao() IS 'Função de verificação da integridade após consolidação';
COMMENT ON FUNCTION get_or_merge_profile_v2(TEXT, TEXT, TEXT) IS 'Função melhorada que previne duplicatas em tempo real';
COMMENT ON FUNCTION auto_cleanup_duplicates() IS 'Função de limpeza automática para executar periodicamente';

COMMENT ON TABLE profiles_backup_pre_consolidation IS 'Backup dos perfis antes da consolidação definitiva';
COMMENT ON TABLE consolidation_audit IS 'Auditoria completa de todas as consolidações realizadas';

-- Registrar conclusão da migration
INSERT INTO consolidation_audit (
  step_name, action_taken, details
) VALUES (
  'MIGRATION_APLICADA',
  'SOLUCAO_DEFINITIVA_IMPLEMENTADA',
  jsonb_build_object(
    'migration_file', '20241231120000_solucao_definitiva_duplicatas.sql',
    'applied_at', NOW(),
    'status', 'SUCCESS'
  )
);