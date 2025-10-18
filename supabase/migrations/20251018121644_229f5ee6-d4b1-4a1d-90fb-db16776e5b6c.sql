-- Verificar se existe constraint duplicada e ajustar se necessário
-- A tabela user_daily_logins já tem user_id como chave primária ou unique
-- Vamos garantir que o upsert funcione corretamente

-- Primeiro, verificar se há constraint duplicada
DO $$ 
BEGIN
  -- Remover constraint antiga se existir (além da PK)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_daily_logins_user_id_key' 
    AND contype = 'u'
  ) THEN
    ALTER TABLE public.user_daily_logins 
    DROP CONSTRAINT user_daily_logins_user_id_key;
  END IF;
END $$;