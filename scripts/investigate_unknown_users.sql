-- Script para investigar problemas de usuários desconhecidos
-- Baseado nas imagens fornecidas pelo usuário

-- 1. Verificar usuários no ranking de tickets que não têm perfil correspondente
SELECT 
    'TICKETS SEM PERFIL' as problema,
    t.user_id,
    COUNT(*) as quantidade_tickets
FROM tickets t
LEFT JOIN profiles p ON t.user_id = p.id
WHERE p.id IS NULL
GROUP BY t.user_id
ORDER BY quantidade_tickets DESC;

-- 2. Verificar usuários no ranking de tickets com perfil mas sem twitch_username
SELECT 
    'PERFIL SEM TWITCH_USERNAME' as problema,
    p.id,
    p.nome,
    p.twitch_username,
    COUNT(t.id) as quantidade_tickets
FROM tickets t
JOIN profiles p ON t.user_id = p.id
WHERE p.twitch_username IS NULL OR p.twitch_username = ''
GROUP BY p.id, p.nome, p.twitch_username
ORDER BY quantidade_tickets DESC;

-- 3. Verificar spins no histórico que não têm perfil correspondente
SELECT 
    'SPINS SEM PERFIL' as problema,
    s.user_id,
    s.nome_usuario,
    COUNT(*) as quantidade_spins
FROM spins s
LEFT JOIN profiles p ON s.user_id = p.id
WHERE p.id IS NULL
GROUP BY s.user_id, s.nome_usuario
ORDER BY quantidade_spins DESC;

-- 4. Verificar inconsistências entre nome_usuario nos spins e twitch_username nos profiles
SELECT 
    'INCONSISTENCIA NOME_USUARIO' as problema,
    s.nome_usuario as nome_no_spin,
    p.twitch_username as nome_no_perfil,
    p.nome as nome_display,
    COUNT(*) as quantidade_spins
FROM spins s
JOIN profiles p ON s.user_id = p.id
WHERE s.nome_usuario != p.twitch_username 
   OR (s.nome_usuario IS NOT NULL AND p.twitch_username IS NULL)
   OR (s.nome_usuario IS NULL AND p.twitch_username IS NOT NULL)
GROUP BY s.nome_usuario, p.twitch_username, p.nome
ORDER BY quantidade_spins DESC;

-- 5. Verificar todos os perfis que têm tickets mas não têm twitch_username
SELECT 
    'RANKING_TICKETS_PROBLEMA' as problema,
    p.id,
    p.nome,
    p.twitch_username,
    SUM(t.quantidade) as total_tickets
FROM profiles p
JOIN tickets t ON p.id = t.user_id
WHERE p.twitch_username IS NULL OR p.twitch_username = ''
GROUP BY p.id, p.nome, p.twitch_username
ORDER BY total_tickets DESC;

-- 6. Verificar estrutura da tabela profiles para entender campos disponíveis
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Verificar estrutura da tabela spins para entender campos disponíveis
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'spins' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. Verificar estrutura da tabela tickets para entender campos disponíveis
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tickets' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. Verificar alguns exemplos de dados problemáticos
SELECT 
    'EXEMPLO_TICKETS_PROBLEMA' as tipo,
    p.nome,
    p.twitch_username,
    SUM(t.quantidade) as total_tickets
FROM profiles p
JOIN tickets t ON p.id = t.user_id
WHERE p.twitch_username IS NULL OR p.twitch_username = ''
GROUP BY p.id, p.nome, p.twitch_username
ORDER BY total_tickets DESC
LIMIT 10;

-- 10. Verificar alguns exemplos de spins problemáticos
SELECT 
    'EXEMPLO_SPINS_PROBLEMA' as tipo,
    s.nome_usuario,
    p.nome,
    p.twitch_username,
    COUNT(*) as quantidade_spins
FROM spins s
LEFT JOIN profiles p ON s.user_id = p.id
WHERE p.twitch_username IS NULL OR p.twitch_username = '' OR p.id IS NULL
GROUP BY s.nome_usuario, p.nome, p.twitch_username
ORDER BY quantidade_spins DESC
LIMIT 10;