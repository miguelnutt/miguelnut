-- ============================================
-- CORREÇÃO CRÍTICA: POLÍTICAS RLS PARA TICKETS
-- EXECUTE ESTE SCRIPT NO PAINEL DO SUPABASE (SQL Editor)
-- ============================================

-- PROBLEMA IDENTIFICADO:
-- As Edge Functions não conseguem inserir/atualizar nas tabelas 'tickets' e 'ticket_ledger'
-- porque as políticas RLS só permitem acesso para admins, mas as Edge Functions
-- executam com service_role e precisam de permissões específicas.

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

-- ===== VERIFICAÇÃO =====
-- Verificar se as políticas foram criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('tickets', 'ticket_ledger')
ORDER BY tablename, policyname;

-- Mensagem de sucesso
SELECT 'Políticas RLS para tickets corrigidas com sucesso!' as status;