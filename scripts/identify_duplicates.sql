-- =====================================================
-- SCRIPT: Identificação de Usuários Duplicados
-- =====================================================

-- 1. DUPLICATAS POR TWITCH_USER_ID (mais críticas)
-- Usuários ativos com mesmo twitch_user_id
SELECT 
  'DUPLICATA_TWITCH_ID' as tipo_duplicata,
  twitch_user_id,
  COUNT(*) as total_duplicatas,
  ARRAY_AGG(id ORDER BY created_at ASC) as profile_ids,
  ARRAY_AGG(nome ORDER BY created_at ASC) as nomes,
  ARRAY_AGG(twitch_username ORDER BY created_at ASC) as twitch_usernames,
  ARRAY_AGG(created_at ORDER BY created_at ASC) as created_dates
FROM profiles
WHERE twitch_user_id IS NOT NULL 
  AND twitch_user_id != ''
  AND is_active = true
GROUP BY twitch_user_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, twitch_user_id;

-- 2. DUPLICATAS POR NOME (usuários sem twitch_user_id)
-- Usuários ativos com mesmo nome mas sem twitch_user_id
SELECT 
  'DUPLICATA_NOME' as tipo_duplicata,
  LOWER(TRIM(nome)) as nome_normalizado,
  COUNT(*) as total_duplicatas,
  ARRAY_AGG(id ORDER BY created_at ASC) as profile_ids,
  ARRAY_AGG(nome ORDER BY created_at ASC) as nomes_originais,
  ARRAY_AGG(twitch_username ORDER BY created_at ASC) as twitch_usernames,
  ARRAY_AGG(created_at ORDER BY created_at ASC) as created_dates
FROM profiles
WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
  AND is_active = true
  AND nome IS NOT NULL
  AND TRIM(nome) != ''
GROUP BY LOWER(TRIM(nome))
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, LOWER(TRIM(nome));

-- 3. DUPLICATAS POR TWITCH_USERNAME (usuários sem twitch_user_id)
-- Usuários ativos com mesmo twitch_username mas sem twitch_user_id
SELECT 
  'DUPLICATA_TWITCH_USERNAME' as tipo_duplicata,
  LOWER(TRIM(twitch_username)) as twitch_username_normalizado,
  COUNT(*) as total_duplicatas,
  ARRAY_AGG(id ORDER BY created_at ASC) as profile_ids,
  ARRAY_AGG(nome ORDER BY created_at ASC) as nomes,
  ARRAY_AGG(twitch_username ORDER BY created_at ASC) as twitch_usernames_originais,
  ARRAY_AGG(created_at ORDER BY created_at ASC) as created_dates
FROM profiles
WHERE (twitch_user_id IS NULL OR twitch_user_id = '')
  AND is_active = true
  AND twitch_username IS NOT NULL
  AND TRIM(twitch_username) != ''
GROUP BY LOWER(TRIM(twitch_username))
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, LOWER(TRIM(twitch_username));

-- 4. ESTATÍSTICAS GERAIS
SELECT 
  'ESTATISTICAS_GERAIS' as categoria,
  COUNT(*) as total_profiles,
  COUNT(*) FILTER (WHERE is_active = true) as profiles_ativos,
  COUNT(*) FILTER (WHERE is_active = false) as profiles_inativos,
  COUNT(*) FILTER (WHERE twitch_user_id IS NOT NULL AND twitch_user_id != '') as com_twitch_id,
  COUNT(*) FILTER (WHERE twitch_user_id IS NULL OR twitch_user_id = '') as sem_twitch_id,
  COUNT(*) FILTER (WHERE merged_into IS NOT NULL) as ja_mesclados
FROM profiles;

-- 5. USUÁRIOS COM SALDOS (para verificar impacto da consolidação)
SELECT 
  'USUARIOS_COM_SALDOS' as categoria,
  p.id,
  p.nome,
  p.twitch_username,
  p.twitch_user_id,
  p.is_active,
  COALESCE(rcb.saldo, 0) as rubini_coins,
  COALESCE(t.tickets_atual, 0) as tickets,
  p.created_at
FROM profiles p
LEFT JOIN rubini_coins_balance rcb ON p.id = rcb.user_id
LEFT JOIN tickets t ON p.id = t.user_id
WHERE p.is_active = true
  AND (COALESCE(rcb.saldo, 0) > 0 OR COALESCE(t.tickets_atual, 0) > 0)
ORDER BY COALESCE(rcb.saldo, 0) + COALESCE(t.tickets_atual, 0) DESC;

-- 6. VERIFICAR INTEGRIDADE DOS ÍNDICES ÚNICOS
SELECT 
  'VERIFICACAO_INDICES' as categoria,
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
  AND (indexname LIKE '%unique%' OR indexname LIKE '%twitch_user_id%')
ORDER BY indexname;

-- 7. USUÁRIOS ÓRFÃOS (sem referências em outras tabelas)
SELECT 
  'USUARIOS_ORFAOS' as categoria,
  p.id,
  p.nome,
  p.twitch_username,
  p.twitch_user_id,
  p.is_active,
  p.created_at,
  CASE 
    WHEN rcb.user_id IS NULL AND t.user_id IS NULL AND tl.user_id IS NULL 
         AND s.user_id IS NULL AND cm.user_id IS NULL THEN true
    ELSE false
  END as is_orphan
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
  AND cm.user_id IS NULL
ORDER BY p.created_at DESC;