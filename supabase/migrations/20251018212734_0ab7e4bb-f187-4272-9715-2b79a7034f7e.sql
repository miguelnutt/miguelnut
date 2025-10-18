-- Permitir que admins possam atualizar logins diários de qualquer usuário
CREATE POLICY "Admins podem atualizar logins diários"
ON public.user_daily_logins
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));