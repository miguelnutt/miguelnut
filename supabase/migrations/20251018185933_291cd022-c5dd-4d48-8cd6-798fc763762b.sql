-- Adicionar política para permitir que todos vejam o histórico de Rubini Coins
-- (recompensas públicas de sorteios e roletas)
CREATE POLICY "Todos podem ver histórico público de Rubini Coins" 
ON public.rubini_coins_history 
FOR SELECT 
USING (true);