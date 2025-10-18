-- Permitir que qualquer um veja resgates (já que não contém info sensível)
DROP POLICY IF EXISTS "Usuários podem ver próprios resgates" ON public.rubini_coins_resgates;

CREATE POLICY "Qualquer um pode ver resgates"
ON public.rubini_coins_resgates
FOR SELECT
USING (true);

-- Manter a policy de admin para ver tudo
-- (já existe a policy "Admins podem ver todos os resgates")

-- Permitir que qualquer um crie resgates (já que validamos no edge function)
DROP POLICY IF EXISTS "Usuários podem criar resgates" ON public.rubini_coins_resgates;

CREATE POLICY "Qualquer um pode criar resgates"
ON public.rubini_coins_resgates
FOR INSERT
WITH CHECK (true);