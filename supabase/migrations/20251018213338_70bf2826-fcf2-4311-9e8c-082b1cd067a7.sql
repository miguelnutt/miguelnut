-- Remover política de admin que não é mais necessária
DROP POLICY IF EXISTS "Admins podem atualizar logins diários" ON public.user_daily_logins;