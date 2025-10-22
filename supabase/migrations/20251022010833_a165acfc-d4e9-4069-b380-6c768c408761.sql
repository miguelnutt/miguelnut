-- ============================================
-- CORREÇÃO URGENTE: Consolidar perfis duplicados ativos do miguelnutt
-- ============================================

DO $$
DECLARE
  canonical_id UUID := '57a9fb28-9e8d-4875-b6d0-92674b16309f'; -- perfil com twitch_user_id
  duplicate_ids UUID[] := ARRAY[
    'f779c542-3b1d-4727-86a6-07d849b77cf6'::UUID,
    '28139c94-45da-416c-9cb0-985c3bed2c0a'::UUID,
    '0daa2f33-34aa-4965-9c14-fe222dfe7f3d'::UUID
  ];
  dup_id UUID;
  rc_balance INT;
  tk_balance INT;
BEGIN
  RAISE NOTICE '🔧 Consolidando perfis duplicados do miguelnutt...';
  
  -- Para cada perfil duplicado
  FOREACH dup_id IN ARRAY duplicate_ids
  LOOP
    RAISE NOTICE 'Processando duplicado: %', dup_id;
    
    -- Pegar saldos do duplicado
    SELECT COALESCE(saldo, 0) INTO rc_balance
    FROM rubini_coins_balance WHERE user_id = dup_id;
    
    SELECT COALESCE(tickets_atual, 0) INTO tk_balance
    FROM tickets WHERE user_id = dup_id;
    
    RAISE NOTICE '  Saldos: % RC, % Tickets', rc_balance, tk_balance;
    
    -- Migrar históricos
    UPDATE rubini_coins_history SET user_id = canonical_id WHERE user_id = dup_id;
    UPDATE ticket_ledger SET user_id = canonical_id WHERE user_id = dup_id;
    UPDATE tibiatermo_user_games SET user_id = canonical_id WHERE user_id = dup_id;
    UPDATE daily_rewards_history SET user_id = canonical_id WHERE user_id = dup_id;
    UPDATE spins SET user_id = canonical_id WHERE user_id = dup_id;
    UPDATE chat_messages SET user_id = canonical_id WHERE user_id = dup_id;
    UPDATE rubini_coins_resgates SET user_id = canonical_id WHERE user_id = dup_id;
    UPDATE raffles SET vencedor_id = canonical_id WHERE vencedor_id = dup_id;
    
    -- Adicionar saldos ao canônico (se houver)
    IF rc_balance > 0 THEN
      INSERT INTO rubini_coins_history (user_id, variacao, motivo, origem, status)
      VALUES (canonical_id, rc_balance, 'Consolidação de perfil duplicado', 'consolidacao', 'confirmado');
      
      UPDATE rubini_coins_balance 
      SET saldo = saldo + rc_balance
      WHERE user_id = canonical_id;
    END IF;
    
    IF tk_balance > 0 THEN
      INSERT INTO ticket_ledger (user_id, variacao, motivo)
      VALUES (canonical_id, tk_balance, 'Consolidação de perfil duplicado');
      
      UPDATE tickets 
      SET tickets_atual = tickets_atual + tk_balance
      WHERE user_id = canonical_id;
    END IF;
    
    -- Zerar saldos do duplicado
    UPDATE rubini_coins_balance SET saldo = 0 WHERE user_id = dup_id;
    UPDATE tickets SET tickets_atual = 0 WHERE user_id = dup_id;
    
    -- Desativar perfil duplicado
    UPDATE profiles 
    SET is_active = false, merged_into = canonical_id
    WHERE id = dup_id;
    
    RAISE NOTICE '✅ Duplicado consolidado';
  END LOOP;
  
  RAISE NOTICE '✅ Consolidação concluída!';
END $$;