-- ============================================
-- CORREÇÃO AUTOMÁTICA DE SALDOS - FASE 1: LIMPEZA
-- ============================================

-- 1. LIMPAR REGISTROS ÓRFÃOS (user_ids que não existem em profiles)
DO $$
DECLARE
  count_orfaos INT;
BEGIN
  RAISE NOTICE 'Limpando registros órfãos...';
  
  -- Tickets órfãos
  DELETE FROM ticket_ledger 
  WHERE user_id NOT IN (SELECT id FROM profiles);
  
  GET DIAGNOSTICS count_orfaos = ROW_COUNT;
  RAISE NOTICE 'Removidos % registros órfãos de ticket_ledger', count_orfaos;
  
  -- RC órfãos
  DELETE FROM rubini_coins_history 
  WHERE user_id NOT IN (SELECT id FROM profiles);
  
  GET DIAGNOSTICS count_orfaos = ROW_COUNT;
  RAISE NOTICE 'Removidos % registros órfãos de rubini_coins_history', count_orfaos;
  
  -- Saldos órfãos
  DELETE FROM tickets 
  WHERE user_id NOT IN (SELECT id FROM profiles);
  
  GET DIAGNOSTICS count_orfaos = ROW_COUNT;
  RAISE NOTICE 'Removidos % registros órfãos de tickets', count_orfaos;
  
  DELETE FROM rubini_coins_balance 
  WHERE user_id NOT IN (SELECT id FROM profiles);
  
  GET DIAGNOSTICS count_orfaos = ROW_COUNT;
  RAISE NOTICE 'Removidos % registros órfãos de rubini_coins_balance', count_orfaos;
  
  RAISE NOTICE 'Limpeza concluída!';
END $$;

-- 2. RECALCULAR SALDOS DE RUBINI COINS
DO $$
DECLARE
  rec RECORD;
  saldo_correto INT;
BEGIN
  RAISE NOTICE 'Recalculando Rubini Coins...';
  
  FOR rec IN 
    SELECT user_id, SUM(variacao) as total
    FROM rubini_coins_history
    WHERE status = 'confirmado'
    GROUP BY user_id
  LOOP
    INSERT INTO rubini_coins_balance (user_id, saldo)
    VALUES (rec.user_id, rec.total)
    ON CONFLICT (user_id) 
    DO UPDATE SET saldo = EXCLUDED.saldo;
  END LOOP;
  
  RAISE NOTICE 'RC recalculados!';
END $$;

-- 3. RECALCULAR SALDOS DE TICKETS
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Recalculando Tickets...';
  
  FOR rec IN 
    SELECT user_id, SUM(variacao) as total
    FROM ticket_ledger
    GROUP BY user_id
  LOOP
    INSERT INTO tickets (user_id, tickets_atual)
    VALUES (rec.user_id, rec.total)
    ON CONFLICT (user_id) 
    DO UPDATE SET tickets_atual = EXCLUDED.tickets_atual;
  END LOOP;
  
  RAISE NOTICE 'Tickets recalculados!';
END $$;