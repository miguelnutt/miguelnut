-- ============================================================
-- CORREÇÃO DEFINITIVA: IDENTIDADE ÚNICA POR TWITCH_USER_ID
-- ============================================================

-- 1. Adicionar coluna twitch_user_id à tabela profiles (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'twitch_user_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN twitch_user_id TEXT;
    COMMENT ON COLUMN public.profiles.twitch_user_id IS 'ID único e estável da Twitch (fonte da verdade)';
  END IF;
END $$;

-- 2. Criar tabela de aliases para rastrear mudanças de nome
CREATE TABLE IF NOT EXISTS public.user_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_display_name TEXT NOT NULL,
  old_login TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  twitch_user_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_aliases_user_id ON public.user_aliases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_aliases_twitch_user_id ON public.user_aliases(twitch_user_id);
CREATE INDEX IF NOT EXISTS idx_user_aliases_old_login ON public.user_aliases(LOWER(old_login));

COMMENT ON TABLE public.user_aliases IS 'Histórico de nomes anteriores do usuário (renomes da Twitch)';

-- 3. Adicionar campos de controle de mesclagem
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_name_canonical TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_merged_into ON public.profiles(merged_into) WHERE merged_into IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_twitch_user_id ON public.profiles(twitch_user_id) WHERE twitch_user_id IS NOT NULL;

-- 4. Criar tabela de auditoria de consolidação
CREATE TABLE IF NOT EXISTS public.profile_merge_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duplicate_profile_id UUID NOT NULL,
  canonical_profile_id UUID NOT NULL,
  rubini_coins_before_duplicate INTEGER NOT NULL DEFAULT 0,
  rubini_coins_before_canonical INTEGER NOT NULL DEFAULT 0,
  rubini_coins_after_canonical INTEGER NOT NULL DEFAULT 0,
  tickets_before_duplicate INTEGER NOT NULL DEFAULT 0,
  tickets_before_canonical INTEGER NOT NULL DEFAULT 0,
  tickets_after_canonical INTEGER NOT NULL DEFAULT 0,
  merged_by UUID,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_profile_merge_audit_duplicate ON public.profile_merge_audit(duplicate_profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_merge_audit_canonical ON public.profile_merge_audit(canonical_profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_merge_audit_merged_at ON public.profile_merge_audit(merged_at DESC);

COMMENT ON TABLE public.profile_merge_audit IS 'Auditoria de todas as consolidações de perfis duplicados';

-- 5. Atualizar constraint UNIQUE para twitch_user_id (quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_twitch_user_id_unique 
ON public.profiles(twitch_user_id) 
WHERE twitch_user_id IS NOT NULL AND is_active = true;

-- 6. Dropar função antiga e criar nova versão com twitch_user_id obrigatório
DROP FUNCTION IF EXISTS public.get_or_merge_profile(text, text, text);

CREATE FUNCTION public.get_or_merge_profile_v2(
  p_twitch_user_id TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_login TEXT DEFAULT NULL,
  p_nome_personagem TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_existing_display_name TEXT;
  v_existing_login TEXT;
BEGIN
  -- Validar que twitch_user_id foi fornecido
  IF p_twitch_user_id IS NULL OR p_twitch_user_id = '' THEN
    RAISE EXCEPTION 'twitch_user_id é obrigatório';
  END IF;

  -- 1. Buscar perfil ativo por twitch_user_id (fonte da verdade)
  SELECT id, display_name_canonical, twitch_username 
  INTO v_profile_id, v_existing_display_name, v_existing_login
  FROM profiles
  WHERE twitch_user_id = p_twitch_user_id
    AND is_active = true
  LIMIT 1;
  
  IF v_profile_id IS NOT NULL THEN
    -- Perfil encontrado: verificar se houve mudança de nome
    IF (p_display_name IS NOT NULL AND p_display_name != v_existing_display_name) OR
       (p_login IS NOT NULL AND p_login != v_existing_login) THEN
      
      -- Registrar alias antigo
      INSERT INTO user_aliases (user_id, old_display_name, old_login, twitch_user_id)
      VALUES (
        v_profile_id, 
        COALESCE(v_existing_display_name, 'unknown'),
        v_existing_login,
        p_twitch_user_id
      );
      
      -- Atualizar para o novo nome
      UPDATE profiles 
      SET 
        nome = COALESCE(p_display_name, nome),
        twitch_username = COALESCE(p_login, twitch_username),
        display_name_canonical = COALESCE(p_display_name, display_name_canonical),
        nome_personagem = COALESCE(p_nome_personagem, nome_personagem),
        updated_at = now()
      WHERE id = v_profile_id;
    END IF;
    
    RETURN v_profile_id;
  END IF;

  -- 2. Perfil não encontrado: criar novo (primeira vez que vemos este twitch_user_id)
  v_profile_id := gen_random_uuid();
  
  INSERT INTO profiles (
    id, 
    nome, 
    twitch_username, 
    twitch_user_id,
    display_name_canonical,
    nome_personagem,
    is_active
  )
  VALUES (
    v_profile_id,
    COALESCE(p_display_name, p_login, 'unknown'),
    p_login,
    p_twitch_user_id,
    p_display_name,
    p_nome_personagem,
    true
  );
  
  -- Criar balances zerados
  INSERT INTO rubini_coins_balance (user_id, saldo)
  VALUES (v_profile_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO tickets (user_id, tickets_atual)
  VALUES (v_profile_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN v_profile_id;
END;
$$;

COMMENT ON FUNCTION public.get_or_merge_profile_v2 IS 'Busca ou cria perfil usando twitch_user_id como chave única. Registra aliases ao detectar mudança de nome.';

-- 7. RLS para as novas tabelas
ALTER TABLE public.user_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os aliases"
ON public.user_aliases FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir aliases"
ON public.user_aliases FOR INSERT
WITH CHECK (true);

ALTER TABLE public.profile_merge_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver auditorias de merge"
ON public.profile_merge_audit FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir auditorias de merge"
ON public.profile_merge_audit FOR INSERT
WITH CHECK (true);