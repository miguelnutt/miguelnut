-- SCRIPT DE CORREÇÃO AUTOMÁTICA PARA TODOS OS PROBLEMAS DE USUÁRIOS
-- ===================================================================
-- ATENÇÃO: Execute este script por partes, verificando os resultados antes de prosseguir

-- PARTE 1: ANÁLISE PRÉVIA (SEMPRE EXECUTE PRIMEIRO)
-- =================================================

-- Verificar usuários com múltiplos perfis
CREATE TEMP TABLE duplicate_users AS
SELECT 
    twitch_username,
    COUNT(*) as profile_count,
    ARRAY_AGG(id ORDER BY 
        CASE WHEN twitch_user_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN nome_personagem IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC
    ) as profile_ids
FROM public.profiles 
WHERE twitch_username IS NOT NULL
GROUP BY twitch_username 
HAVING COUNT(*) > 1;

-- Mostrar usuários que serão consolidados
SELECT 
    twitch_username,
    profile_count,
    profile_ids[1] as perfil_principal_id,
    profile_ids[2:] as perfis_a_remover
FROM duplicate_users
ORDER BY profile_count DESC;

-- PARTE 2: CONSOLIDAÇÃO DE PERFIS DUPLICADOS
-- ==========================================
-- DESCOMENTE E EXECUTE APENAS APÓS VERIFICAR A ANÁLISE ACIMA

/*
-- Consolidar histórico de Rubini Coins para perfis principais
WITH consolidation_map AS (
    SELECT 
        twitch_username,
        profile_ids[1] as main_profile_id,
        UNNEST(profile_ids[2:]) as duplicate_profile_id
    FROM duplicate_users
)
UPDATE public.rubini_coins_history 
SET user_id = cm.main_profile_id
FROM consolidation_map cm
WHERE user_id = cm.duplicate_profile_id;

-- Consolidar histórico de resgates para perfis principais
WITH consolidation_map AS (
    SELECT 
        twitch_username,
        profile_ids[1] as main_profile_id,
        UNNEST(profile_ids[2:]) as duplicate_profile_id
    FROM duplicate_users
)
UPDATE public.rubini_coins_resgates 
SET user_id = cm.main_profile_id
FROM consolidation_map cm
WHERE user_id = cm.duplicate_profile_id;

-- Consolidar saldos de Rubini Coins
WITH consolidation_map AS (
    SELECT 
        twitch_username,
        profile_ids[1] as main_profile_id,
        UNNEST(profile_ids[2:]) as duplicate_profile_id
    FROM duplicate_users
),
consolidated_balances AS (
    SELECT 
        cm.main_profile_id,
        SUM(COALESCE(rcb.saldo, 0)) as total_saldo
    FROM consolidation_map cm
    LEFT JOIN public.rubini_coins_balance rcb ON rcb.user_id IN (cm.main_profile_id, cm.duplicate_profile_id)
    GROUP BY cm.main_profile_id
)
INSERT INTO public.rubini_coins_balance (user_id, saldo, updated_at)
SELECT 
    main_profile_id,
    total_saldo,
    NOW()
FROM consolidated_balances
WHERE total_saldo > 0
ON CONFLICT (user_id) 
DO UPDATE SET 
    saldo = EXCLUDED.saldo,
    updated_at = EXCLUDED.updated_at;

-- Remover saldos dos perfis duplicados
WITH consolidation_map AS (
    SELECT 
        twitch_username,
        profile_ids[1] as main_profile_id,
        UNNEST(profile_ids[2:]) as duplicate_profile_id
    FROM duplicate_users
)
DELETE FROM public.rubini_coins_balance 
WHERE user_id IN (SELECT duplicate_profile_id FROM consolidation_map);

-- Atualizar perfil principal com dados mais completos
WITH consolidation_map AS (
    SELECT 
        twitch_username,
        profile_ids[1] as main_profile_id,
        profile_ids[2:] as duplicate_profile_ids
    FROM duplicate_users
),
best_data AS (
    SELECT 
        cm.main_profile_id,
        COALESCE(
            (SELECT nome FROM public.profiles WHERE id = cm.main_profile_id AND nome IS NOT NULL),
            (SELECT nome FROM public.profiles WHERE id = ANY(cm.duplicate_profile_ids) AND nome IS NOT NULL LIMIT 1)
        ) as best_nome,
        COALESCE(
            (SELECT nome_personagem FROM public.profiles WHERE id = cm.main_profile_id AND nome_personagem IS NOT NULL),
            (SELECT nome_personagem FROM public.profiles WHERE id = ANY(cm.duplicate_profile_ids) AND nome_personagem IS NOT NULL LIMIT 1)
        ) as best_personagem,
        COALESCE(
            (SELECT twitch_user_id FROM public.profiles WHERE id = cm.main_profile_id AND twitch_user_id IS NOT NULL),
            (SELECT twitch_user_id FROM public.profiles WHERE id = ANY(cm.duplicate_profile_ids) AND twitch_user_id IS NOT NULL LIMIT 1)
        ) as best_twitch_id
    FROM consolidation_map cm
)
UPDATE public.profiles 
SET 
    nome = bd.best_nome,
    nome_personagem = bd.best_personagem,
    twitch_user_id = bd.best_twitch_id,
    updated_at = NOW()
FROM best_data bd
WHERE id = bd.main_profile_id;

-- Remover perfis duplicados
WITH consolidation_map AS (
    SELECT 
        twitch_username,
        profile_ids[1] as main_profile_id,
        UNNEST(profile_ids[2:]) as duplicate_profile_id
    FROM duplicate_users
)
DELETE FROM public.profiles 
WHERE id IN (SELECT duplicate_profile_id FROM consolidation_map);
*/

-- PARTE 3: CORRIGIR USUÁRIOS SEM TWITCH_USER_ID
-- =============================================
-- Esta parte requer a função Edge Function populate-twitch-user-ids

SELECT 
    '=== USUÁRIOS QUE PRECISAM DE TWITCH_USER_ID ===' as info;

SELECT 
    id,
    nome,
    twitch_username,
    nome_personagem,
    'EXECUTAR: SELECT * FROM edge.populate_twitch_user_ids();' as acao_recomendada
FROM public.profiles 
WHERE is_active = true 
AND twitch_username IS NOT NULL 
AND twitch_user_id IS NULL
ORDER BY created_at DESC;

-- PARTE 4: CRIAR REGISTROS DE SALDO PARA USUÁRIOS SEM BALANCE
-- ===========================================================

/*
-- Criar registros de saldo zerado para usuários ativos sem registro
INSERT INTO public.rubini_coins_balance (user_id, saldo, updated_at)
SELECT 
    p.id,
    0,
    NOW()
FROM public.profiles p
LEFT JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
WHERE p.is_active = true 
AND rcb.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
*/

-- PARTE 5: RECONCILIAR SALDOS BASEADO NO HISTÓRICO
-- ================================================

/*
-- Recalcular saldos baseado no histórico de transações
WITH calculated_balances AS (
    SELECT 
        user_id,
        SUM(
            CASE 
                WHEN tipo = 'ganho' THEN quantidade
                WHEN tipo = 'resgate' THEN -quantidade
                ELSE 0
            END
        ) as saldo_calculado
    FROM public.rubini_coins_history
    GROUP BY user_id
)
UPDATE public.rubini_coins_balance 
SET 
    saldo = cb.saldo_calculado,
    updated_at = NOW()
FROM calculated_balances cb
WHERE user_id = cb.user_id
AND saldo != cb.saldo_calculado;
*/

-- PARTE 6: VERIFICAÇÃO FINAL
-- ==========================

-- Verificar resultado da consolidação
SELECT 
    '=== VERIFICAÇÃO PÓS-CORREÇÃO ===' as secao;

-- Contar perfis duplicados restantes
SELECT 
    'PERFIS_DUPLICADOS_RESTANTES' as metrica,
    COUNT(*) as valor
FROM (
    SELECT twitch_username
    FROM public.profiles 
    WHERE twitch_username IS NOT NULL
    GROUP BY twitch_username 
    HAVING COUNT(*) > 1
) duplicates

UNION ALL

-- Contar usuários sem twitch_user_id
SELECT 
    'USUARIOS_SEM_TWITCH_ID' as metrica,
    COUNT(*) as valor
FROM public.profiles 
WHERE is_active = true 
AND twitch_username IS NOT NULL 
AND twitch_user_id IS NULL

UNION ALL

-- Contar usuários sem registro de saldo
SELECT 
    'USUARIOS_SEM_BALANCE' as metrica,
    COUNT(*) as valor
FROM public.profiles p
LEFT JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
WHERE p.is_active = true 
AND rcb.user_id IS NULL

UNION ALL

-- Contar usuários com saldo positivo
SELECT 
    'USUARIOS_COM_SALDO_POSITIVO' as metrica,
    COUNT(*) as valor
FROM public.profiles p
INNER JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
WHERE p.is_active = true 
AND rcb.saldo > 0;

-- Mostrar usuários que ainda podem ter problemas
SELECT 
    '=== USUÁRIOS QUE AINDA PODEM TER PROBLEMAS ===' as info;

SELECT 
    p.id,
    p.nome,
    p.twitch_username,
    p.nome_personagem,
    p.twitch_user_id,
    COALESCE(rcb.saldo, 0) as saldo,
    CASE 
        WHEN p.twitch_user_id IS NULL THEN 'SEM_TWITCH_ID'
        WHEN p.nome_personagem IS NULL THEN 'SEM_PERSONAGEM'
        WHEN rcb.user_id IS NULL THEN 'SEM_REGISTRO_SALDO'
        ELSE 'OK'
    END as status
FROM public.profiles p
LEFT JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
WHERE p.is_active = true
AND (
    p.twitch_user_id IS NULL 
    OR p.nome_personagem IS NULL 
    OR rcb.user_id IS NULL
)
ORDER BY p.created_at DESC;