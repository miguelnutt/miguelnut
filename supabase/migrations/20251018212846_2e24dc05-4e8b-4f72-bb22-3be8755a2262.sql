-- Remover política antiga e recriar com WITH CHECK
DROP POLICY IF EXISTS "Admins podem atualizar logins diários" ON public.user_daily_logins;

-- Criar política completa para admins atualizarem
CREATE POLICY "Admins podem atualizar logins diários"
ON public.user_daily_logins
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));