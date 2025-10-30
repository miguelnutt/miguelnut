-- ============================================
-- CORREÇÃO CRÍTICA: POLÍTICAS RLS PARA TICKETS
-- Permitir que Edge Functions (service role) possam gerenciar tickets
-- ============================================

-- ===== TABELA TICKETS =====

-- Remover políticas restritivas existentes para INSERT/UPDATE
DROP POLICY IF EXISTS "Only admins can manage tickets" ON public.tickets;

-- Criar políticas para INSERT (upsert de saldos)
CREATE POLICY "Allow service role and admins to insert tickets"
ON public.tickets
FOR INSERT
WITH CHECK (
  -- Service role (Edge Functions) pode inserir qualquer registro
  current_setting('role') = 'service_role'
  OR 
  -- Admins podem inserir registros
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Criar políticas para UPDATE (atualização de saldos)
CREATE POLICY "Allow service role and admins to update tickets"
ON public.tickets
FOR UPDATE
USING (
  -- Service role (Edge Functions) pode atualizar qualquer registro
  current_setting('role') = 'service_role'
  OR 
  -- Admins podem atualizar registros
  public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  -- Service role (Edge Functions) pode atualizar qualquer registro
  current_setting('role') = 'service_role'
  OR 
  -- Admins podem atualizar registros
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- ===== TABELA TICKET_LEDGER =====

-- Remover políticas restritivas existentes para INSERT
DROP POLICY IF EXISTS "Only admins can create ticket ledger entries" ON public.ticket_ledger;

-- Criar política para INSERT (registro de transações)
CREATE POLICY "Allow service role and admins to insert ticket ledger"
ON public.ticket_ledger
FOR INSERT
WITH CHECK (
  -- Service role (Edge Functions) pode inserir qualquer registro
  current_setting('role') = 'service_role'
  OR 
  -- Admins podem inserir registros
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Criar política para UPDATE (atualização de status de transações)
CREATE POLICY "Allow service role and admins to update ticket ledger"
ON public.ticket_ledger
FOR UPDATE
USING (
  -- Service role (Edge Functions) pode atualizar qualquer registro
  current_setting('role') = 'service_role'
  OR 
  -- Admins podem atualizar registros
  public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  -- Service role (Edge Functions) pode atualizar qualquer registro
  current_setting('role') = 'service_role'
  OR 
  -- Admins podem atualizar registros
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- ===== COMENTÁRIOS PARA DOCUMENTAÇÃO =====

COMMENT ON POLICY "Allow service role and admins to insert tickets" ON public.tickets 
IS 'Permite que Edge Functions (service role) e admins possam inserir/atualizar saldos de tickets';

COMMENT ON POLICY "Allow service role and admins to update tickets" ON public.tickets 
IS 'Permite que Edge Functions (service role) e admins possam atualizar saldos de tickets';

COMMENT ON POLICY "Allow service role and admins to insert ticket ledger" ON public.ticket_ledger 
IS 'Permite que Edge Functions (service role) e admins possam registrar transações de tickets';

COMMENT ON POLICY "Allow service role and admins to update ticket ledger" ON public.ticket_ledger 
IS 'Permite que Edge Functions (service role) e admins possam atualizar status de transações de tickets';

-- ===== VERIFICAÇÃO DE INTEGRIDADE =====

-- Verificar se as políticas foram criadas corretamente
DO $$
BEGIN
  -- Verificar se as políticas existem
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tickets' 
    AND policyname = 'Allow service role and admins to insert tickets'
  ) THEN
    RAISE EXCEPTION 'Política de INSERT para tickets não foi criada corretamente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ticket_ledger' 
    AND policyname = 'Allow service role and admins to insert ticket ledger'
  ) THEN
    RAISE EXCEPTION 'Política de INSERT para ticket_ledger não foi criada corretamente';
  END IF;

  RAISE NOTICE 'Políticas RLS para tickets corrigidas com sucesso!';
END $$;