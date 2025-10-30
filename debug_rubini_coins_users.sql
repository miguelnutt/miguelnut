-- ============================================
-- ANÁLISE DE PROBLEMAS NO SISTEMA RUBINI COINS
-- Investigar por que alguns usuários conseguem fazer resgates e outros não
-- ============================================

-- 1. ESTATÍSTICAS GERAIS
SELECT 
  'ESTATÍSTICAS GERAIS' as categoria,
  'Total de perfis' as metrica,
  COUNT(*) as valor
FROM profiles
UNION ALL
SELECT 
  'ESTATÍSTICAS GERAIS',
  'Perfis ativos',
  COUNT(*)
FROM profiles WHERE is_active = true
UNION ALL
SELECT 
  'ESTATÍSTICAS GERAIS',
  'Perfis com personagem',
  COUNT(*)
FROM profiles WHERE nome_personagem IS NOT NULL AND nome_personagem != ''
UNION ALL
SELECT 
  'ESTATÍSTICAS GERAIS',
  'Perfis com Rubini Coins',
  COUNT(*)
FROM profiles WHERE rubini_coins_balance > 0
UNION ALL
SELECT 
  'ESTATÍSTICAS GERAIS',
  'Perfis com saldo suficiente (>=25)',
  COUNT(*)
FROM profiles WHERE rubini_coins_balance >= 25;

-- 2. ANÁLISE DE USUÁRIOS PROBLEMÁTICOS
-- Usuários que têm saldo mas não conseguem fazer resgate
SELECT 
  'USUÁRIOS PROBLEMÁTICOS' as categoria,
  id,
  nome,
  twitch_username,
  twitch_user_id,
  nome_personagem,
  is_active,
  rubini_coins_balance,
  CASE 
    WHEN nome_personagem IS NULL OR nome_personagem = '' THEN 'SEM_PERSONAGEM'
    WHEN NOT is_active THEN 'INATIVO'
    WHEN rubini_coins_balance < 25 THEN 'SALDO_INSUFICIENTE'
    WHEN twitch_user_id IS NULL THEN 'SEM_TWITCH_ID'
    ELSE 'OK'
  END as problema_identificado
FROM profiles 
WHERE rubini_coins_balance >= 25
  AND (
    nome_personagem IS NULL 
    OR nome_personagem = '' 
    OR NOT is_active 
    OR twitch_user_id IS NULL
  )
ORDER BY rubini_coins_balance DESC
LIMIT 20;

-- 3. ANÁLISE DE USUÁRIOS FUNCIONAIS
-- Usuários que conseguem fazer resgate (para comparação)
SELECT 
  'USUÁRIOS FUNCIONAIS' as categoria,
  id,
  nome,
  twitch_username,
  twitch_user_id,
  nome_personagem,
  is_active,
  rubini_coins_balance,
  'FUNCIONAL' as status
FROM profiles 
WHERE rubini_coins_balance >= 25
  AND nome_personagem IS NOT NULL 
  AND nome_personagem != ''
  AND is_active = true
  AND twitch_user_id IS NOT NULL
ORDER BY rubini_coins_balance DESC
LIMIT 10;

-- 4. ANÁLISE DE RESGATES RECENTES
-- Verificar quem conseguiu fazer resgates recentemente
SELECT 
  'RESGATES RECENTES' as categoria,
  r.id as resgate_id,
  r.user_id,
  p.nome,
  p.twitch_username,
  p.nome_personagem,
  r.quantidade,
  r.status,
  r.created_at
FROM rubini_coins_resgates r
JOIN profiles p ON r.user_id = p.id
ORDER BY r.created_at DESC
LIMIT 20;

-- 5. VERIFICAR INCONSISTÊNCIAS NOS DADOS
-- Usuários com dados inconsistentes
SELECT 
  'INCONSISTÊNCIAS' as categoria,
  id,
  nome,
  twitch_username,
  twitch_user_id,
  nome_personagem,
  is_active,
  created_at,
  updated_at,
  CASE 
    WHEN nome IS NULL AND twitch_username IS NULL THEN 'SEM_IDENTIFICACAO'
    WHEN twitch_user_id IS NOT NULL AND twitch_username IS NULL THEN 'ID_SEM_USERNAME'
    WHEN twitch_user_id IS NULL AND twitch_username IS NOT NULL THEN 'USERNAME_SEM_ID'
    WHEN nome_personagem IS NOT NULL AND nome_personagem != '' AND NOT is_active THEN 'PERSONAGEM_PERFIL_INATIVO'
    ELSE 'OUTROS'
  END as tipo_inconsistencia
FROM profiles 
WHERE 
  (nome IS NULL AND twitch_username IS NULL)
  OR (twitch_user_id IS NOT NULL AND twitch_username IS NULL)
  OR (twitch_user_id IS NULL AND twitch_username IS NOT NULL)
  OR (nome_personagem IS NOT NULL AND nome_personagem != '' AND NOT is_active)
ORDER BY created_at DESC;

-- 6. ANÁLISE DE PERFIS DUPLICADOS RESTANTES
-- Verificar se ainda existem duplicatas que podem causar problemas
SELECT 
  'POSSÍVEIS DUPLICATAS' as categoria,
  twitch_user_id,
  COUNT(*) as quantidade,
  STRING_AGG(id::text, ', ') as profile_ids,
  STRING_AGG(nome, ', ') as nomes,
  STRING_AGG(twitch_username, ', ') as usernames
FROM profiles 
WHERE twitch_user_id IS NOT NULL
GROUP BY twitch_user_id
HAVING COUNT(*) > 1
ORDER BY quantidade DESC;

-- 7. VERIFICAR PERFIS SEM TWITCH_USER_ID MAS COM MESMO NOME
SELECT 
  'DUPLICATAS POR NOME' as categoria,
  COALESCE(nome, twitch_username) as identificador,
  COUNT(*) as quantidade,
  STRING_AGG(id::text, ', ') as profile_ids,
  STRING_AGG(CASE WHEN is_active THEN 'ATIVO' ELSE 'INATIVO' END, ', ') as status
FROM profiles 
WHERE twitch_user_id IS NULL
  AND (nome IS NOT NULL OR twitch_username IS NOT NULL)
GROUP BY COALESCE(nome, twitch_username)
HAVING COUNT(*) > 1
ORDER BY quantidade DESC;

-- 8. ANÁLISE TEMPORAL - QUANDO OS PROBLEMAS COMEÇARAM
SELECT 
  'ANÁLISE TEMPORAL' as categoria,
  DATE(created_at) as data_criacao,
  COUNT(*) as perfis_criados,
  COUNT(CASE WHEN nome_personagem IS NOT NULL AND nome_personagem != '' THEN 1 END) as com_personagem,
  COUNT(CASE WHEN is_active THEN 1 END) as ativos,
  COUNT(CASE WHEN twitch_user_id IS NOT NULL THEN 1 END) as com_twitch_id
FROM profiles 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY data_criacao DESC;

-- 9. VERIFICAR EDGE FUNCTIONS QUE PODEM ESTAR CAUSANDO PROBLEMAS
-- Buscar por perfis criados/atualizados recentemente sem dados completos
SELECT 
  'PERFIS INCOMPLETOS RECENTES' as categoria,
  id,
  nome,
  twitch_username,
  twitch_user_id,
  nome_personagem,
  is_active,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 as horas_desde_update
FROM profiles 
WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days'
  AND (
    nome_personagem IS NULL 
    OR nome_personagem = ''
    OR twitch_user_id IS NULL
    OR NOT is_active
  )
ORDER BY updated_at DESC
LIMIT 20;