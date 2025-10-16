-- Adicionar política para permitir que admins deletem do histórico de spins
CREATE POLICY "Only admins can delete spins"
ON public.spins
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));