-- =====================================================
-- SCRIPT: Verificação Pós-Consolidação de Usuários
-- =====================================================

-- 1. VERIFICAR SE AINDA EXISTEM DUPLICATAS
SELECT 
  'VERIFICACAO_DUPLICATAS_TWITCH_ID' as categoria,
  COUNT(*) as total_grupos_duplicados,
  SUM(total_duplicatas - 1) as total_perfis_duplicados
FROM (
  SELECT 
    twitch_user_id,
    COUNT(*) as total_duplicatas
  FROM profiles
  WHERE twitch_user_id IS NOT NULL 
    AND twitch_user_id != ''
    AND is_active = true
  GROUP BY twitch_user_id
  HAVING COUNT(*) > 1
) duplicatas_twitch;

SELECT 
  'VERIFICACAO_DUPLICATAS_NOME' as categoria,
  COUNT(*) as total_grupos_duplicados,
  SUM(total_duplicatas - 1) as total_perfis_duplicados
FROM (
  SELECT 
    LOWER(TRIM(nome)) as nome_normalizado,
    COUNT(*) as total_duplicatas
  FROM profiles
  WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
    AND is_active = true
    AND nome IS NOT NULL
    AND TRIM(nome) != ''
  GROUP BY LOWER(TRIM(nome))
  HAVING COUNT(*) > 1
) duplicatas_nome;

-- 2. ESTATÍSTICAS GERAIS APÓS CONSOLIDAÇÃO
SELECT 
  'ESTATISTICAS_POS_CONSOLIDACAO' as categoria,
  COUNT(*) as total_profiles,
  COUNT(*) FILTER (WHERE is_active = true) as profiles_ativos,
  COUNT(*) FILTER (WHERE is_active = false) as profiles_inativos,
  COUNT(*) FILTER (WHERE merged_into IS NOT NULL) as profiles_mesclados,
  COUNT(*) FILTER (WHERE twitch_user_id IS NOT NULL AND twitch_user_id != '') as com_twitch_id,
  COUNT(*) FILTER (WHERE twitch_user_id IS NULL OR twitch_user_id = '') as sem_twitch_id
FROM profiles;

-- 3. VERIFICAR AUDITORIA DE CONSOLIDAÇÃO
SELECT 
  'AUDITORIA_CONSOLIDACAO' as categoria,
  COUNT(*) as total_consolidacoes,
  SUM(rubini_coins_before_duplicate) as total_rc_consolidados,
  SUM(tickets_before_duplicate) as total_tickets_consolidados,
  COUNT(DISTINCT canonical_profile_id) as perfis_canonicos_envolvidos,
  MIN(merged_at) as primeira_consolidacao,
  MAX(merged_at) as ultima_consolidacao
FROM profile_merge_audit
WHERE merged_at >= CURRENT_DATE;

-- 4. VERIFICAR INTEGRIDADE DOS SALDOS
SELECT 
  'INTEGRIDADE_SALDOS' as categoria,
  COUNT(*) as usuarios_com_saldos,
  SUM(COALESCE(rcb.saldo, 0)) as total_rubini_coins,
  SUM(COALESCE(t.tickets_atual, 0)) as total_tickets,
  COUNT(*) FILTER (WHERE rcb.saldo > 0) as usuarios_com_rc,
  COUNT(*) FILTER (WHERE t.tickets_atual > 0) as usuarios_com_tickets
FROM profiles p
LEFT JOIN rubini_coins_balance rcb ON p.id = rcb.user_id
LEFT JOIN tickets t ON p.id = t.user_id
WHERE p.is_active = true;

-- 5. VERIFICAR USUÁRIOS ÓRFÃOS (sem dados relacionados)
SELECT 
  'USUARIOS_ORFAOS' as categoria,
  COUNT(*) as total_orfaos,
  ARRAY_AGG(p.id) as ids_orfaos
FROM profiles p
LEFT JOIN rubini_coins_balance rcb ON p.id = rcb.user_id
LEFT JOIN tickets t ON p.id = t.user_id
LEFT JOIN ticket_ledger tl ON p.id = tl.user_id
LEFT JOIN spins s ON p.id = s.user_id
LEFT JOIN chat_messages cm ON p.id = cm.user_id
WHERE p.is_active = true
  AND rcb.user_id IS NULL 
  AND t.user_id IS NULL 
  AND tl.user_id IS NULL 
  AND s.user_id IS NULL 
  AND cm.user_id IS NULL;

-- 6. VERIFICAR CONSTRAINTS E ÍNDICES
SELECT 
  'VERIFICACAO_INDICES' as categoria,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
  AND (indexname LIKE '%unique%' OR indexname LIKE '%twitch_user_id%' OR indexname LIKE '%active%')
ORDER BY indexname;

-- 7. TESTAR CRIAÇÃO DE USUÁRIO (deve funcionar sem duplicatas)
DO $$
DECLARE
  v_test_user_id UUID;
  v_test_twitch_id TEXT := 'test_user_' || extract(epoch from now())::text;
BEGIN
  -- Tentar criar usuário de teste
  SELECT get_or_merge_profile_v2(
    v_test_twitch_id,
    'Usuario Teste',
    'usuario_teste',
    'Personagem Teste'
  ) INTO v_test_user_id;
  
  -- Verificar se foi criado
  IF v_test_user_id IS NOT NULL THEN
    RAISE NOTICE 'TESTE PASSOU: Usuário de teste criado com sucesso: %', v_test_user_id;
    
    -- Tentar criar o mesmo usuário novamente (deve retornar o mesmo ID)
    DECLARE
      v_test_user_id_2 UUID;
    BEGIN
      SELECT get_or_merge_profile_v2(
        v_test_twitch_id,
        'Usuario Teste Atualizado',
        'usuario_teste_novo',
        'Personagem Teste Novo'
      ) INTO v_test_user_id_2;
      
      IF v_test_user_id = v_test_user_id_2 THEN
        RAISE NOTICE 'TESTE PASSOU: Mesmo usuário retornado na segunda chamada: %', v_test_user_id_2;
      ELSE
        RAISE WARNING 'TESTE FALHOU: IDs diferentes retornados: % vs %', v_test_user_id, v_test_user_id_2;
      END IF;
    END;
    
    -- Limpar usuário de teste
    UPDATE profiles SET is_active = false WHERE id = v_test_user_id;
    DELETE FROM rubini_coins_balance WHERE user_id = v_test_user_id;
    DELETE FROM tickets WHERE user_id = v_test_user_id;
    
    RAISE NOTICE 'Usuário de teste removido';
  ELSE
    RAISE WARNING 'TESTE FALHOU: Não foi possível criar usuário de teste';
  END IF;
END $$;

-- 8. RELATÓRIO FINAL
SELECT 
  'RELATORIO_FINAL' as categoria,
  jsonb_build_object(
    'data_verificacao', now(),
    'total_profiles_ativos', (SELECT COUNT(*) FROM profiles WHERE is_active = true),
    'total_profiles_inativos', (SELECT COUNT(*) FROM profiles WHERE is_active = false),
    'duplicatas_twitch_id', (
      SELECT COUNT(*) FROM (
        SELECT twitch_user_id
        FROM profiles
        WHERE twitch_user_id IS NOT NULL AND twitch_user_id != '' AND is_active = true
        GROUP BY twitch_user_id
        HAVING COUNT(*) > 1
      ) t
    ),
    'duplicatas_nome', (
      SELECT COUNT(*) FROM (
        SELECT LOWER(TRIM(nome))
        FROM profiles
        WHERE (twitch_user_id IS NULL OR twitch_user_id = '') AND is_active = true AND nome IS NOT NULL
        GROUP BY LOWER(TRIM(nome))
        HAVING COUNT(*) > 1
      ) t
    ),
    'consolidacoes_hoje', (SELECT COUNT(*) FROM profile_merge_audit WHERE merged_at >= CURRENT_DATE),
    'sistema_limpo', (
      SELECT CASE 
        WHEN NOT EXISTS (
          SELECT 1 FROM profiles 
          WHERE twitch_user_id IS NOT NULL AND twitch_user_id != '' AND is_active = true
          GROUP BY twitch_user_id HAVING COUNT(*) > 1
        ) AND NOT EXISTS (
          SELECT 1 FROM profiles 
          WHERE (twitch_user_id IS NULL OR twitch_user_id = '') AND is_active = true AND nome IS NOT NULL
          GROUP BY LOWER(TRIM(nome)) HAVING COUNT(*) > 1
        ) THEN true
        ELSE false
      END
    )
  ) as relatorio_detalhado;