-- Adicionar constraint UNIQUE em user_id para permitir upsert
-- Primeiro garantir que não há duplicatas
DELETE FROM public.user_daily_logins a
USING public.user_daily_logins b
WHERE a.id > b.id 
  AND a.user_id = b.user_id;

-- Agora adicionar a constraint UNIQUE
ALTER TABLE public.user_daily_logins 
ADD CONSTRAINT user_daily_logins_user_id_unique UNIQUE (user_id);