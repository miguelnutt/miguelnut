-- ===================================================================
-- SOLUÇÃO COMPLETA PARA DUPLICAÇÃO DE PERFIS
-- ===================================================================

-- 1. Criar função reutilizável para buscar ou criar perfil (com mesclagem automática)
CREATE OR REPLACE FUNCTION public.get_or_merge_profile(
  p_twitch_username TEXT DEFAULT NULL,
  p_nome TEXT DEFAULT NULL,
  p_nome_personagem TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_duplicate_id UUID;
  v_tickets_main INT;
  v_tickets_dup INT;
BEGIN
  -- Validar que ao menos um parâmetro foi fornecido
  IF p_twitch_username IS NULL AND p_nome IS NULL THEN
    RAISE EXCEPTION 'É necessário fornecer twitch_username ou nome';
  END IF;

  -- 1. Tentar encontrar perfil por twitch_username (se fornecido)
  IF p_twitch_username IS NOT NULL THEN
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE twitch_username = p_twitch_username
    LIMIT 1;
    
    IF v_profile_id IS NOT NULL THEN
      -- Atualizar nome se fornecido e diferente
      IF p_nome IS NOT NULL THEN
        UPDATE profiles 
        SET nome = p_nome,
            nome_personagem = COALESCE(p_nome_personagem, nome_personagem)
        WHERE id = v_profile_id;
      END IF;
      
      RETURN v_profile_id;
    END IF;
  END IF;

  -- 2. Tentar encontrar perfil por nome (case-insensitive)
  IF p_nome IS NOT NULL THEN
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE LOWER(nome) = LOWER(p_nome)
    ORDER BY created_at ASC  -- Pegar o mais antigo
    LIMIT 1;
    
    IF v_profile_id IS NOT NULL THEN
      -- Se encontrou por nome mas tem twitch_username, atualizar
      IF p_twitch_username IS NOT NULL THEN
        UPDATE profiles 
        SET twitch_username = p_twitch_username,
            nome_personagem = COALESCE(p_nome_personagem, nome_personagem)
        WHERE id = v_profile_id;
      END IF;
      
      RETURN v_profile_id;
    END IF;
  END IF;

  -- 3. Nenhum perfil encontrado - criar novo
  v_profile_id := gen_random_uuid();
  
  INSERT INTO profiles (id, nome, twitch_username, nome_personagem)
  VALUES (
    v_profile_id,
    COALESCE(p_nome, p_twitch_username),
    p_twitch_username,
    p_nome_personagem
  );
  
  RETURN v_profile_id;
END;
$$;

-- 2. Criar função para mesclar perfis duplicados
CREATE OR REPLACE FUNCTION public.merge_duplicate_profiles(
  p_keep_profile_id UUID,
  p_remove_profile_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tickets_keep INT;
  v_tickets_remove INT;
BEGIN
  RAISE NOTICE 'Mesclando perfis: mantendo %, removendo %', p_keep_profile_id, p_remove_profile_id;
  
  -- Obter tickets de ambos os perfis
  SELECT COALESCE(tickets_atual, 0) INTO v_tickets_keep
  FROM tickets WHERE user_id = p_keep_profile_id;
  
  SELECT COALESCE(tickets_atual, 0) INTO v_tickets_remove
  FROM tickets WHERE user_id = p_remove_profile_id;
  
  -- Migrar todos os dados relacionados
  UPDATE ticket_ledger SET user_id = p_keep_profile_id WHERE user_id = p_remove_profile_id;
  UPDATE rubini_coins_balance SET user_id = p_keep_profile_id WHERE user_id = p_remove_profile_id;
  UPDATE rubini_coins_history SET user_id = p_keep_profile_id WHERE user_id = p_remove_profile_id;
  UPDATE tibiatermo_user_games SET user_id = p_keep_profile_id WHERE user_id = p_remove_profile_id;
  UPDATE tibiatermo_history SET user_id = p_keep_profile_id WHERE user_id = p_remove_profile_id;
  UPDATE daily_rewards_history SET user_id = p_keep_profile_id WHERE user_id = p_remove_profile_id;
  UPDATE user_daily_logins SET user_id = p_keep_profile_id WHERE user_id = p_remove_profile_id;
  UPDATE spins SET user_id = p_keep_profile_id WHERE user_id = p_remove_profile_id;
  UPDATE raffles SET vencedor_id = p_keep_profile_id WHERE vencedor_id = p_remove_profile_id;
  UPDATE chat_messages SET user_id = p_keep_profile_id WHERE user_id = p_remove_profile_id;
  UPDATE rubini_coins_resgates SET user_id = p_keep_profile_id WHERE user_id = p_remove_profile_id;
  
  -- Deletar tickets do perfil removido
  DELETE FROM tickets WHERE user_id = p_remove_profile_id;
  
  -- Atualizar/criar tickets consolidados
  INSERT INTO tickets (user_id, tickets_atual)
  VALUES (p_keep_profile_id, COALESCE(v_tickets_keep, 0) + COALESCE(v_tickets_remove, 0))
  ON CONFLICT (user_id) DO UPDATE 
  SET tickets_atual = EXCLUDED.tickets_atual;
  
  -- Deletar perfil duplicado
  DELETE FROM profiles WHERE id = p_remove_profile_id;
  
  RAISE NOTICE 'Mesclagem concluída. Tickets consolidados: %', COALESCE(v_tickets_keep, 0) + COALESCE(v_tickets_remove, 0);
END;
$$;

-- 3. Executar mesclagem de TODOS os perfis duplicados existentes
DO $$
DECLARE
  r RECORD;
  v_keep_id UUID;
  v_remove_id UUID;
BEGIN
  -- Para cada nome duplicado, mesclar os perfis
  FOR r IN (
    SELECT LOWER(nome) as nome_lower
    FROM profiles
    GROUP BY LOWER(nome)
    HAVING COUNT(*) > 1
  ) LOOP
    -- Pegar o perfil mais antigo (sem twitch_username) como principal
    SELECT id INTO v_keep_id
    FROM profiles
    WHERE LOWER(nome) = r.nome_lower AND twitch_username IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Se não tem sem twitch_username, pegar o mais antigo com twitch_username
    IF v_keep_id IS NULL THEN
      SELECT id INTO v_keep_id
      FROM profiles
      WHERE LOWER(nome) = r.nome_lower
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
    
    -- Pegar o perfil duplicado (mais recente, geralmente com twitch_username)
    SELECT id INTO v_remove_id
    FROM profiles
    WHERE LOWER(nome) = r.nome_lower AND id != v_keep_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_keep_id IS NOT NULL AND v_remove_id IS NOT NULL THEN
      -- Copiar twitch_username do duplicado para o principal se necessário
      UPDATE profiles 
      SET twitch_username = COALESCE(
        profiles.twitch_username,
        (SELECT twitch_username FROM profiles WHERE id = v_remove_id)
      )
      WHERE id = v_keep_id;
      
      -- Mesclar perfis
      PERFORM merge_duplicate_profiles(v_keep_id, v_remove_id);
      
      RAISE NOTICE 'Perfis mesclados para nome: %', r.nome_lower;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Mesclagem de todos os perfis duplicados concluída!';
END $$;