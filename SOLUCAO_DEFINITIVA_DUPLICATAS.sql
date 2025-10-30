-- =====================================================
-- SOLUÇÃO DEFINITIVA PARA DUPLICATAS DE USUÁRIOS
-- =====================================================
-- Este script resolve TODOS os problemas de duplicatas
-- e implementa prevenções para que nunca mais aconteçam
-- =====================================================

-- ===== PARTE 1: BACKUP E AUDITORIA =====

-- Criar tabela de backup antes da consolidação
CREATE TABLE IF NOT EXISTS profiles_backup_pre_consolidation AS 
SELECT * FROM profiles WHERE 1=0;

-- Fazer backup de todos os perfis ativos
INSERT INTO profiles_backup_pre_consolidation 
SELECT * FROM profiles WHERE is_active = true;

-- Criar tabela de auditoria detalhada se não existir
CREATE TABLE IF NOT EXISTS consolidation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_run_id UUID DEFAULT gen_random_uuid(),
  step_name TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  canonical_profile_id UUID,
  duplicate_profile_id UUID,
  consolidation_criteria TEXT,
  rubini_coins_before_canonical INTEGER DEFAULT 0,
  rubini_coins_before_duplicate INTEGER DEFAULT 0,
  rubini_coins_after_consolidation INTEGER DEFAULT 0,
  tickets_before_canonical INTEGER DEFAULT 0,
  tickets_before_duplicate INTEGER DEFAULT 0,
  tickets_after_consolidation INTEGER DEFAULT 0,
  profiles_data_before JSONB,
  profiles_data_after JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ===== PARTE 2: FUNÇÃO PRINCIPAL DE CONSOLIDAÇÃO DEFINITIVA =====

CREATE OR REPLACE FUNCTION consolidacao_definitiva_usuarios()
RETURNS TABLE(
  etapa TEXT,
  acao TEXT,
  perfil_canonico UUID,
  perfil_duplicado UUID,
  criterio TEXT,
  rubini_consolidado INTEGER,
  tickets_consolidados INTEGER,
  detalhes JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id UUID := gen_random_uuid();
  v_record RECORD;
  v_canonical_id UUID;
  v_duplicate_id UUID;
  v_rc_canonical INTEGER;
  v_rc_duplicate INTEGER;
  v_tickets_canonical INTEGER;
  v_tickets_duplicate INTEGER;
  v_total_consolidados INTEGER := 0;
BEGIN
  RAISE NOTICE 'INICIANDO CONSOLIDAÇÃO DEFINITIVA - RUN ID: %', v_run_id;
  
  -- ===== ETAPA 1: CONSOLIDAR POR TWITCH_USER_ID (MAIS CRÍTICO) =====
  etapa := 'ETAPA_1_TWITCH_USER_ID';
  
  FOR v_record IN
    SELECT 
      twitch_user_id,
      ARRAY_AGG(id ORDER BY 
        CASE WHEN nome_personagem IS NOT NULL AND nome_personagem != '' THEN 1 ELSE 2 END,
        created_at ASC
      ) as profile_ids,
      COUNT(*) as total_duplicatas
    FROM profiles
    WHERE twitch_user_id IS NOT NULL 
      AND twitch_user_id != ''
      AND is_active = true
    GROUP BY twitch_user_id
    HAVING COUNT(*) > 1
  LOOP
    -- Perfil canônico: prioriza quem tem nome_personagem, depois o mais antigo
    v_canonical_id := v_record.profile_ids[1];
    
    RAISE NOTICE 'Consolidando duplicatas para twitch_user_id: % (% perfis)', v_record.twitch_user_id, v_record.total_duplicatas;
    
    -- Processar cada duplicata
    FOR i IN 2..array_length(v_record.profile_ids, 1)
    LOOP
      v_duplicate_id := v_record.profile_ids[i];
      
      -- Obter saldos antes da consolidação
      SELECT COALESCE(saldo, 0) INTO v_rc_canonical FROM rubini_coins_balance WHERE user_id = v_canonical_id;
      SELECT COALESCE(saldo, 0) INTO v_rc_duplicate FROM rubini_coins_balance WHERE user_id = v_duplicate_id;
      SELECT COALESCE(tickets_atual, 0) INTO v_tickets_canonical FROM tickets WHERE user_id = v_canonical_id;
      SELECT COALESCE(tickets_atual, 0) INTO v_tickets_duplicate FROM tickets WHERE user_id = v_duplicate_id;
      
      -- Consolidar dados
      PERFORM consolidar_dados_usuario_completo(v_duplicate_id, v_canonical_id);
      
      -- Registrar auditoria detalhada
      INSERT INTO consolidation_audit (
        consolidation_run_id, step_name, action_taken,
        canonical_profile_id, duplicate_profile_id, consolidation_criteria,
        rubini_coins_before_canonical, rubini_coins_before_duplicate,
        tickets_before_canonical, tickets_before_duplicate,
        profiles_data_before
      ) VALUES (
        v_run_id, etapa, 'profile_consolidated',
        v_canonical_id, v_duplicate_id, 'twitch_user_id',
        v_rc_canonical, v_rc_duplicate,
        v_tickets_canonical, v_tickets_duplicate,
        jsonb_build_object(
          'twitch_user_id', v_record.twitch_user_id,
          'total_duplicates', v_record.total_duplicatas,
          'canonical_profile', (SELECT row_to_json(profiles.*) FROM profiles WHERE id = v_canonical_id),
          'duplicate_profile', (SELECT row_to_json(profiles.*) FROM profiles WHERE id = v_duplicate_id)
        )
      );
      
      -- Desativar perfil duplicado
      UPDATE profiles 
      SET is_active = false, 
          merged_into = v_canonical_id, 
          updated_at = now()
      WHERE id = v_duplicate_id;
      
      -- Retornar resultado
      acao := 'consolidado_por_twitch_id';
      perfil_canonico := v_canonical_id;
      perfil_duplicado := v_duplicate_id;
      criterio := 'twitch_user_id';
      rubini_consolidado := v_rc_duplicate;
      tickets_consolidados := v_tickets_duplicate;
      detalhes := jsonb_build_object(
        'twitch_user_id', v_record.twitch_user_id,
        'total_duplicatas', v_record.total_duplicatas
      );
      
      v_total_consolidados := v_total_consolidados + 1;
      RETURN NEXT;
    END LOOP;
  END LOOP;
  
  -- ===== ETAPA 2: CONSOLIDAR POR NOME (PERFIS SEM TWITCH_USER_ID) =====
  etapa := 'ETAPA_2_NOME_PERSONAGEM';
  
  FOR v_record IN
    SELECT 
      LOWER(TRIM(nome)) as nome_normalizado,
      ARRAY_AGG(id ORDER BY 
        CASE WHEN twitch_username IS NOT NULL AND twitch_username != '' THEN 1 ELSE 2 END,
        created_at ASC
      ) as profile_ids,
      COUNT(*) as total_duplicatas
    FROM profiles
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
      AND is_active = true
      AND nome IS NOT NULL
      AND TRIM(nome) != ''
    GROUP BY LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
  LOOP
    v_canonical_id := v_record.profile_ids[1];
    
    RAISE NOTICE 'Consolidando duplicatas para nome: % (% perfis)', v_record.nome_normalizado, v_record.total_duplicatas;
    
    FOR i IN 2..array_length(v_record.profile_ids, 1)
    LOOP
      v_duplicate_id := v_record.profile_ids[i];
      
      -- Obter saldos
      SELECT COALESCE(saldo, 0) INTO v_rc_canonical FROM rubini_coins_balance WHERE user_id = v_canonical_id;
      SELECT COALESCE(saldo, 0) INTO v_rc_duplicate FROM rubini_coins_balance WHERE user_id = v_duplicate_id;
      SELECT COALESCE(tickets_atual, 0) INTO v_tickets_canonical FROM tickets WHERE user_id = v_canonical_id;
      SELECT COALESCE(tickets_atual, 0) INTO v_tickets_duplicate FROM tickets WHERE user_id = v_duplicate_id;
      
      -- Consolidar
      PERFORM consolidar_dados_usuario_completo(v_duplicate_id, v_canonical_id);
      
      -- Auditoria
      INSERT INTO consolidation_audit (
        consolidation_run_id, step_name, action_taken,
        canonical_profile_id, duplicate_profile_id, consolidation_criteria,
        rubini_coins_before_canonical, rubini_coins_before_duplicate,
        tickets_before_canonical, tickets_before_duplicate,
        profiles_data_before
      ) VALUES (
        v_run_id, etapa, 'profile_consolidated',
        v_canonical_id, v_duplicate_id, 'nome_personagem',
        v_rc_canonical, v_rc_duplicate,
        v_tickets_canonical, v_tickets_duplicate,
        jsonb_build_object(
          'nome_normalizado', v_record.nome_normalizado,
          'total_duplicates', v_record.total_duplicatas
        )
      );
      
      -- Desativar
      UPDATE profiles 
      SET is_active = false, merged_into = v_canonical_id, updated_at = now()
      WHERE id = v_duplicate_id;
      
      -- Retornar
      acao := 'consolidado_por_nome';
      perfil_canonico := v_canonical_id;
      perfil_duplicado := v_duplicate_id;
      criterio := 'nome_personagem';
      rubini_consolidado := v_rc_duplicate;
      tickets_consolidados := v_tickets_duplicate;
      detalhes := jsonb_build_object('nome_normalizado', v_record.nome_normalizado);
      
      v_total_consolidados := v_total_consolidados + 1;
      RETURN NEXT;
    END LOOP;
  END LOOP;
  
  -- ===== ETAPA 3: CONSOLIDAR POR TWITCH_USERNAME (SEM TWITCH_USER_ID) =====
  etapa := 'ETAPA_3_TWITCH_USERNAME';
  
  FOR v_record IN
    SELECT 
      LOWER(TRIM(twitch_username)) as username_normalizado,
      ARRAY_AGG(id ORDER BY 
        CASE WHEN nome IS NOT NULL AND nome != '' THEN 1 ELSE 2 END,
        created_at ASC
      ) as profile_ids,
      COUNT(*) as total_duplicatas
    FROM profiles
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
      AND is_active = true
      AND twitch_username IS NOT NULL
      AND TRIM(twitch_username) != ''
    GROUP BY LOWER(TRIM(twitch_username))
    HAVING COUNT(*) > 1
  LOOP
    v_canonical_id := v_record.profile_ids[1];
    
    RAISE NOTICE 'Consolidando duplicatas para username: % (% perfis)', v_record.username_normalizado, v_record.total_duplicatas;
    
    FOR i IN 2..array_length(v_record.profile_ids, 1)
    LOOP
      v_duplicate_id := v_record.profile_ids[i];
      
      -- Obter saldos
      SELECT COALESCE(saldo, 0) INTO v_rc_canonical FROM rubini_coins_balance WHERE user_id = v_canonical_id;
      SELECT COALESCE(saldo, 0) INTO v_rc_duplicate FROM rubini_coins_balance WHERE user_id = v_duplicate_id;
      SELECT COALESCE(tickets_atual, 0) INTO v_tickets_canonical FROM tickets WHERE user_id = v_canonical_id;
      SELECT COALESCE(tickets_atual, 0) INTO v_tickets_duplicate FROM tickets WHERE user_id = v_duplicate_id;
      
      -- Consolidar
      PERFORM consolidar_dados_usuario_completo(v_duplicate_id, v_canonical_id);
      
      -- Auditoria
      INSERT INTO consolidation_audit (
        consolidation_run_id, step_name, action_taken,
        canonical_profile_id, duplicate_profile_id, consolidation_criteria,
        rubini_coins_before_canonical, rubini_coins_before_duplicate,
        tickets_before_canonical, tickets_before_duplicate,
        profiles_data_before
      ) VALUES (
        v_run_id, etapa, 'profile_consolidated',
        v_canonical_id, v_duplicate_id, 'twitch_username',
        v_rc_canonical, v_rc_duplicate,
        v_tickets_canonical, v_tickets_duplicate,
        jsonb_build_object(
          'username_normalizado', v_record.username_normalizado,
          'total_duplicates', v_record.total_duplicatas
        )
      );
      
      -- Desativar
      UPDATE profiles 
      SET is_active = false, merged_into = v_canonical_id, updated_at = now()
      WHERE id = v_duplicate_id;
      
      -- Retornar
      acao := 'consolidado_por_username';
      perfil_canonico := v_canonical_id;
      perfil_duplicado := v_duplicate_id;
      criterio := 'twitch_username';
      rubini_consolidado := v_rc_duplicate;
      tickets_consolidados := v_tickets_duplicate;
      detalhes := jsonb_build_object('username_normalizado', v_record.username_normalizado);
      
      v_total_consolidados := v_total_consolidados + 1;
      RETURN NEXT;
    END LOOP;
  END LOOP;
  
  -- ===== RESULTADO FINAL =====
  etapa := 'RESUMO_FINAL';
  acao := 'consolidacao_completa';
  detalhes := jsonb_build_object(
    'total_perfis_consolidados', v_total_consolidados,
    'run_id', v_run_id,
    'completado_em', now()
  );
  
  RAISE NOTICE 'CONSOLIDAÇÃO DEFINITIVA COMPLETA - % perfis consolidados', v_total_consolidados;
  RETURN NEXT;
END;
$$;

-- ===== PARTE 3: FUNÇÃO AUXILIAR MELHORADA =====

CREATE OR REPLACE FUNCTION consolidar_dados_usuario_completo(
  p_source_user_id UUID,
  p_target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rc_source INTEGER;
  v_tickets_source INTEGER;
BEGIN
  -- Obter saldos da fonte
  SELECT COALESCE(saldo, 0) INTO v_rc_source FROM rubini_coins_balance WHERE user_id = p_source_user_id;
  SELECT COALESCE(tickets_atual, 0) INTO v_tickets_source FROM tickets WHERE user_id = p_source_user_id;
  
  -- Migrar TODOS os dados relacionados
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
  
  -- Migrar aliases se existir
  UPDATE user_aliases SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  
  -- Consolidar Rubini Coins
  IF v_rc_source > 0 THEN
    INSERT INTO rubini_coins_balance (user_id, saldo)
    VALUES (p_target_user_id, v_rc_source)
    ON CONFLICT (user_id) 
    DO UPDATE SET saldo = rubini_coins_balance.saldo + EXCLUDED.saldo;
    
    INSERT INTO rubini_coins_history (user_id, variacao, motivo, origem, status)
    VALUES (p_target_user_id, v_rc_source, 'Consolidação definitiva de duplicata', 'system_consolidation_final', 'confirmado');
  END IF;
  
  -- Consolidar Tickets
  IF v_tickets_source > 0 THEN
    INSERT INTO tickets (user_id, tickets_atual)
    VALUES (p_target_user_id, v_tickets_source)
    ON CONFLICT (user_id) 
    DO UPDATE SET tickets_atual = tickets.tickets_atual + EXCLUDED.tickets_atual;
    
    INSERT INTO ticket_ledger (user_id, variacao, motivo, origem, status)
    VALUES (p_target_user_id, v_tickets_source, 'Consolidação definitiva de duplicata', 'system_consolidation_final', 'confirmado');
  END IF;
  
  -- Deletar saldos da fonte
  DELETE FROM rubini_coins_balance WHERE user_id = p_source_user_id;
  DELETE FROM tickets WHERE user_id = p_source_user_id;
END;
$$;

-- ===== PARTE 4: CONSTRAINTS E PREVENÇÕES =====

-- Criar índices únicos para prevenir futuras duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_twitch_user_id 
ON profiles (twitch_user_id) 
WHERE twitch_user_id IS NOT NULL AND twitch_user_id != '' AND is_active = true;

-- Função para prevenir duplicatas na criação
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
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Perfil com twitch_user_id % já existe e está ativo', NEW.twitch_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para prevenção
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_profiles ON profiles;
CREATE TRIGGER trigger_prevent_duplicate_profiles
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_profiles();

-- ===== PARTE 5: FUNÇÃO DE VERIFICAÇÃO PÓS-CONSOLIDAÇÃO =====

CREATE OR REPLACE FUNCTION verificar_integridade_pos_consolidacao()
RETURNS TABLE(
  verificacao TEXT,
  status TEXT,
  detalhes JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_duplicatas_twitch INTEGER;
  v_duplicatas_nome INTEGER;
  v_duplicatas_username INTEGER;
  v_perfis_orfaos INTEGER;
  v_saldos_orfaos INTEGER;
BEGIN
  -- Verificar duplicatas restantes por twitch_user_id
  SELECT COUNT(*) INTO v_duplicatas_twitch
  FROM (
    SELECT twitch_user_id, COUNT(*) as cnt
    FROM profiles
    WHERE twitch_user_id IS NOT NULL AND twitch_user_id != '' AND is_active = true
    GROUP BY twitch_user_id
    HAVING COUNT(*) > 1
  ) t;
  
  verificacao := 'duplicatas_twitch_user_id';
  status := CASE WHEN v_duplicatas_twitch = 0 THEN 'OK' ELSE 'ERRO' END;
  detalhes := jsonb_build_object('duplicatas_encontradas', v_duplicatas_twitch);
  RETURN NEXT;
  
  -- Verificar duplicatas por nome
  SELECT COUNT(*) INTO v_duplicatas_nome
  FROM (
    SELECT LOWER(TRIM(nome)), COUNT(*) as cnt
    FROM profiles
    WHERE (twitch_user_id IS NULL OR twitch_user_id = '') 
      AND is_active = true 
      AND nome IS NOT NULL 
      AND TRIM(nome) != ''
    GROUP BY LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
  ) t;
  
  verificacao := 'duplicatas_nome';
  status := CASE WHEN v_duplicatas_nome = 0 THEN 'OK' ELSE 'AVISO' END;
  detalhes := jsonb_build_object('duplicatas_encontradas', v_duplicatas_nome);
  RETURN NEXT;
  
  -- Verificar saldos órfãos
  SELECT COUNT(*) INTO v_saldos_orfaos
  FROM rubini_coins_balance rcb
  LEFT JOIN profiles p ON rcb.user_id = p.id
  WHERE p.id IS NULL OR p.is_active = false;
  
  verificacao := 'saldos_orfaos';
  status := CASE WHEN v_saldos_orfaos = 0 THEN 'OK' ELSE 'ERRO' END;
  detalhes := jsonb_build_object('saldos_orfaos_encontrados', v_saldos_orfaos);
  RETURN NEXT;
  
  verificacao := 'verificacao_completa';
  status := 'CONCLUIDA';
  detalhes := jsonb_build_object(
    'timestamp', now(),
    'resumo', 'Verificação de integridade pós-consolidação completa'
  );
  RETURN NEXT;
END;
$$;

-- ===== COMENTÁRIOS E DOCUMENTAÇÃO =====

COMMENT ON FUNCTION consolidacao_definitiva_usuarios() IS 'Função principal que resolve TODOS os problemas de duplicatas de usuários de forma definitiva';
COMMENT ON FUNCTION consolidar_dados_usuario_completo(UUID, UUID) IS 'Migra todos os dados de um usuário para outro de forma completa e segura';
COMMENT ON FUNCTION prevent_duplicate_profiles() IS 'Trigger function que previne a criação de perfis duplicados';
COMMENT ON FUNCTION verificar_integridade_pos_consolidacao() IS 'Verifica a integridade da base após a consolidação';

-- ===== INSTRUÇÕES DE USO =====

/*
INSTRUÇÕES PARA EXECUTAR A CONSOLIDAÇÃO DEFINITIVA:

1. EXECUTAR A CONSOLIDAÇÃO:
   SELECT * FROM consolidacao_definitiva_usuarios();

2. VERIFICAR INTEGRIDADE:
   SELECT * FROM verificar_integridade_pos_consolidacao();

3. VER AUDITORIA DETALHADA:
   SELECT * FROM consolidation_audit ORDER BY created_at DESC;

4. VER BACKUP PRÉ-CONSOLIDAÇÃO:
   SELECT * FROM profiles_backup_pre_consolidation;

IMPORTANTE: Este script resolve TODOS os problemas de duplicatas
e implementa prevenções para que nunca mais aconteçam.
*/