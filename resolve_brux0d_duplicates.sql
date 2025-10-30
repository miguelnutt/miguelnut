-- Script para resolver duplicatas do usuário Brux0D e problemas relacionados
-- EXECUTAR NO SUPABASE SQL EDITOR

-- 1. ANÁLISE INICIAL - Verificar duplicatas do Brux0D
SELECT 
    'ANÁLISE BRUX0D' as secao,
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

-- 2. VERIFICAR SALDOS DOS PERFIS DUPLICADOS
SELECT 
    'SALDOS BRUX0D' as secao,
    p.id,
    p.nome_personagem,
    p.created_at,
    COALESCE(rcb.saldo, 0) as rubini_coins_saldo,
    COALESCE(t.tickets_atual, 0) as tickets_saldo
FROM public.profiles p
LEFT JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
LEFT JOIN public.tickets t ON p.id = t.user_id
WHERE LOWER(p.twitch_username) = 'brux0d'
ORDER BY p.created_at;

-- 3. VERIFICAR HISTÓRICO DE RESGATES
SELECT 
    'RESGATES BRUX0D' as secao,
    rcr.id,
    rcr.user_id,
    p.nome_personagem,
    rcr.quantidade,
    rcr.status,
    rcr.created_at
FROM public.rubini_coins_resgates rcr
JOIN public.profiles p ON rcr.user_id = p.id
WHERE LOWER(p.twitch_username) = 'brux0d'
ORDER BY rcr.created_at;

-- 4. CONSOLIDAÇÃO AUTOMÁTICA DO BRUX0D
-- Identificar perfil principal (mais antigo com dados mais completos)
WITH brux0d_analysis AS (
    SELECT 
        p.id,
        p.nome,
        p.twitch_username,
        p.twitch_user_id,
        p.nome_personagem,
        p.is_active,
        p.created_at,
        COALESCE(rcb.saldo, 0) as rubini_coins_saldo,
        COALESCE(t.tickets_atual, 0) as tickets_saldo,
        -- Critério de prioridade: tem twitch_user_id, mais antigo, ativo
        ROW_NUMBER() OVER (
            ORDER BY 
                CASE WHEN p.twitch_user_id IS NOT NULL THEN 0 ELSE 1 END,
                CASE WHEN p.is_active THEN 0 ELSE 1 END,
                p.created_at ASC
        ) as priority_rank
    FROM public.profiles p
    LEFT JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
    LEFT JOIN public.tickets t ON p.id = t.user_id
    WHERE LOWER(p.twitch_username) = 'brux0d'
)
SELECT 
    'PLANO CONSOLIDAÇÃO' as secao,
    CASE WHEN priority_rank = 1 THEN 'PERFIL PRINCIPAL' ELSE 'DUPLICATA - SERÁ CONSOLIDADO' END as tipo,
    id,
    nome_personagem,
    twitch_user_id,
    rubini_coins_saldo,
    tickets_saldo,
    created_at
FROM brux0d_analysis
ORDER BY priority_rank;

-- 5. EXECUTAR CONSOLIDAÇÃO (DESCOMENTE APÓS VERIFICAR OS RESULTADOS ACIMA)
/*
DO $$
DECLARE
    v_canonical_id UUID;
    v_duplicate_id UUID;
    v_total_rc INTEGER := 0;
    v_total_tickets INTEGER := 0;
    rec RECORD;
BEGIN
    -- Identificar perfil principal
    SELECT id INTO v_canonical_id
    FROM public.profiles 
    WHERE LOWER(twitch_username) = 'brux0d'
    ORDER BY 
        CASE WHEN twitch_user_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN is_active THEN 0 ELSE 1 END,
        created_at ASC
    LIMIT 1;
    
    RAISE NOTICE 'Perfil principal identificado: %', v_canonical_id;
    
    -- Processar cada duplicata
    FOR rec IN 
        SELECT 
            p.id,
            p.nome_personagem,
            COALESCE(rcb.saldo, 0) as rc_saldo,
            COALESCE(t.tickets_atual, 0) as tickets_saldo
        FROM public.profiles p
        LEFT JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
        LEFT JOIN public.tickets t ON p.id = t.user_id
        WHERE LOWER(p.twitch_username) = 'brux0d'
        AND p.id != v_canonical_id
    LOOP
        v_duplicate_id := rec.id;
        
        RAISE NOTICE 'Processando duplicata: % (RC: %, Tickets: %)', 
            v_duplicate_id, rec.rc_saldo, rec.tickets_saldo;
        
        -- Somar saldos
        v_total_rc := v_total_rc + rec.rc_saldo;
        v_total_tickets := v_total_tickets + rec.tickets_saldo;
        
        -- Migrar históricos para o perfil principal
        UPDATE public.rubini_coins_history 
        SET user_id = v_canonical_id 
        WHERE user_id = v_duplicate_id;
        
        UPDATE public.ticket_ledger 
        SET user_id = v_canonical_id 
        WHERE user_id = v_duplicate_id;
        
        UPDATE public.rubini_coins_resgates 
        SET user_id = v_canonical_id 
        WHERE user_id = v_duplicate_id;
        
        UPDATE public.daily_rewards_history 
        SET user_id = v_canonical_id 
        WHERE user_id = v_duplicate_id;
        
        UPDATE public.spins 
        SET user_id = v_canonical_id 
        WHERE user_id = v_duplicate_id;
        
        UPDATE public.chat_messages 
        SET user_id = v_canonical_id 
        WHERE user_id = v_duplicate_id;
        
        -- Remover saldos da duplicata
        DELETE FROM public.rubini_coins_balance WHERE user_id = v_duplicate_id;
        DELETE FROM public.tickets WHERE user_id = v_duplicate_id;
        
        -- Marcar perfil como inativo e consolidado
        UPDATE public.profiles 
        SET 
            is_active = false,
            merged_into = v_canonical_id,
            updated_at = NOW()
        WHERE id = v_duplicate_id;
        
        RAISE NOTICE 'Duplicata % processada e desativada', v_duplicate_id;
    END LOOP;
    
    -- Atualizar saldos consolidados no perfil principal
    IF v_total_rc > 0 THEN
        INSERT INTO public.rubini_coins_balance (user_id, saldo)
        VALUES (v_canonical_id, v_total_rc)
        ON CONFLICT (user_id) 
        DO UPDATE SET saldo = rubini_coins_balance.saldo + EXCLUDED.saldo;
        
        RAISE NOTICE 'Rubini Coins consolidados: % adicionados ao perfil principal', v_total_rc;
    END IF;
    
    IF v_total_tickets > 0 THEN
        INSERT INTO public.tickets (user_id, tickets_atual)
        VALUES (v_canonical_id, v_total_tickets)
        ON CONFLICT (user_id) 
        DO UPDATE SET tickets_atual = tickets.tickets_atual + EXCLUDED.tickets_atual;
        
        RAISE NOTICE 'Tickets consolidados: % adicionados ao perfil principal', v_total_tickets;
    END IF;
    
    -- Garantir que o perfil principal tenha twitch_user_id
    UPDATE public.profiles 
    SET twitch_user_id = '123456789' -- Substitua pelo ID correto do Twitch do Brux0D
    WHERE id = v_canonical_id 
    AND twitch_user_id IS NULL;
    
    RAISE NOTICE '✅ Consolidação do Brux0D concluída com sucesso!';
    RAISE NOTICE 'Perfil principal: %', v_canonical_id;
    RAISE NOTICE 'Total RC consolidado: %', v_total_rc;
    RAISE NOTICE 'Total Tickets consolidado: %', v_total_tickets;
    
END $$;
*/

-- 6. VERIFICAÇÃO PÓS-CONSOLIDAÇÃO
-- Execute após a consolidação para verificar se tudo está correto
SELECT 
    'PÓS-CONSOLIDAÇÃO' as secao,
    COUNT(*) as perfis_ativos,
    COUNT(CASE WHEN merged_into IS NOT NULL THEN 1 END) as perfis_consolidados
FROM public.profiles 
WHERE LOWER(twitch_username) = 'brux0d';

-- Verificar saldo final
SELECT 
    'SALDO FINAL BRUX0D' as secao,
    p.id,
    p.nome_personagem,
    p.is_active,
    COALESCE(rcb.saldo, 0) as rubini_coins_final,
    COALESCE(t.tickets_atual, 0) as tickets_final
FROM public.profiles p
LEFT JOIN public.rubini_coins_balance rcb ON p.id = rcb.user_id
LEFT JOIN public.tickets t ON p.id = t.user_id
WHERE LOWER(p.twitch_username) = 'brux0d'
AND p.is_active = true;