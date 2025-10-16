-- ============================================
-- AJUSTE DE POLÍTICAS - Dados públicos visíveis
-- Mantendo proteção de dados sensíveis
-- ============================================

-- 1. TICKETS - Ranking visível publicamente
DROP POLICY IF EXISTS "Users can view own tickets" ON public.tickets;

CREATE POLICY "Everyone can view tickets ranking"
ON public.tickets
FOR SELECT
USING (true);

-- 2. PROFILES - Nomes públicos para ranking
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (true);

-- 3. SPINS - Histórico público
DROP POLICY IF EXISTS "Authenticated users can view spins" ON public.spins;

CREATE POLICY "Spins are viewable by everyone"
ON public.spins
FOR SELECT
USING (true);

-- 4. RAFFLES - Sorteios públicos
DROP POLICY IF EXISTS "Authenticated users can view raffles" ON public.raffles;

CREATE POLICY "Raffles are viewable by everyone"
ON public.raffles
FOR SELECT
USING (true);

-- 5. TICKET_LEDGER - Apenas admin pode ver (mantém privado)
-- Esta tabela continua restrita pois contém dados sensíveis de transações