-- =====================================================
-- MIGRAÇÃO FINAL: Resolução Definitiva de Duplicação de Usuários
-- Data: 2024-12-31
-- Objetivo: Eliminar todas as duplicações e prevenir futuras
-- =====================================================

-- ===== PARTE 1: EXECUTAR CONSOLIDAÇÃO ABRANGENTE =====

-- Incluir as funções auxiliares de consolidação
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_aliases') THEN
    UPDATE user_aliases SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  END IF;
END;
$$;

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

-- Função principal de consolidação
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

-- ===== PARTE 2: EXECUTAR A CONSOLIDAÇÃO =====
-- Executar a consolidação de todos os usuários duplicados
DO $$
DECLARE
  v_result RECORD;
  v_total_consolidated INTEGER := 0;
BEGIN
  RAISE NOTICE 'Iniciando consolidação de usuários duplicados...';
  
  FOR v_result IN SELECT * FROM consolidate_all_duplicate_users()
  LOOP
    IF v_result.action_taken LIKE 'consolidated_%' THEN
      v_total_consolidated := v_total_consolidated + 1;
      RAISE NOTICE 'Consolidado: % -> % (Tipo: %, RC: %, Tickets: %)', 
        v_result.duplicate_id, 
        v_result.canonical_id, 
        v_result.consolidation_type,
        v_result.rubini_coins_consolidated,
        v_result.tickets_consolidated;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Consolidação concluída: % usuários duplicados processados', v_total_consolidated;
END $$;

-- ===== PARTE 3: FORTALECER CONSTRAINTS E ÍNDICES =====

-- Garantir que o índice único para twitch_user_id existe e é efetivo
DROP INDEX IF EXISTS idx_profiles_twitch_user_id_unique;
CREATE UNIQUE INDEX idx_profiles_twitch_user_id_active 
ON profiles(twitch_user_id) 
WHERE twitch_user_id IS NOT NULL 
  AND twitch_user_id != '' 
  AND is_active = true;

-- Criar índice para busca rápida por nome normalizado (para usuários sem twitch_user_id)
CREATE INDEX IF NOT EXISTS idx_profiles_nome_normalizado_active
ON profiles(LOWER(TRIM(nome)))
WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
  AND is_active = true
  AND nome IS NOT NULL
  AND TRIM(nome) != '';

-- Criar índice para busca rápida por twitch_username normalizado
CREATE INDEX IF NOT EXISTS idx_profiles_twitch_username_normalizado_active
ON profiles(LOWER(TRIM(twitch_username)))
WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
  AND is_active = true
  AND twitch_username IS NOT NULL
  AND TRIM(twitch_username) != '';

-- ===== PARTE 4: ATUALIZAR FUNÇÃO get_or_merge_profile_v2 =====

-- Atualizar função para ser mais rigorosa na prevenção de duplicatas
CREATE OR REPLACE FUNCTION get_or_merge_profile_v2(
  p_twitch_user_id TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_login TEXT DEFAULT NULL,
  p_nome_personagem TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_existing_display_name TEXT;
  v_existing_login TEXT;
  v_candidate_id UUID;
BEGIN
  -- Validar que twitch_user_id foi fornecido
  IF p_twitch_user_id IS NULL OR p_twitch_user_id = '' THEN
    RAISE EXCEPTION 'twitch_user_id é obrigatório para prevenir duplicatas';
  END IF;

  -- 1. Buscar perfil ativo por twitch_user_id (fonte da verdade)
  SELECT id, display_name_canonical, twitch_username 
  INTO v_profile_id, v_existing_display_name, v_existing_login
  FROM profiles
  WHERE twitch_user_id = p_twitch_user_id
    AND is_active = true
  LIMIT 1;
  
  IF v_profile_id IS NOT NULL THEN
    -- Perfil encontrado: verificar se houve mudança de nome
    IF (p_display_name IS NOT NULL AND p_display_name != v_existing_display_name) OR
       (p_login IS NOT NULL AND p_login != v_existing_login) THEN
      
      -- Registrar alias antigo se a tabela existir
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_aliases') THEN
        INSERT INTO user_aliases (user_id, old_display_name, old_login, twitch_user_id)
        VALUES (
          v_profile_id, 
          COALESCE(v_existing_display_name, 'unknown'),
          v_existing_login,
          p_twitch_user_id
        );
      END IF;
      
      -- Atualizar para o novo nome
      UPDATE profiles 
      SET 
        nome = COALESCE(p_display_name, nome),
        twitch_username = COALESCE(p_login, twitch_username),
        display_name_canonical = COALESCE(p_display_name, display_name_canonical),
        nome_personagem = COALESCE(p_nome_personagem, nome_personagem),
        updated_at = now()
      WHERE id = v_profile_id;
    END IF;
    
    RETURN v_profile_id;
  END IF;

  -- 2. VERIFICAÇÃO ADICIONAL: Buscar possíveis duplicatas por nome/username
  -- Se não encontrou por twitch_user_id, verificar se existe usuário similar sem twitch_user_id
  IF p_display_name IS NOT NULL AND TRIM(p_display_name) != '' THEN
    SELECT id INTO v_candidate_id
    FROM profiles
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
      AND is_active = true
      AND LOWER(TRIM(nome)) = LOWER(TRIM(p_display_name))
    LIMIT 1;
    
    IF v_candidate_id IS NOT NULL THEN
      -- Atualizar o perfil existente com o twitch_user_id
      UPDATE profiles
      SET 
        twitch_user_id = p_twitch_user_id,
        twitch_username = COALESCE(p_login, twitch_username),
        display_name_canonical = COALESCE(p_display_name, display_name_canonical),
        nome_personagem = COALESCE(p_nome_personagem, nome_personagem),
        updated_at = now()
      WHERE id = v_candidate_id;
      
      RETURN v_candidate_id;
    END IF;
  END IF;

  -- 3. Perfil não encontrado: criar novo (primeira vez que vemos este twitch_user_id)
  v_profile_id := gen_random_uuid();
  
  INSERT INTO profiles (
    id, 
    nome, 
    twitch_username, 
    twitch_user_id,
    display_name_canonical,
    nome_personagem,
    is_active
  )
  VALUES (
    v_profile_id,
    COALESCE(p_display_name, p_login, 'unknown'),
    p_login,
    p_twitch_user_id,
    p_display_name,
    p_nome_personagem,
    true
  );
  
  -- Criar balances zerados
  INSERT INTO rubini_coins_balance (user_id, saldo)
  VALUES (v_profile_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO tickets (user_id, tickets_atual)
  VALUES (v_profile_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN v_profile_id;
END;
$$;

-- ===== PARTE 5: CRIAR TRIGGER PARA PREVENIR DUPLICATAS =====

-- Função de trigger para validar antes de inserir/atualizar
CREATE OR REPLACE FUNCTION prevent_duplicate_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar duplicata por twitch_user_id
  IF NEW.twitch_user_id IS NOT NULL AND NEW.twitch_user_id != '' AND NEW.is_active = true THEN
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE twitch_user_id = NEW.twitch_user_id 
        AND is_active = true 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    ) THEN
      RAISE EXCEPTION 'Usuário com twitch_user_id % já existe e está ativo', NEW.twitch_user_id;
    END IF;
  END IF;
  
  -- Para usuários sem twitch_user_id, verificar duplicata por nome
  IF (NEW.twitch_user_id IS NULL OR NEW.twitch_user_id = '') AND NEW.is_active = true THEN
    IF NEW.nome IS NOT NULL AND TRIM(NEW.nome) != '' THEN
      IF EXISTS (
        SELECT 1 FROM profiles 
        WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
          AND is_active = true
          AND LOWER(TRIM(nome)) = LOWER(TRIM(NEW.nome))
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      ) THEN
        RAISE EXCEPTION 'Usuário com nome % já existe (sem twitch_user_id)', NEW.nome;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_profiles ON profiles;
CREATE TRIGGER trigger_prevent_duplicate_profiles
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_profiles();

-- ===== PARTE 6: COMENTÁRIOS E DOCUMENTAÇÃO =====

COMMENT ON FUNCTION consolidate_all_duplicate_users() IS 'Consolida todos os usuários duplicados em etapas: por twitch_user_id, por nome. Execução única para limpeza.';
COMMENT ON FUNCTION get_or_merge_profile_v2(TEXT, TEXT, TEXT, TEXT) IS 'Versão melhorada que previne duplicatas e consolida usuários existentes sem twitch_user_id';
COMMENT ON FUNCTION prevent_duplicate_profiles() IS 'Trigger function que previne criação de perfis duplicados';

-- ===== PARTE 7: VERIFICAÇÃO FINAL =====

-- Verificar se ainda existem duplicatas
DO $$
DECLARE
  v_twitch_id_dups INTEGER;
  v_name_dups INTEGER;
BEGIN
  -- Contar duplicatas por twitch_user_id
  SELECT COUNT(*) INTO v_twitch_id_dups
  FROM (
    SELECT twitch_user_id
    FROM profiles
    WHERE twitch_user_id IS NOT NULL 
      AND twitch_user_id != ''
      AND is_active = true
    GROUP BY twitch_user_id
    HAVING COUNT(*) > 1
  ) t;
  
  -- Contar duplicatas por nome (sem twitch_user_id)
  SELECT COUNT(*) INTO v_name_dups
  FROM (
    SELECT LOWER(TRIM(nome))
    FROM profiles
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
      AND is_active = true
      AND nome IS NOT NULL
      AND TRIM(nome) != ''
    GROUP BY LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
  ) t;
  
  IF v_twitch_id_dups > 0 OR v_name_dups > 0 THEN
    RAISE WARNING 'ATENÇÃO: Ainda existem % duplicatas por twitch_user_id e % duplicatas por nome', v_twitch_id_dups, v_name_dups;
  ELSE
    RAISE NOTICE 'SUCESSO: Nenhuma duplicata encontrada. Sistema limpo!';
  END IF;
END $$;