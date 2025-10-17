-- Permitir que admins atualizem o status de pagamento nas tabelas spins e raffles
CREATE POLICY "Admins can update spins payment status"
ON public.spins
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update raffles payment status"
ON public.raffles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));