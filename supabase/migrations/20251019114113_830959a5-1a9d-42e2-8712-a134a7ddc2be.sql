
-- Consolidar perfil do leonardocx
-- Perfil mais antigo ficará com o twitch_username e os dados serão mesclados

DO $$
DECLARE
  v_perfil_antigo UUID;
  v_perfil_novo UUID;
  v_tickets_antigo INT;
  v_tickets_novo INT;
  v_total_tickets INT;
BEGIN
  -- Identificar os dois perfis (assumindo que o mais antigo não tem twitch_username)
  SELECT id INTO v_perfil_antigo 
  FROM profiles 
  WHERE LOWER(nome) = 'leonardocx' AND twitch_username IS NULL
  LIMIT 1;
  
  SELECT id INTO v_perfil_novo
  FROM profiles 
  WHERE LOWER(nome) = 'leonardocx' AND twitch_username = 'leonardocx'
  LIMIT 1;
  
  -- Se encontrou ambos os perfis, fazer a mesclagem
  IF v_perfil_antigo IS NOT NULL AND v_perfil_novo IS NOT NULL THEN
    RAISE NOTICE 'Mesclando perfis: % (antigo) e % (novo)', v_perfil_antigo, v_perfil_novo;
    
    -- Obter tickets de ambos os perfis
    SELECT COALESCE(tickets_atual, 0) INTO v_tickets_antigo
    FROM tickets WHERE user_id = v_perfil_antigo;
    
    SELECT COALESCE(tickets_atual, 0) INTO v_tickets_novo
    FROM tickets WHERE user_id = v_perfil_novo;
    
    v_total_tickets := COALESCE(v_tickets_antigo, 0) + COALESCE(v_tickets_novo, 0);
    
    RAISE NOTICE 'Tickets antigo: %, novo: %, total: %', v_tickets_antigo, v_tickets_novo, v_total_tickets;
    
    -- Atualizar perfil antigo com twitch_username
    UPDATE profiles 
    SET twitch_username = 'leonardocx'
    WHERE id = v_perfil_antigo;
    
    -- Migrar todos os dados do perfil novo para o antigo
    
    -- Migrar ticket_ledger
    UPDATE ticket_ledger 
    SET user_id = v_perfil_antigo 
    WHERE user_id = v_perfil_novo;
    
    -- Migrar rubini_coins_balance
    UPDATE rubini_coins_balance 
    SET user_id = v_perfil_antigo 
    WHERE user_id = v_perfil_novo;
    
    -- Migrar rubini_coins_history
    UPDATE rubini_coins_history 
    SET user_id = v_perfil_antigo 
    WHERE user_id = v_perfil_novo;
    
    -- Migrar tibiatermo_user_games
    UPDATE tibiatermo_user_games 
    SET user_id = v_perfil_antigo 
    WHERE user_id = v_perfil_novo;
    
    -- Migrar tibiatermo_history
    UPDATE tibiatermo_history 
    SET user_id = v_perfil_antigo 
    WHERE user_id = v_perfil_novo;
    
    -- Migrar daily_rewards_history
    UPDATE daily_rewards_history 
    SET user_id = v_perfil_antigo 
    WHERE user_id = v_perfil_novo;
    
    -- Migrar user_daily_logins
    UPDATE user_daily_logins 
    SET user_id = v_perfil_antigo 
    WHERE user_id = v_perfil_novo;
    
    -- Deletar tickets do perfil novo
    DELETE FROM tickets WHERE user_id = v_perfil_novo;
    
    -- Atualizar/criar tickets no perfil antigo com total consolidado
    INSERT INTO tickets (user_id, tickets_atual)
    VALUES (v_perfil_antigo, v_total_tickets)
    ON CONFLICT (user_id) DO UPDATE SET tickets_atual = v_total_tickets;
    
    -- Deletar perfil duplicado
    DELETE FROM profiles WHERE id = v_perfil_novo;
    
    RAISE NOTICE 'Perfis mesclados com sucesso! Total de tickets: %', v_total_tickets;
  ELSE
    RAISE NOTICE 'Perfis não encontrados para mesclagem';
  END IF;
END $$;
