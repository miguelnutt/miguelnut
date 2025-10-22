-- ============================================
-- CONSOLIDAÇÃO FINAL - TRATA TODAS AS CONSTRAINTS
-- ============================================

DO $$
DECLARE
  rec RECORD;
  rows_updated INT;
BEGIN
  RAISE NOTICE 'Migrando com tratamento completo de constraints...';
  
  FOR rec IN 
    SELECT id as old_id, merged_into as new_id, twitch_username
    FROM profiles
    WHERE is_active = false AND merged_into IS NOT NULL
  LOOP
    RAISE NOTICE '🔄 %: % → %', rec.twitch_username, rec.old_id, rec.new_id;
    
    -- 1. user_daily_logins (unique: user_id)
    DELETE FROM user_daily_logins 
    WHERE user_id = rec.old_id 
      AND EXISTS (SELECT 1 FROM user_daily_logins WHERE user_id = rec.new_id);
    
    UPDATE user_daily_logins SET user_id = rec.new_id WHERE user_id = rec.old_id;
    
    -- 2. tibiatermo_user_games (unique: user_id + data_jogo)
    DELETE FROM tibiatermo_user_games 
    WHERE user_id = rec.old_id 
      AND EXISTS (
        SELECT 1 FROM tibiatermo_user_games tug2 
        WHERE tug2.user_id = rec.new_id 
          AND tug2.data_jogo = tibiatermo_user_games.data_jogo
      );
    
    UPDATE tibiatermo_user_games SET user_id = rec.new_id WHERE user_id = rec.old_id;
    
    -- 3. Tabelas sem constraint única - migrar direto
    UPDATE rubini_coins_history SET user_id = rec.new_id WHERE user_id = rec.old_id;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    IF rows_updated > 0 THEN RAISE NOTICE '  RC: %', rows_updated; END IF;
    
    UPDATE ticket_ledger SET user_id = rec.new_id WHERE user_id = rec.old_id;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    IF rows_updated > 0 THEN RAISE NOTICE '  Tickets: %', rows_updated; END IF;
    
    UPDATE tibiatermo_history SET user_id = rec.new_id WHERE user_id = rec.old_id;
    UPDATE daily_rewards_history SET user_id = rec.new_id WHERE user_id = rec.old_id;
    UPDATE spins SET user_id = rec.new_id WHERE user_id = rec.old_id;
    UPDATE chat_messages SET user_id = rec.new_id WHERE user_id = rec.old_id;
    UPDATE rubini_coins_resgates SET user_id = rec.new_id WHERE user_id = rec.old_id;
    UPDATE raffles SET vencedor_id = rec.new_id WHERE vencedor_id = rec.old_id;
  END LOOP;
  
  RAISE NOTICE '✅ Históricos migrados!';
  
  -- Recalcular saldos finais
  RAISE NOTICE 'Recalculando saldos...';
  
  INSERT INTO rubini_coins_balance (user_id, saldo)
  SELECT user_id, SUM(variacao)
  FROM rubini_coins_history
  WHERE status = 'confirmado'
  GROUP BY user_id
  ON CONFLICT (user_id) DO UPDATE SET saldo = EXCLUDED.saldo;
  
  INSERT INTO tickets (user_id, tickets_atual)
  SELECT user_id, SUM(variacao)
  FROM ticket_ledger
  GROUP BY user_id
  ON CONFLICT (user_id) DO UPDATE SET tickets_atual = EXCLUDED.tickets_atual;
  
  -- Zerar perfis inativos
  UPDATE rubini_coins_balance SET saldo = 0 WHERE user_id IN (SELECT id FROM profiles WHERE is_active = false);
  UPDATE tickets SET tickets_atual = 0 WHERE user_id IN (SELECT id FROM profiles WHERE is_active = false);
  
  RAISE NOTICE '✅ SALDOS RECALCULADOS!';
END $$;