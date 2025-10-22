
-- Consolidar perfis duplicados ativos com mesmo twitch_username (versão corrigida)
-- Priorizar perfil com twitch_user_id como canônico

DO $$
DECLARE
  duplicate_group RECORD;
  canonical_profile_id UUID;
  duplicate_profile RECORD;
  total_rc INTEGER;
  total_tickets INTEGER;
BEGIN
  -- Para cada grupo de duplicatas por twitch_username
  FOR duplicate_group IN
    SELECT twitch_username, ARRAY_AGG(id ORDER BY (twitch_user_id IS NOT NULL) DESC, created_at) as profile_ids
    FROM profiles
    WHERE is_active = true AND twitch_username IS NOT NULL
    GROUP BY twitch_username
    HAVING COUNT(*) > 1
  LOOP
    canonical_profile_id := duplicate_group.profile_ids[1];
    
    RAISE NOTICE 'Consolidando duplicatas de username: % (canônico: %)', duplicate_group.twitch_username, canonical_profile_id;
    
    -- Somar todos os saldos
    SELECT 
      COALESCE(SUM(rc.saldo), 0),
      COALESCE(SUM(t.tickets_atual), 0)
    INTO total_rc, total_tickets
    FROM unnest(duplicate_group.profile_ids) AS pid
    LEFT JOIN rubini_coins_balance rc ON rc.user_id = pid
    LEFT JOIN tickets t ON t.user_id = pid;
    
    RAISE NOTICE 'Total consolidado: % RC, % tickets', total_rc, total_tickets;
    
    -- Para cada perfil duplicado (exceto o canônico)
    FOR duplicate_profile IN
      SELECT unnest(duplicate_group.profile_ids[2:]) AS dup_id
    LOOP
      RAISE NOTICE 'Processando duplicata: %', duplicate_profile.dup_id;
      
      -- Migrar históricos (sem unique constraints)
      UPDATE rubini_coins_history SET user_id = canonical_profile_id WHERE user_id = duplicate_profile.dup_id;
      UPDATE ticket_ledger SET user_id = canonical_profile_id WHERE user_id = duplicate_profile.dup_id;
      UPDATE daily_rewards_history SET user_id = canonical_profile_id WHERE user_id = duplicate_profile.dup_id;
      UPDATE tibiatermo_history SET user_id = canonical_profile_id WHERE user_id = duplicate_profile.dup_id;
      UPDATE spins SET user_id = canonical_profile_id WHERE user_id = duplicate_profile.dup_id;
      UPDATE raffles SET vencedor_id = canonical_profile_id WHERE vencedor_id = duplicate_profile.dup_id;
      UPDATE chat_messages SET user_id = canonical_profile_id WHERE user_id = duplicate_profile.dup_id;
      UPDATE rubini_coins_resgates SET user_id = canonical_profile_id WHERE user_id = duplicate_profile.dup_id;
      
      -- Para tabelas com unique constraint, manter o registro do canônico e deletar o do duplicado
      -- user_daily_logins: manter o mais recente (maior dia_atual)
      DELETE FROM user_daily_logins 
      WHERE user_id = duplicate_profile.dup_id
      AND EXISTS (SELECT 1 FROM user_daily_logins WHERE user_id = canonical_profile_id);
      
      UPDATE user_daily_logins SET user_id = canonical_profile_id WHERE user_id = duplicate_profile.dup_id;
      
      -- tibiatermo_user_games: pode ter múltiplos por (user_id, data_jogo), migrar normalmente
      UPDATE tibiatermo_user_games SET user_id = canonical_profile_id WHERE user_id = duplicate_profile.dup_id;
      
      -- Deletar saldos do duplicado
      DELETE FROM rubini_coins_balance WHERE user_id = duplicate_profile.dup_id;
      DELETE FROM tickets WHERE user_id = duplicate_profile.dup_id;
      
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
        canonical_profile_id,
        duplicate_profile.dup_id,
        0, 0, total_rc,
        0, 0, total_tickets,
        jsonb_build_object('reason', 'auto_consolidation_active_duplicates', 'username', duplicate_group.twitch_username)
      );
      
      -- Desativar perfil duplicado
      UPDATE profiles SET is_active = false, merged_into = canonical_profile_id WHERE id = duplicate_profile.dup_id;
    END LOOP;
    
    -- Atualizar saldo consolidado no perfil canônico
    INSERT INTO rubini_coins_balance (user_id, saldo)
    VALUES (canonical_profile_id, total_rc)
    ON CONFLICT (user_id) DO UPDATE SET saldo = EXCLUDED.saldo;
    
    INSERT INTO tickets (user_id, tickets_atual)
    VALUES (canonical_profile_id, total_tickets)
    ON CONFLICT (user_id) DO UPDATE SET tickets_atual = EXCLUDED.tickets_atual;
    
    RAISE NOTICE 'Consolidação completa para %', duplicate_group.twitch_username;
  END LOOP;
END $$;
