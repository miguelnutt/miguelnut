-- ============================================
-- CORREÇÃO CRÍTICA DE SEGURANÇA
-- Restringindo acesso a dados sensíveis
-- ============================================

-- 1. TICKETS - Apenas admin pode ver e apenas usuários logados veem seus próprios
DROP POLICY IF EXISTS "Tickets are viewable by everyone" ON public.tickets;

CREATE POLICY "Admins can view all tickets"
ON public.tickets
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own tickets"
ON public.tickets
FOR SELECT
USING (auth.uid() = user_id);

-- 2. TICKET_LEDGER - Apenas admin pode ver e usuários logados veem suas próprias transações
DROP POLICY IF EXISTS "Ticket ledger is viewable by everyone" ON public.ticket_ledger;

CREATE POLICY "Admins can view all ledger"
ON public.ticket_ledger
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own ledger"
ON public.ticket_ledger
FOR SELECT
USING (auth.uid() = user_id);

-- 3. PROFILES - Apenas usuários autenticados podem ver perfis
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 4. SPINS - Apenas usuários autenticados podem ver histórico
DROP POLICY IF EXISTS "Spins are viewable by everyone" ON public.spins;

CREATE POLICY "Authenticated users can view spins"
ON public.spins
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 5. RAFFLES - Apenas usuários autenticados podem ver raffles
DROP POLICY IF EXISTS "Raffles are viewable by everyone" ON public.raffles;

CREATE POLICY "Authenticated users can view raffles"
ON public.raffles
FOR SELECT
USING (auth.uid() IS NOT NULL);