-- ANÁLISE ABRANGENTE DE PROBLEMAS DE USUÁRIOS
-- ============================================
-- Execute este script no Supabase SQL Editor para identificar todos os problemas

-- 1. IDENTIFICAR TODOS OS USUÁRIOS COM PERFIS DUPLICADOS
-- ======================================================
SELECT 
    '=== USUÁRIOS COM MÚLTIPLOS PERFIS ===' as secao;

SELECT 
    twitch_username,
    COUNT(*) as total_perfis,
    STRING_AGG(id::text, ', ' ORDER BY created_at) as profile_ids,
    STRING_AGG(
        CASE 
            WHEN nome_personagem IS NOT NULL THEN nome_personagem 
            ELSE 'SEM_PERSONAGEM' 
        END, 
        ' | ' ORDER BY created_at
    ) as personagens,
    STRING_AGG(
        CASE 
            WHEN twitch_user_id IS NOT NULL THEN twitch_user_id::text 
            ELSE 'SEM_TWITCH_ID' 
        END, 
        ' | ' ORDER BY created_at
    ) as twitch_ids,
    STRING_AGG(is_active::text, ' | ' ORDER BY created_at) as status_ativo,
    MIN(created_at) as primeiro_perfil,
    MAX(created_at) as ultimo_perfil
FROM public.profiles 
WHERE twitch_username IS NOT NULL
GROUP BY twitch_username 
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, twitch_username;

-- 2. USUÁRIOS SEM TWITCH_USER_ID (IMPEDEM RESGATES)
-- =================================================
SELECT 
    '=== USUÁRIOS SEM TWITCH_USER_ID ===' as secao;

SELECT 
    id,
    nome,
    twitch_username,
    nome_personagem,
    is_active,
    created_at,
    CASE 
        WHEN twitch_username IS NOT NULL THEN 'TEM_USERNAME_SEM_ID'
        ELSE 'SEM_USERNAME_E_ID'
    END as problema
FROM public.profiles 
WHERE twitch_user_id IS NULL 
AND is_active = true
ORDER BY created_at DESC;

-- 3. VERIFICAR SALDOS DE RUBINI COINS
-- ===================================
SELECT 
    '=== ANÁLISE DE SALDOS RUBINI COINS ===' as secao;

-- Verificar se usuários têm saldo na tabela de balance
SELECT 
    p.id,
    p.nome,
    p.twitch_username,
    p.nome_personagem,
    COALESCE(rcb.saldo, 0) as saldo_rubini_coins,
    p.is_active,
    p.created_at
FROM public.profiles p
LEFT JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
WHERE p.is_active = true
ORDER BY rcb.saldo DESC NULLS LAST, p.created_at DESC
LIMIT 20;

-- 4. USUÁRIOS COM HISTÓRICO DE RESGATES MAS SEM SALDO
-- ===================================================
SELECT 
    '=== USUÁRIOS COM RESGATES MAS SEM SALDO ===' as secao;

SELECT 
    p.id,
    p.nome,
    p.twitch_username,
    COUNT(rch.id) as total_resgates,
    SUM(rch.quantidade) as total_resgatado,
    COALESCE(rcb.saldo, 0) as saldo_atual,
    MAX(rch.created_at) as ultimo_resgate
FROM public.profiles p
INNER JOIN public.rubini_coins_history rch ON p.id = rch.user_id
LEFT JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
WHERE p.is_active = true
GROUP BY p.id, p.nome, p.twitch_username, rcb.saldo
HAVING COALESCE(rcb.saldo, 0) = 0
ORDER BY total_resgatado DESC;

-- 5. INCONSISTÊNCIAS DE DADOS
-- ===========================
SELECT 
    '=== INCONSISTÊNCIAS DE DADOS ===' as secao;

-- Usuários ativos sem nome de personagem
SELECT 
    'SEM_PERSONAGEM' as tipo_problema,
    COUNT(*) as total_usuarios,
    STRING_AGG(twitch_username, ', ') as usuarios_afetados
FROM public.profiles 
WHERE is_active = true 
AND nome_personagem IS NULL
AND twitch_username IS NOT NULL

UNION ALL

-- Usuários com twitch_username mas sem twitch_user_id
SELECT 
    'SEM_TWITCH_ID' as tipo_problema,
    COUNT(*) as total_usuarios,
    STRING_AGG(twitch_username, ', ') as usuarios_afetados
FROM public.profiles 
WHERE is_active = true 
AND twitch_username IS NOT NULL 
AND twitch_user_id IS NULL

UNION ALL

-- Usuários com nome duplicado mas twitch_username diferente
SELECT 
    'NOMES_DUPLICADOS' as tipo_problema,
    COUNT(*) as total_usuarios,
    STRING_AGG(DISTINCT nome, ', ') as usuarios_afetados
FROM public.profiles 
WHERE is_active = true 
AND nome IN (
    SELECT nome 
    FROM public.profiles 
    WHERE is_active = true 
    AND nome IS NOT NULL
    GROUP BY nome 
    HAVING COUNT(DISTINCT twitch_username) > 1
);

-- 6. RECOMENDAÇÕES DE CORREÇÃO
-- ============================
SELECT 
    '=== RECOMENDAÇÕES DE CORREÇÃO ===' as secao;

-- Contar problemas por categoria
WITH problemas AS (
    SELECT 'PERFIS_DUPLICADOS' as categoria, COUNT(DISTINCT twitch_username) as total
    FROM public.profiles 
    WHERE twitch_username IS NOT NULL
    GROUP BY twitch_username 
    HAVING COUNT(*) > 1
    
    UNION ALL
    
    SELECT 'SEM_TWITCH_ID' as categoria, COUNT(*) as total
    FROM public.profiles 
    WHERE is_active = true AND twitch_user_id IS NULL
    
    UNION ALL
    
    SELECT 'SEM_PERSONAGEM' as categoria, COUNT(*) as total
    FROM public.profiles 
    WHERE is_active = true AND nome_personagem IS NULL
    
    UNION ALL
    
    SELECT 'SEM_SALDO_BALANCE' as categoria, COUNT(*) as total
    FROM public.profiles p
    LEFT JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
    WHERE p.is_active = true AND rcb.saldo IS NULL
)
SELECT 
    categoria,
    total,
    CASE categoria
        WHEN 'PERFIS_DUPLICADOS' THEN 'Executar consolidação de perfis duplicados'
        WHEN 'SEM_TWITCH_ID' THEN 'Executar função populate-twitch-user-ids'
        WHEN 'SEM_PERSONAGEM' THEN 'Solicitar aos usuários para cadastrar personagem'
        WHEN 'SEM_SALDO_BALANCE' THEN 'Executar reconcile-balance para criar registros'
        ELSE 'Investigar manualmente'
    END as recomendacao
FROM problemas
WHERE total > 0
ORDER BY total DESC;

-- 7. SCRIPT DE VERIFICAÇÃO FINAL
-- ==============================
SELECT 
    '=== RESUMO FINAL ===' as secao;

SELECT 
    'TOTAL_PERFIS' as metrica,
    COUNT(*) as valor
FROM public.profiles

UNION ALL

SELECT 
    'PERFIS_ATIVOS' as metrica,
    COUNT(*) as valor
FROM public.profiles 
WHERE is_active = true

UNION ALL

SELECT 
    'PERFIS_COM_TWITCH_ID' as metrica,
    COUNT(*) as valor
FROM public.profiles 
WHERE is_active = true AND twitch_user_id IS NOT NULL

UNION ALL

SELECT 
    'PERFIS_COM_PERSONAGEM' as metrica,
    COUNT(*) as valor
FROM public.profiles 
WHERE is_active = true AND nome_personagem IS NOT NULL

UNION ALL

SELECT 
    'PERFIS_COM_SALDO' as metrica,
    COUNT(*) as valor
FROM public.profiles p
INNER JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
WHERE p.is_active = true AND rcb.saldo > 0;