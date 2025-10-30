-- Script para adicionar o usuário "Miguelnutt" como administrador

-- 1. Buscar o usuário "Miguelnutt" na tabela profiles
SELECT 
    id,
    nome,
    twitch_username,
    created_at
FROM profiles 
WHERE LOWER(twitch_username) = LOWER('Miguelnutt')
   OR LOWER(nome) = LOWER('Miguelnutt')
   OR LOWER(display_name_canonical) = LOWER('Miguelnutt');

-- 2. Verificar se já possui role de admin (substitua USER_ID_AQUI pelo ID encontrado acima)
-- SELECT * FROM user_roles WHERE user_id = 'USER_ID_AQUI' AND role = 'admin';

-- 3. Adicionar role de admin (substitua USER_ID_AQUI pelo ID encontrado na primeira query)
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ('USER_ID_AQUI', 'admin'::app_role)
-- ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Verificar se a role foi adicionada corretamente
-- SELECT 
--     p.nome,
--     p.twitch_username,
--     ur.role,
--     ur.created_at as role_created_at
-- FROM profiles p
-- JOIN user_roles ur ON p.id = ur.user_id
-- WHERE p.id = 'USER_ID_AQUI';