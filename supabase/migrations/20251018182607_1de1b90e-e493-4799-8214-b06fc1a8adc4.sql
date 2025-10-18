-- Adicionar política de DELETE para admins na tabela rubini_coins_history
CREATE POLICY "Admins podem deletar histórico de Rubini Coins"
ON public.rubini_coins_history
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));