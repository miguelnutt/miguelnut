-- Add DELETE policy for raffles table to allow admins to delete raffles
CREATE POLICY "Only admins can delete raffles"
ON public.raffles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));