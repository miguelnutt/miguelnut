-- Consolidar perfis duplicados, mantendo sempre o que tem twitch_username
-- Esta migração vai mesclar os perfis duplicados e transferir os dados relacionados

DO $$
DECLARE
  duplicate_record RECORD;
  main_profile_id UUID;
  duplicate_profile_id UUID;
BEGIN
  -- Para cada conjunto de perfis com mesmo nome (case-insensitive)
  FOR duplicate_record IN 
    SELECT LOWER(nome) as nome_lower
    FROM profiles 
    GROUP BY LOWER(nome) 
    HAVING COUNT(*) > 1
  LOOP
    -- Encontrar o perfil principal (com twitch_username) e o duplicado (sem twitch_username)
    SELECT id INTO main_profile_id
    FROM profiles
    WHERE LOWER(nome) = duplicate_record.nome_lower
      AND twitch_username IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Se não tiver perfil com twitch_username, usar o mais antigo
    IF main_profile_id IS NULL THEN
      SELECT id INTO main_profile_id
      FROM profiles
      WHERE LOWER(nome) = duplicate_record.nome_lower
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
    
    -- Para cada perfil duplicado
    FOR duplicate_profile_id IN
      SELECT id
      FROM profiles
      WHERE LOWER(nome) = duplicate_record.nome_lower
        AND id != main_profile_id
    LOOP
      -- Transferir tickets do perfil duplicado para o principal
      UPDATE tickets
      SET user_id = main_profile_id
      WHERE user_id = duplicate_profile_id
        AND NOT EXISTS (
          SELECT 1 FROM tickets WHERE user_id = main_profile_id
        );
      
      -- Se já existir tickets no perfil principal, somar os tickets
      UPDATE tickets t1
      SET tickets_atual = t1.tickets_atual + COALESCE(
        (SELECT tickets_atual FROM tickets WHERE user_id = duplicate_profile_id), 0
      )
      WHERE t1.user_id = main_profile_id
        AND EXISTS (SELECT 1 FROM tickets WHERE user_id = duplicate_profile_id);
      
      -- Transferir ticket_ledger
      UPDATE ticket_ledger
      SET user_id = main_profile_id
      WHERE user_id = duplicate_profile_id;
      
      -- Transferir spins
      UPDATE spins
      SET user_id = main_profile_id
      WHERE user_id = duplicate_profile_id;
      
      -- Transferir raffles
      UPDATE raffles
      SET vencedor_id = main_profile_id
      WHERE vencedor_id = duplicate_profile_id;
      
      -- Transferir daily_rewards_history
      UPDATE daily_rewards_history
      SET user_id = main_profile_id
      WHERE user_id = duplicate_profile_id;
      
      -- Transferir user_daily_logins
      UPDATE user_daily_logins
      SET user_id = main_profile_id
      WHERE user_id = duplicate_profile_id
        AND NOT EXISTS (
          SELECT 1 FROM user_daily_logins WHERE user_id = main_profile_id
        );
      
      -- Deletar tickets duplicados (após merge)
      DELETE FROM tickets WHERE user_id = duplicate_profile_id;
      
      -- Deletar o perfil duplicado
      DELETE FROM profiles WHERE id = duplicate_profile_id;
      
      RAISE NOTICE 'Consolidado perfil % em %', duplicate_profile_id, main_profile_id;
    END LOOP;
  END LOOP;
END $$;