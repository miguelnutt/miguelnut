-- =====================================================
-- MIGRATION: Deduplicação e Saldo Confiável
-- =====================================================

-- ===== PARTE 1: Melhorar ticket_ledger com idempotência =====

-- Adicionar campos de idempotência e auditoria ao ticket_ledger
ALTER TABLE ticket_ledger 
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmado',
  ADD COLUMN IF NOT EXISTS origem TEXT,
  ADD COLUMN IF NOT EXISTS referencia_id UUID,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS retries INTEGER DEFAULT 0;

-- Criar índice para buscar por idempotency_key rapidamente
CREATE INDEX IF NOT EXISTS idx_ticket_ledger_idempotency_key 
ON ticket_ledger(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Criar índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_ticket_ledger_status 
ON ticket_ledger(status);

-- Criar índice composto para queries de auditoria
CREATE INDEX IF NOT EXISTS idx_ticket_ledger_user_created 
ON ticket_ledger(user_id, created_at DESC);

-- ===== PARTE 2: Melhorar rubini_coins_history com índices =====

-- Índice para buscar por origem
CREATE INDEX IF NOT EXISTS idx_rubini_coins_history_origem 
ON rubini_coins_history(origem);

-- Índice composto para queries de auditoria
CREATE INDEX IF NOT EXISTS idx_rubini_coins_history_user_created 
ON rubini_coins_history(user_id, created_at DESC);

-- Índice para buscar por referencia_id
CREATE INDEX IF NOT EXISTS idx_rubini_coins_history_referencia_id 
ON rubini_coins_history(referencia_id) 
WHERE referencia_id IS NOT NULL;

-- ===== PARTE 3: Função auxiliar para consolidar duplicatas existentes =====

CREATE OR REPLACE FUNCTION consolidate_duplicate_profiles()
RETURNS TABLE(
  action_taken TEXT,
  canonical_id UUID,
  duplicate_id UUID,
  rubini_coins_consolidated INTEGER,
  tickets_consolidated INTEGER
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
BEGIN
  -- Encontrar duplicatas: múltiplos perfis ativos com mesmo twitch_user_id
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
    
    RAISE NOTICE 'Consolidando twitch_user_id %: canonical_id=%', v_dup_record.twitch_user_id, v_canonical_id;
    
    -- Processar cada duplicata (exceto o canônico)
    FOR i IN 2..array_length(v_dup_record.profile_ids, 1)
    LOOP
      DECLARE
        v_dup_id UUID := v_dup_record.profile_ids[i];
      BEGIN
        -- Somar Rubini Coins da duplicata
        SELECT COALESCE(SUM(saldo), 0) INTO v_rc_sum
        FROM rubini_coins_balance
        WHERE user_id = v_dup_id;
        
        -- Somar Tickets da duplicata
        SELECT COALESCE(SUM(tickets_atual), 0) INTO v_tickets_sum
        FROM tickets
        WHERE user_id = v_dup_id;
        
        -- Migrar históricos
        UPDATE ticket_ledger SET user_id = v_canonical_id WHERE user_id = v_dup_id;
        UPDATE rubini_coins_history SET user_id = v_canonical_id WHERE user_id = v_dup_id;
        UPDATE daily_rewards_history SET user_id = v_canonical_id WHERE user_id = v_dup_id;
        UPDATE tibiatermo_user_games SET user_id = v_canonical_id WHERE user_id = v_dup_id;
        UPDATE spins SET user_id = v_canonical_id WHERE user_id = v_dup_id;
        UPDATE chat_messages SET user_id = v_canonical_id WHERE user_id = v_dup_id;
        UPDATE rubini_coins_resgates SET user_id = v_canonical_id WHERE user_id = v_dup_id;
        UPDATE raffles SET vencedor_id = v_canonical_id WHERE vencedor_id = v_dup_id;
        
        -- Deletar balances da duplicata
        DELETE FROM rubini_coins_balance WHERE user_id = v_dup_id;
        DELETE FROM tickets WHERE user_id = v_dup_id;
        
        -- Consolidar saldos no perfil canônico
        IF v_rc_sum > 0 THEN
          INSERT INTO rubini_coins_balance (user_id, saldo)
          VALUES (v_canonical_id, v_rc_sum)
          ON CONFLICT (user_id) 
          DO UPDATE SET saldo = rubini_coins_balance.saldo + EXCLUDED.saldo;
          
          -- Registrar transação de consolidação
          INSERT INTO rubini_coins_history (user_id, variacao, motivo, origem, status)
          VALUES (v_canonical_id, v_rc_sum, 'Consolidação de duplicata ' || v_dup_id, 'system_consolidation', 'confirmado');
        END IF;
        
        IF v_tickets_sum > 0 THEN
          INSERT INTO tickets (user_id, tickets_atual)
          VALUES (v_canonical_id, v_tickets_sum)
          ON CONFLICT (user_id) 
          DO UPDATE SET tickets_atual = tickets.tickets_atual + EXCLUDED.tickets_atual;
          
          -- Registrar transação de consolidação
          INSERT INTO ticket_ledger (user_id, variacao, motivo, origem, status)
          VALUES (v_canonical_id, v_tickets_sum, 'Consolidação de duplicata ' || v_dup_id, 'system_consolidation', 'confirmado');
        END IF;
        
        -- Registrar auditoria
        INSERT INTO profile_merge_audit (
          canonical_profile_id,
          duplicate_profile_id,
          rubini_coins_before_canonical,
          rubini_coins_before_duplicate,
          rubini_coins_after_canonical,
          tickets_before_canonical,
          tickets_before_duplicate,
          tickets_after_canonical,
          metadata
        ) VALUES (
          v_canonical_id,
          v_dup_id,
          COALESCE((SELECT saldo FROM rubini_coins_balance WHERE user_id = v_canonical_id), 0) - v_rc_sum,
          v_rc_sum,
          COALESCE((SELECT saldo FROM rubini_coins_balance WHERE user_id = v_canonical_id), 0),
          COALESCE((SELECT tickets_atual FROM tickets WHERE user_id = v_canonical_id), 0) - v_tickets_sum,
          v_tickets_sum,
          COALESCE((SELECT tickets_atual FROM tickets WHERE user_id = v_canonical_id), 0),
          jsonb_build_object('migration_type', 'batch_consolidation', 'twitch_user_id', v_dup_record.twitch_user_id)
        );
        
        -- Desativar perfil duplicado
        UPDATE profiles 
        SET is_active = false, merged_into = v_canonical_id, updated_at = now()
        WHERE id = v_dup_id;
        
        -- Retornar resultado
        action_taken := 'consolidated';
        canonical_id := v_canonical_id;
        duplicate_id := v_dup_id;
        rubini_coins_consolidated := v_rc_sum;
        tickets_consolidated := v_tickets_sum;
        
        v_count := v_count + 1;
        RETURN NEXT;
        
        RAISE NOTICE 'Duplicata % consolidada: RC=%, Tickets=%', v_dup_id, v_rc_sum, v_tickets_sum;
      END;
    END LOOP;
  END LOOP;
  
  IF v_count = 0 THEN
    action_taken := 'no_duplicates_found';
    RETURN NEXT;
  END IF;
  
  RAISE NOTICE 'Consolidação concluída: % perfis duplicados processados', v_count;
END;
$$;

-- ===== PARTE 4: Adicionar comentários de documentação =====

COMMENT ON COLUMN ticket_ledger.idempotency_key IS 'Chave única para garantir idempotência de transações';
COMMENT ON COLUMN ticket_ledger.status IS 'Status da transação: confirmado, pendente, falhou';
COMMENT ON COLUMN ticket_ledger.origem IS 'Origem da transação: daily_reward, tibiatermo, admin, etc';
COMMENT ON COLUMN ticket_ledger.referencia_id IS 'ID de referência externo (ex: reward_id, game_id)';

COMMENT ON FUNCTION consolidate_duplicate_profiles() IS 'Consolida perfis duplicados com mesmo twitch_user_id, preservando todo o histórico e somando saldos';

-- ===== PARTE 5: Garantir constraint de unicidade (caso não exista) =====

-- Verificar e criar índice único se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND indexname = 'idx_profiles_twitch_user_id_active'
  ) THEN
    CREATE UNIQUE INDEX idx_profiles_twitch_user_id_active 
    ON profiles(twitch_user_id) 
    WHERE is_active = true;
    RAISE NOTICE 'Índice único idx_profiles_twitch_user_id_active criado';
  ELSE
    RAISE NOTICE 'Índice único idx_profiles_twitch_user_id_active já existe';
  END IF;
END $$;