-- Remover foreign key constraints que impedem criar perfis sem usuário auth
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.spins DROP CONSTRAINT IF EXISTS spins_user_id_fkey;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_user_id_fkey;
ALTER TABLE public.ticket_ledger DROP CONSTRAINT IF EXISTS ticket_ledger_user_id_fkey;
ALTER TABLE public.raffles DROP CONSTRAINT IF EXISTS raffles_vencedor_id_fkey;

-- Função para criar perfil automaticamente quando um usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil automaticamente após cada novo usuário
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- Função para buscar ou criar perfil por nome (para roleta)
CREATE OR REPLACE FUNCTION public.get_or_create_profile_by_name(p_nome TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Tentar encontrar perfil existente (case-insensitive)
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE LOWER(nome) = LOWER(p_nome)
  LIMIT 1;
  
  -- Se encontrou, retornar
  IF v_user_id IS NOT NULL THEN
    RETURN v_user_id;
  END IF;
  
  -- Se não encontrou, criar novo perfil com UUID gerado
  v_user_id := gen_random_uuid();
  
  INSERT INTO public.profiles (id, nome)
  VALUES (v_user_id, p_nome);
  
  RETURN v_user_id;
END;
$$;

-- Recuperar dados históricos: criar perfis para nomes que já existem em spins
DO $$
DECLARE
  r RECORD;
  v_user_id UUID;
BEGIN
  FOR r IN (
    SELECT DISTINCT nome_usuario
    FROM spins
    WHERE tipo_recompensa = 'Tickets'
      AND user_id IS NULL
      AND nome_usuario IS NOT NULL
      AND nome_usuario != ''
  ) LOOP
    -- Usar a função para criar/buscar perfil
    SELECT public.get_or_create_profile_by_name(r.nome_usuario) INTO v_user_id;
    
    -- Atualizar spins com o user_id correto
    UPDATE spins
    SET user_id = v_user_id
    WHERE nome_usuario = r.nome_usuario
      AND user_id IS NULL;
  END LOOP;
END $$;

-- Calcular e inserir tickets retroativos
INSERT INTO tickets (user_id, tickets_atual)
SELECT 
  user_id,
  SUM(CAST(valor AS INTEGER)) as total_tickets
FROM spins
WHERE tipo_recompensa = 'Tickets'
  AND user_id IS NOT NULL
GROUP BY user_id
ON CONFLICT (user_id) 
DO UPDATE SET tickets_atual = tickets.tickets_atual + EXCLUDED.tickets_atual;

-- Adicionar entradas no ledger para auditoria dos tickets históricos
INSERT INTO ticket_ledger (user_id, variacao, motivo)
SELECT 
  user_id,
  SUM(CAST(valor AS INTEGER)) as variacao,
  'Recuperação de tickets históricos da roleta'
FROM spins
WHERE tipo_recompensa = 'Tickets'
  AND user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ticket_ledger tl 
    WHERE tl.user_id = spins.user_id 
    AND tl.motivo LIKE 'Recuperação de tickets%'
  )
GROUP BY user_id
HAVING SUM(CAST(valor AS INTEGER)) > 0;