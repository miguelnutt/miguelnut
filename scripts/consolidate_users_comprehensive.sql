-- =====================================================
-- FUNÇÃO: Consolidação Abrangente de Usuários Duplicados
-- =====================================================

CREATE OR REPLACE FUNCTION consolidate_all_duplicate_users()
RETURNS TABLE(
  step_name TEXT,
  action_taken TEXT,
  canonical_id UUID,
  duplicate_id UUID,
  consolidation_type TEXT,
  rubini_coins_consolidated INTEGER,
  tickets_consolidated INTEGER,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dup_record RECORD;
  v_canonical_id UUID;
  v_rc_sum INTEGER;
  v_tickets_sum INTEGER;
  v_count INTEGER := 0;
  v_step_count INTEGER := 1;
BEGIN
  -- ===== ETAPA 1: CONSOLIDAR DUPLICATAS POR TWITCH_USER_ID =====
  step_name := 'ETAPA_1_TWITCH_ID';
  
  FOR v_dup_record IN
    SELECT 
      twitch_user_id,
      ARRAY_AGG(id ORDER BY created_at ASC) as profile_ids,
      COUNT(*) as count
    FROM profiles
    WHERE twitch_user_id IS NOT NULL 
      AND twitch_user_id != ''
      AND is_active = true
    GROUP BY twitch_user_id
    HAVING COUNT(*) > 1
  LOOP
    -- O primeiro perfil (mais antigo) é o canônico
    v_canonical_id := v_dup_record.profile_ids[1];
    
    -- Processar cada duplicata (exceto o canônico)
    FOR i IN 2..array_length(v_dup_record.profile_ids, 1)
    LOOP
      DECLARE
        v_dup_id UUID := v_dup_record.profile_ids[i];
      BEGIN
        -- Obter saldos da duplicata
        SELECT COALESCE(saldo, 0) INTO v_rc_sum
        FROM rubini_coins_balance
        WHERE user_id = v_dup_id;
        
        SELECT COALESCE(tickets_atual, 0) INTO v_tickets_sum
        FROM tickets
        WHERE user_id = v_dup_id;
        
        -- Migrar todos os dados relacionados
        PERFORM consolidate_user_data(v_dup_id, v_canonical_id);
        
        -- Consolidar saldos
        PERFORM consolidate_user_balances(v_dup_id, v_canonical_id, v_rc_sum, v_tickets_sum);
        
        -- Registrar auditoria
        INSERT INTO profile_merge_audit (
          canonical_profile_id,
          duplicate_profile_id,
          rubini_coins_before_duplicate,
          rubini_coins_after_canonical,
          tickets_before_duplicate,
          tickets_after_canonical,
          metadata
        ) VALUES (
          v_canonical_id,
          v_dup_id,
          v_rc_sum,
          COALESCE((SELECT saldo FROM rubini_coins_balance WHERE user_id = v_canonical_id), 0),
          v_tickets_sum,
          COALESCE((SELECT tickets_atual FROM tickets WHERE user_id = v_canonical_id), 0),
          jsonb_build_object(
            'consolidation_type', 'twitch_user_id',
            'twitch_user_id', v_dup_record.twitch_user_id,
            'step', v_step_count
          )
        );
        
        -- Desativar perfil duplicado
        UPDATE profiles 
        SET is_active = false, merged_into = v_canonical_id, updated_at = now()
        WHERE id = v_dup_id;
        
        -- Retornar resultado
        action_taken := 'consolidated_by_twitch_id';
        canonical_id := v_canonical_id;
        duplicate_id := v_dup_id;
        consolidation_type := 'twitch_user_id';
        rubini_coins_consolidated := v_rc_sum;
        tickets_consolidated := v_tickets_sum;
        details := jsonb_build_object(
          'twitch_user_id', v_dup_record.twitch_user_id,
          'total_duplicates_for_twitch_id', v_dup_record.count
        );
        
        v_count := v_count + 1;
        RETURN NEXT;
      END;
    END LOOP;
  END LOOP;
  
  -- ===== ETAPA 2: CONSOLIDAR DUPLICATAS POR NOME (SEM TWITCH_USER_ID) =====
  v_step_count := 2;
  step_name := 'ETAPA_2_NOME';
  
  FOR v_dup_record IN
    SELECT 
      LOWER(TRIM(nome)) as nome_normalizado,
      ARRAY_AGG(id ORDER BY created_at ASC) as profile_ids,
      COUNT(*) as count
    FROM profiles
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
      AND is_active = true
      AND nome IS NOT NULL
      AND TRIM(nome) != ''
    GROUP BY LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
  LOOP
    -- O primeiro perfil (mais antigo) é o canônico
    v_canonical_id := v_dup_record.profile_ids[1];
    
    -- Processar cada duplicata (exceto o canônico)
    FOR i IN 2..array_length(v_dup_record.profile_ids, 1)
    LOOP
      DECLARE
        v_dup_id UUID := v_dup_record.profile_ids[i];
      BEGIN
        -- Obter saldos da duplicata
        SELECT COALESCE(saldo, 0) INTO v_rc_sum
        FROM rubini_coins_balance
        WHERE user_id = v_dup_id;
        
        SELECT COALESCE(tickets_atual, 0) INTO v_tickets_sum
        FROM tickets
        WHERE user_id = v_dup_id;
        
        -- Migrar todos os dados relacionados
        PERFORM consolidate_user_data(v_dup_id, v_canonical_id);
        
        -- Consolidar saldos
        PERFORM consolidate_user_balances(v_dup_id, v_canonical_id, v_rc_sum, v_tickets_sum);
        
        -- Registrar auditoria
        INSERT INTO profile_merge_audit (
          canonical_profile_id,
          duplicate_profile_id,
          rubini_coins_before_duplicate,
          rubini_coins_after_canonical,
          tickets_before_duplicate,
          tickets_after_canonical,
          metadata
        ) VALUES (
          v_canonical_id,
          v_dup_id,
          v_rc_sum,
          COALESCE((SELECT saldo FROM rubini_coins_balance WHERE user_id = v_canonical_id), 0),
          v_tickets_sum,
          COALESCE((SELECT tickets_atual FROM tickets WHERE user_id = v_canonical_id), 0),
          jsonb_build_object(
            'consolidation_type', 'nome',
            'nome_normalizado', v_dup_record.nome_normalizado,
            'step', v_step_count
          )
        );
        
        -- Desativar perfil duplicado
        UPDATE profiles 
        SET is_active = false, merged_into = v_canonical_id, updated_at = now()
        WHERE id = v_dup_id;
        
        -- Retornar resultado
        action_taken := 'consolidated_by_name';
        canonical_id := v_canonical_id;
        duplicate_id := v_dup_id;
        consolidation_type := 'nome';
        rubini_coins_consolidated := v_rc_sum;
        tickets_consolidated := v_tickets_sum;
        details := jsonb_build_object(
          'nome_normalizado', v_dup_record.nome_normalizado,
          'total_duplicates_for_name', v_dup_record.count
        );
        
        v_count := v_count + 1;
        RETURN NEXT;
      END;
    END LOOP;
  END LOOP;
  
  -- ===== ETAPA 3: CONSOLIDAR DUPLICATAS POR TWITCH_USERNAME (SEM TWITCH_USER_ID) =====
  v_step_count := 3;
  step_name := 'ETAPA_3_TWITCH_USERNAME';
  
  FOR v_dup_record IN
    SELECT 
      LOWER(TRIM(twitch_username)) as twitch_username_normalizado,
      ARRAY_AGG(id ORDER BY created_at ASC) as profile_ids,
      COUNT(*) as count
    FROM profiles
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
      AND is_active = true
      AND twitch_username IS NOT NULL
      AND TRIM(twitch_username) != ''
    GROUP BY LOWER(TRIM(twitch_username))
    HAVING COUNT(*) > 1
  LOOP
    -- O primeiro perfil (mais antigo) é o canônico
    v_canonical_id := v_dup_record.profile_ids[1];
    
    -- Processar cada duplicata (exceto o canônico)
    FOR i IN 2..array_length(v_dup_record.profile_ids, 1)
    LOOP
      DECLARE
        v_dup_id UUID := v_dup_record.profile_ids[i];
      BEGIN
        -- Obter saldos da duplicata
        SELECT COALESCE(saldo, 0) INTO v_rc_sum
        FROM rubini_coins_balance
        WHERE user_id = v_dup_id;
        
        SELECT COALESCE(tickets_atual, 0) INTO v_tickets_sum
        FROM tickets
        WHERE user_id = v_dup_id;
        
        -- Migrar todos os dados relacionados
        PERFORM consolidate_user_data(v_dup_id, v_canonical_id);
        
        -- Consolidar saldos
        PERFORM consolidate_user_balances(v_dup_id, v_canonical_id, v_rc_sum, v_tickets_sum);
        
        -- Registrar auditoria
        INSERT INTO profile_merge_audit (
          canonical_profile_id,
          duplicate_profile_id,
          rubini_coins_before_duplicate,
          rubini_coins_after_canonical,
          tickets_before_duplicate,
          tickets_after_canonical,
          metadata
        ) VALUES (
          v_canonical_id,
          v_dup_id,
          v_rc_sum,
          COALESCE((SELECT saldo FROM rubini_coins_balance WHERE user_id = v_canonical_id), 0),
          v_tickets_sum,
          COALESCE((SELECT tickets_atual FROM tickets WHERE user_id = v_canonical_id), 0),
          jsonb_build_object(
            'consolidation_type', 'twitch_username',
            'twitch_username_normalizado', v_dup_record.twitch_username_normalizado,
            'step', v_step_count
          )
        );
        
        -- Desativar perfil duplicado
        UPDATE profiles 
        SET is_active = false, merged_into = v_canonical_id, updated_at = now()
        WHERE id = v_dup_id;
        
        -- Retornar resultado
        action_taken := 'consolidated_by_twitch_username';
        canonical_id := v_canonical_id;
        duplicate_id := v_dup_id;
        consolidation_type := 'twitch_username';
        rubini_coins_consolidated := v_rc_sum;
        tickets_consolidated := v_tickets_sum;
        details := jsonb_build_object(
          'twitch_username_normalizado', v_dup_record.twitch_username_normalizado,
          'total_duplicates_for_username', v_dup_record.count
        );
        
        v_count := v_count + 1;
        RETURN NEXT;
      END;
    END LOOP;
  END LOOP;
  
  -- ===== RESULTADO FINAL =====
  step_name := 'RESUMO_FINAL';
  action_taken := 'consolidation_completed';
  details := jsonb_build_object(
    'total_profiles_consolidated', v_count,
    'completed_at', now()
  );
  
  RETURN NEXT;
END;
$$;

-- ===== FUNÇÕES AUXILIARES =====

-- Função para migrar dados relacionados de um usuário para outro
CREATE OR REPLACE FUNCTION consolidate_user_data(
  p_source_user_id UUID,
  p_target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Migrar históricos e dados relacionados
  UPDATE ticket_ledger SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE rubini_coins_history SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE daily_rewards_history SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE tibiatermo_user_games SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE spins SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE chat_messages SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE rubini_coins_resgates SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE raffles SET vencedor_id = p_target_user_id WHERE vencedor_id = p_source_user_id;
  UPDATE user_daily_logins SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE creditos_provisorios SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  
  -- Migrar aliases se existir a tabela
  UPDATE user_aliases SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
END;
$$;

-- Função para consolidar saldos
CREATE OR REPLACE FUNCTION consolidate_user_balances(
  p_source_user_id UUID,
  p_target_user_id UUID,
  p_rc_amount INTEGER,
  p_tickets_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deletar balances da duplicata
  DELETE FROM rubini_coins_balance WHERE user_id = p_source_user_id;
  DELETE FROM tickets WHERE user_id = p_source_user_id;
  
  -- Consolidar Rubini Coins no perfil canônico
  IF p_rc_amount > 0 THEN
    INSERT INTO rubini_coins_balance (user_id, saldo)
    VALUES (p_target_user_id, p_rc_amount)
    ON CONFLICT (user_id) 
    DO UPDATE SET saldo = rubini_coins_balance.saldo + EXCLUDED.saldo;
    
    -- Registrar transação de consolidação
    INSERT INTO rubini_coins_history (user_id, variacao, motivo, origem, status)
    VALUES (p_target_user_id, p_rc_amount, 'Consolidação de duplicata ' || p_source_user_id, 'system_consolidation', 'confirmado');
  END IF;
  
  -- Consolidar Tickets no perfil canônico
  IF p_tickets_amount > 0 THEN
    INSERT INTO tickets (user_id, tickets_atual)
    VALUES (p_target_user_id, p_tickets_amount)
    ON CONFLICT (user_id) 
    DO UPDATE SET tickets_atual = tickets.tickets_atual + EXCLUDED.tickets_atual;
    
    -- Registrar transação de consolidação
    INSERT INTO ticket_ledger (user_id, variacao, motivo, origem, status)
    VALUES (p_target_user_id, p_tickets_amount, 'Consolidação de duplicata ' || p_source_user_id, 'system_consolidation', 'confirmado');
  END IF;
END;
$$;

-- Comentários das funções
COMMENT ON FUNCTION consolidate_all_duplicate_users() IS 'Consolida todos os usuários duplicados em 3 etapas: por twitch_user_id, por nome, e por twitch_username';
COMMENT ON FUNCTION consolidate_user_data(UUID, UUID) IS 'Migra todos os dados relacionados de um usuário para outro';
COMMENT ON FUNCTION consolidate_user_balances(UUID, UUID, INTEGER, INTEGER) IS 'Consolida saldos de Rubini Coins e Tickets entre usuários';