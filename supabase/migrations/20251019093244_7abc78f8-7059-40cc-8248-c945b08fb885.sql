-- Migrar dados do perfil antigo "eo_vitur" para o perfil com twitch_username

-- 1. Atualizar o perfil antigo para incluir o twitch_username
UPDATE profiles
SET twitch_username = 'eo_vitur'
WHERE id = 'a3152d51-0442-4e9b-8bd9-726a421a7c36'
  AND twitch_username IS NULL;

-- 2. Deletar o perfil duplicado mais recente (que não tem saldo)
DELETE FROM profiles
WHERE id = '623a72dc-2db9-49f0-ac1f-e60f5089ecb9';