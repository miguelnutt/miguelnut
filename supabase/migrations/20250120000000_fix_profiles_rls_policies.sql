-- ============================================
-- CORREÇÃO DAS POLÍTICAS RLS PARA PROFILES
-- Permitir que edge functions possam salvar nome do personagem
-- ============================================

-- Remover políticas restritivas existentes
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Criar políticas mais permissivas para INSERT e UPDATE
-- Permitir que service role (edge functions) possa inserir/atualizar
CREATE POLICY "Allow service role and users to insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (
  -- Service role pode inserir qualquer perfil
  current_setting('role') = 'service_role'
  OR 
  -- Usuários autenticados podem inserir seu próprio perfil
  auth.uid() = id
);

CREATE POLICY "Allow service role and users to update profiles"
ON public.profiles
FOR UPDATE
USING (
  -- Service role pode atualizar qualquer perfil
  current_setting('role') = 'service_role'
  OR 
  -- Usuários autenticados podem atualizar seu próprio perfil
  auth.uid() = id
)
WITH CHECK (
  -- Service role pode atualizar qualquer perfil
  current_setting('role') = 'service_role'
  OR 
  -- Usuários autenticados podem atualizar seu próprio perfil
  auth.uid() = id
);

-- Comentários para documentação
COMMENT ON POLICY "Allow service role and users to insert profiles" ON public.profiles 
IS 'Permite que edge functions (service role) e usuários autenticados possam inserir perfis';

COMMENT ON POLICY "Allow service role and users to update profiles" ON public.profiles 
IS 'Permite que edge functions (service role) e usuários autenticados possam atualizar perfis, incluindo nome_personagem';