-- Adicionar política para admins poderem resetar progresso de recompensas diárias
CREATE POLICY "Admins podem deletar logins diários"
ON public.user_daily_logins
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));