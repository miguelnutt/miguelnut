-- Adicionar política para permitir que admins criem perfis para outros usuários
CREATE POLICY "Admins can insert any profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));