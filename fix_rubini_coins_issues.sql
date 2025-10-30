-- Script para corrigir problemas identificados no debugging dos Rubini Coins
-- Executar este script no Supabase SQL Editor

-- 1. ANÁLISE DETALHADA DOS PROBLEMAS IDENTIFICADOS
-- ================================================

-- Verificar duplicatas do usuário Brux0D
SELECT 
    id,
    nome,
    twitch_username,
    twitch_user_id,
    nome_personagem,
    is_active,
    created_at,
    updated_at
FROM public.profiles 
WHERE LOWER(twitch_username) = 'brux0d' 
ORDER BY created_at;

-- Verificar todos os usuários com múltiplos perfis
SELECT 
    twitch_username,
    COUNT(*) as perfis_count,
    STRING_AGG(id::text, ', ') as profile_ids,
    STRING_AGG(nome_personagem, ' | ') as personagens
FROM public.profiles 
WHERE twitch_username IS NOT NULL
GROUP BY twitch_username 
HAVING COUNT(*) > 1
ORDER BY perfis_count DESC;

-- Verificar perfis sem twitch_user_id
SELECT 
    COUNT(*) as perfis_sem_twitch_id,
    COUNT(CASE WHEN is_active = true THEN 1 END) as ativos_sem_twitch_id
FROM public.profiles 
WHERE twitch_user_id IS NULL;

-- 2. INVESTIGAÇÃO DO SISTEMA DE SALDO RUBINI COINS
-- ===============================================

-- Verificar se existe tabela de saldo de Rubini Coins
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND (column_name ILIKE '%rubini%' OR column_name ILIKE '%coin%' OR table_name ILIKE '%rubini%');

-- Verificar saldos na tabela profiles (se existir coluna)
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN rubini_coins > 0 THEN 1 END) as profiles_with_balance,
    AVG(rubini_coins) as avg_balance,
    MAX(rubini_coins) as max_balance,
    MIN(rubini_coins) as min_balance
FROM public.profiles 
WHERE rubini_coins IS NOT NULL;

-- Verificar se existe tabela separada para saldos
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
AND (tablename ILIKE '%rubini%' OR tablename ILIKE '%coin%' OR tablename ILIKE '%balance%');

-- 3. CORREÇÕES AUTOMÁTICAS
-- ========================

-- A. Consolidar perfis duplicados do Brux0D
-- Primeiro, identificar o perfil principal (mais antigo com mais dados)
WITH brux0d_profiles AS (
    SELECT 
        id,
        nome,
        twitch_username,
        twitch_user_id,
        nome_personagem,
        is_active,
        created_at,
        updated_at,
        ROW_NUMBER() OVER (ORDER BY 
            CASE WHEN twitch_user_id IS NOT NULL THEN 0 ELSE 1 END,
            created_at ASC
        ) as priority_rank
    FROM public.profiles 
    WHERE LOWER(twitch_username) = 'brux0d'
),
main_profile AS (
    SELECT * FROM brux0d_profiles WHERE priority_rank = 1
),
duplicate_profiles AS (
    SELECT * FROM brux0d_profiles WHERE priority_rank > 1
)
-- Mostrar qual será o perfil principal e quais serão removidos
SELECT 
    'PERFIL PRINCIPAL' as tipo,
    id,
    nome,
    twitch_user_id,
    nome_personagem,
    created_at
FROM main_profile
UNION ALL
SELECT 
    'DUPLICATA - SERÁ REMOVIDO' as tipo,
    id,
    nome,
    twitch_user_id,
    nome_personagem,
    created_at
FROM duplicate_profiles
ORDER BY tipo, created_at;

-- B. Script para executar a consolidação (CUIDADO - EXECUTAR APENAS APÓS VERIFICAÇÃO)
/*
-- ATENÇÃO: Descomente e execute apenas após verificar os resultados acima

-- Atualizar histórico de resgates para apontar para o perfil principal
WITH brux0d_main AS (
    SELECT id 
    FROM public.profiles 
    WHERE LOWER(twitch_username) = 'brux0d' 
    AND twitch_user_id IS NOT NULL
    ORDER BY created_at ASC 
    LIMIT 1
),
brux0d_duplicates AS (
    SELECT id 
    FROM public.profiles 
    WHERE LOWER(twitch_username) = 'brux0d' 
    AND id NOT IN (SELECT id FROM brux0d_main)
)
UPDATE public.rubini_coins_resgates 
SET user_id = (SELECT id FROM brux0d_main)
WHERE user_id IN (SELECT id FROM brux0d_duplicates);

-- Remover perfis duplicados do Brux0D
DELETE FROM public.profiles 
WHERE LOWER(twitch_username) = 'brux0d' 
AND id NOT IN (
    SELECT id 
    FROM public.profiles 
    WHERE LOWER(twitch_username) = 'brux0d' 
    ORDER BY 
        CASE WHEN twitch_user_id IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC 
    LIMIT 1
);
*/

-- 4. VERIFICAÇÃO DO SISTEMA DE PONTOS/SALDO
-- =========================================

-- Verificar se existe integração com StreamElements
SELECT 
    COUNT(*) as profiles_with_streamelements,
    AVG(CAST(streamelements_points AS INTEGER)) as avg_points
FROM public.profiles 
WHERE streamelements_points IS NOT NULL 
AND streamelements_points != '0';

-- Verificar últimas transações de pontos
SELECT 
    user_id,
    action_type,
    points_change,
    new_balance,
    created_at
FROM public.points_history 
ORDER BY created_at DESC 
LIMIT 20;

-- 5. DIAGNÓSTICO FINAL
-- ====================

-- Resumo dos problemas encontrados
SELECT 
    'Perfis Duplicados' as problema,
    COUNT(*) as quantidade
FROM (
    SELECT twitch_username
    FROM public.profiles 
    WHERE twitch_username IS NOT NULL
    GROUP BY twitch_username 
    HAVING COUNT(*) > 1
) duplicates

UNION ALL

SELECT 
    'Perfis sem Twitch ID' as problema,
    COUNT(*) as quantidade
FROM public.profiles 
WHERE twitch_user_id IS NULL

UNION ALL

SELECT 
    'Perfis sem Nome Personagem' as problema,
    COUNT(*) as quantidade
FROM public.profiles 
WHERE nome_personagem IS NULL OR nome_personagem = ''

UNION ALL

SELECT 
    'Perfis Inativos' as problema,
    COUNT(*) as quantidade
FROM public.profiles 
WHERE is_active = false;

-- Verificar se o problema é na consulta de saldo
-- (O componente pode estar consultando uma tabela/campo errado)
SELECT 
    p.id,
    p.nome,
    p.twitch_username,
    p.nome_personagem,
    p.rubini_coins,
    p.streamelements_points,
    COALESCE(p.rubini_coins, 0) as saldo_rubini,
    CASE 
        WHEN COALESCE(p.rubini_coins, 0) >= 25 THEN 'PODE RESGATAR'
        ELSE 'SALDO INSUFICIENTE'
    END as status_resgate
FROM public.profiles p
WHERE p.is_active = true 
AND p.nome_personagem IS NOT NULL
ORDER BY p.rubini_coins DESC NULLS LAST
LIMIT 10;