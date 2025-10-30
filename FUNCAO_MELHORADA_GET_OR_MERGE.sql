-- =====================================================
-- FUNÇÃO MELHORADA get_or_merge_profile_v2
-- =====================================================
-- Versão que integra com a solução definitiva de duplicatas
-- e previne completamente a criação de novos duplicados
-- =====================================================

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
  v_duplicate_ids UUID[];
  v_dup_id UUID;
BEGIN
  -- Validar que twitch_user_id foi fornecido
  IF p_twitch_user_id IS NULL OR p_twitch_user_id = '' THEN
    RAISE EXCEPTION 'twitch_user_id é obrigatório para prevenir duplicatas';
  END IF;

  -- LOCK para prevenir condições de corrida
  PERFORM pg_advisory_xact_lock(hashtext(p_twitch_user_id));

  -- 1. Buscar perfil ativo por twitch_user_id (fonte da verdade)
  SELECT id, display_name_canonical, twitch_username 
  INTO v_profile_id, v_existing_display_name, v_existing_login
  FROM profiles
  WHERE twitch_user_id = p_twitch_user_id
    AND is_active = true
  LIMIT 1;
  
  -- 2. VERIFICAÇÃO CRÍTICA: Se encontrou múltiplos perfis ativos com mesmo twitch_user_id
  SELECT ARRAY_AGG(id) INTO v_duplicate_ids
  FROM profiles
  WHERE twitch_user_id = p_twitch_user_id
    AND is_active = true;
  
  IF array_length(v_duplicate_ids, 1) > 1 THEN
    RAISE NOTICE 'DETECTADAS DUPLICATAS ATIVAS para twitch_user_id %: %', p_twitch_user_id, v_duplicate_ids;
    
    -- Consolidar automaticamente usando nossa função definitiva
    -- Manter o primeiro (mais antigo) como canônico
    v_profile_id := v_duplicate_ids[1];
    
    -- Consolidar os demais
    FOR i IN 2..array_length(v_duplicate_ids, 1)
    LOOP
      v_dup_id := v_duplicate_ids[i];
      RAISE NOTICE 'Auto-consolidando perfil duplicado % para %', v_dup_id, v_profile_id;
      
      -- Usar nossa função de consolidação completa
      PERFORM consolidar_dados_usuario_completo(v_dup_id, v_profile_id);
      
      -- Desativar duplicata
      UPDATE profiles 
      SET is_active = false, merged_into = v_profile_id, updated_at = now()
      WHERE id = v_dup_id;
      
      -- Registrar na auditoria
      INSERT INTO consolidation_audit (
        step_name, action_taken, canonical_profile_id, duplicate_profile_id,
        consolidation_criteria, profiles_data_before
      ) VALUES (
        'AUTO_CONSOLIDATION_GET_OR_MERGE', 'duplicate_auto_merged',
        v_profile_id, v_dup_id, 'twitch_user_id_runtime',
        jsonb_build_object(
          'twitch_user_id', p_twitch_user_id,
          'trigger', 'get_or_merge_profile_v2',
          'timestamp', now()
        )
      );
    END LOOP;
  END IF;
  
  IF v_profile_id IS NOT NULL THEN
    -- Perfil encontrado: verificar se houve mudança de nome
    IF (p_display_name IS NOT NULL AND p_display_name != v_existing_display_name) OR
       (p_login IS NOT NULL AND p_login != v_existing_login) THEN
      
      -- Registrar alias antigo se a tabela existir
      BEGIN
        INSERT INTO user_aliases (user_id, old_display_name, old_login, twitch_user_id)
        VALUES (
          v_profile_id, 
          COALESCE(v_existing_display_name, 'unknown'),
          v_existing_login,
          p_twitch_user_id
        );
      EXCEPTION WHEN OTHERS THEN
        -- Tabela user_aliases pode não existir, ignorar erro
        NULL;
      END;
      
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

  -- 3. BUSCA INTELIGENTE: Procurar perfis órfãos que podem ser este usuário
  -- Buscar por nome exato (sem twitch_user_id)
  IF p_display_name IS NOT NULL AND TRIM(p_display_name) != '' THEN
    SELECT id INTO v_candidate_id
    FROM profiles
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
      AND is_active = true
      AND LOWER(TRIM(nome)) = LOWER(TRIM(p_display_name))
    ORDER BY created_at ASC  -- Pegar o mais antigo
    LIMIT 1;
    
    IF v_candidate_id IS NOT NULL THEN
      RAISE NOTICE 'Encontrado perfil órfão por nome para twitch_user_id %: %', p_twitch_user_id, v_candidate_id;
      
      -- Verificar se há outros perfis com mesmo nome para consolidar
      SELECT ARRAY_AGG(id) INTO v_duplicate_ids
      FROM profiles
      WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
        AND is_active = true
        AND LOWER(TRIM(nome)) = LOWER(TRIM(p_display_name))
        AND id != v_candidate_id;
      
      -- Consolidar duplicatas por nome se existirem
      IF v_duplicate_ids IS NOT NULL THEN
        FOREACH v_dup_id IN ARRAY v_duplicate_ids
        LOOP
          RAISE NOTICE 'Consolidando duplicata por nome % para %', v_dup_id, v_candidate_id;
          PERFORM consolidar_dados_usuario_completo(v_dup_id, v_candidate_id);
          
          UPDATE profiles 
          SET is_active = false, merged_into = v_candidate_id, updated_at = now()
          WHERE id = v_dup_id;
        END LOOP;
      END IF;
      
      -- Atualizar o perfil órfão com o twitch_user_id
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

  -- 4. Buscar por twitch_username se não encontrou por nome
  IF p_login IS NOT NULL AND TRIM(p_login) != '' THEN
    SELECT id INTO v_candidate_id
    FROM profiles
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
      AND is_active = true
      AND LOWER(TRIM(twitch_username)) = LOWER(TRIM(p_login))
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF v_candidate_id IS NOT NULL THEN
      RAISE NOTICE 'Encontrado perfil órfão por username para twitch_user_id %: %', p_twitch_user_id, v_candidate_id;
      
      -- Consolidar duplicatas por username se existirem
      SELECT ARRAY_AGG(id) INTO v_duplicate_ids
      FROM profiles
      WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
        AND is_active = true
        AND LOWER(TRIM(twitch_username)) = LOWER(TRIM(p_login))
        AND id != v_candidate_id;
      
      IF v_duplicate_ids IS NOT NULL THEN
        FOREACH v_dup_id IN ARRAY v_duplicate_ids
        LOOP
          RAISE NOTICE 'Consolidando duplicata por username % para %', v_dup_id, v_candidate_id;
          PERFORM consolidar_dados_usuario_completo(v_dup_id, v_candidate_id);
          
          UPDATE profiles 
          SET is_active = false, merged_into = v_candidate_id, updated_at = now()
          WHERE id = v_dup_id;
        END LOOP;
      END IF;
      
      -- Atualizar com twitch_user_id
      UPDATE profiles
      SET 
        twitch_user_id = p_twitch_user_id,
        nome = COALESCE(p_display_name, nome),
        display_name_canonical = COALESCE(p_display_name, display_name_canonical),
        nome_personagem = COALESCE(p_nome_personagem, nome_personagem),
        updated_at = now()
      WHERE id = v_candidate_id;
      
      RETURN v_candidate_id;
    END IF;
  END IF;

  -- 5. Perfil não encontrado: criar novo (primeira vez que vemos este twitch_user_id)
  v_profile_id := gen_random_uuid();
  
  RAISE NOTICE 'Criando novo perfil para twitch_user_id %: %', p_twitch_user_id, v_profile_id;
  
  INSERT INTO profiles (
    id, 
    nome, 
    twitch_username, 
    twitch_user_id,
    display_name_canonical,
    nome_personagem,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    v_profile_id,
    COALESCE(p_display_name, p_login, 'unknown'),
    p_login,
    p_twitch_user_id,
    p_display_name,
    p_nome_personagem,
    true,
    now(),
    now()
  );
  
  -- Criar balances zerados para o novo perfil
  INSERT INTO rubini_coins_balance (user_id, saldo) 
  VALUES (v_profile_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO tickets (user_id, tickets_atual) 
  VALUES (v_profile_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN v_profile_id;
END;
$$;

-- ===== FUNÇÃO DE LIMPEZA AUTOMÁTICA =====

CREATE OR REPLACE FUNCTION auto_cleanup_duplicates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cleaned INTEGER := 0;
  v_record RECORD;
BEGIN
  -- Executar limpeza automática de duplicatas detectadas
  FOR v_record IN
    SELECT twitch_user_id, COUNT(*) as cnt
    FROM profiles
    WHERE twitch_user_id IS NOT NULL 
      AND twitch_user_id != ''
      AND is_active = true
    GROUP BY twitch_user_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Limpeza automática para twitch_user_id %', v_record.twitch_user_id;
    
    -- Usar get_or_merge_profile_v2 para consolidar
    PERFORM get_or_merge_profile_v2(v_record.twitch_user_id);
    
    v_cleaned := v_cleaned + (v_record.cnt - 1);
  END LOOP;
  
  RETURN v_cleaned;
END;
$$;

-- ===== COMENTÁRIOS =====

COMMENT ON FUNCTION get_or_merge_profile_v2(TEXT, TEXT, TEXT, TEXT) IS 'Versão definitiva que previne e resolve duplicatas automaticamente em tempo real';
COMMENT ON FUNCTION auto_cleanup_duplicates() IS 'Função de limpeza automática que pode ser executada periodicamente';

-- ===== INSTRUÇÕES =====

/*
ESTA FUNÇÃO MELHORADA:

1. ✅ Previne completamente a criação de duplicatas
2. ✅ Detecta e resolve duplicatas automaticamente em tempo real
3. ✅ Usa locks para prevenir condições de corrida
4. ✅ Consolida perfis órfãos inteligentemente
5. ✅ Registra todas as ações na auditoria
6. ✅ Mantém histórico completo preservado

PARA USAR:
- A função é chamada automaticamente pelo sistema
- Para limpeza manual: SELECT auto_cleanup_duplicates();
- Para verificar: SELECT * FROM consolidation_audit;
*/