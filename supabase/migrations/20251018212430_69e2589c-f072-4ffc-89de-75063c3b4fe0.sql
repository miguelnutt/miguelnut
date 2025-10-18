-- Atualizar todos os usuários existentes para terem a data de hoje (2025-10-18) como último resgate
UPDATE public.user_daily_logins
SET ultimo_login = '2025-10-18'
WHERE ultimo_login < '2025-10-18';