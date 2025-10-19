-- Corrigir RLS da tabela rubini_coins_balance para permitir acesso público de leitura
-- Os usuários veem apenas seu próprio saldo via código (não há coluna sensível)
-- Somente o sistema pode modificar saldos (via edge functions com service role key)

-- Remover política antiga de usuários
DROP POLICY IF EXISTS "Usuários podem ver próprio saldo de Rubini Coins" ON rubini_coins_balance;

-- Nova política: Todos podem ver qualquer saldo (não é informação sensível)
CREATE POLICY "Qualquer um pode ver saldos de Rubini Coins"
ON rubini_coins_balance
FOR SELECT
TO PUBLIC
USING (true);