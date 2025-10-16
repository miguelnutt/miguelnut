-- Adicionar política para permitir que admins deletem do ticket_ledger
CREATE POLICY "Only admins can delete ticket ledger"
ON public.ticket_ledger
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));