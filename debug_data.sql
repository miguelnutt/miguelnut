-- Script para verificar dados nas tabelas

-- 1. Verificar dados na tabela spins
SELECT 'SPINS_TOTAL' as tabela, COUNT(*) as total FROM spins;

-- 2. Verificar dados na tabela tibiatermo_history
SELECT 'TIBIATERMO_HISTORY_TOTAL' as tabela, COUNT(*) as total FROM tibiatermo_history;

-- 3. Verificar dados na tabela tickets
SELECT 'TICKETS_TOTAL' as tabela, COUNT(*) as total FROM tickets;

-- 4. Verificar dados na tabela ticket_ledger
SELECT 'TICKET_LEDGER_TOTAL' as tabela, COUNT(*) as total FROM ticket_ledger;

-- 5. Verificar últimos registros de spins
SELECT 'ULTIMOS_SPINS' as tipo, id, nome_usuario, tipo_recompensa, valor, created_at 
FROM spins 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Verificar últimos registros de tibiatermo_history
SELECT 'ULTIMOS_TIBIATERMO' as tipo, id, nome_usuario, tipo_recompensa, valor, created_at 
FROM tibiatermo_history 
ORDER BY created_at DESC 
LIMIT 5;

-- 7. Verificar tickets de hoje especificamente
SELECT 'TICKETS_HOJE_SPINS' as tipo, nome_usuario, valor, created_at
FROM spins 
WHERE tipo_recompensa = 'Tickets' 
  AND DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;

-- 8. Verificar tickets de hoje no tibiatermo
SELECT 'TICKETS_HOJE_TIBIATERMO' as tipo, nome_usuario, valor, created_at
FROM tibiatermo_history 
WHERE tipo_recompensa = 'Tickets' 
  AND DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;

-- 9. Verificar se o usuário tibiaemprego existe e tem dados
SELECT 'USUARIO_TIBIAEMPREGO_SPINS' as tipo, COUNT(*) as total, SUM(CAST(valor AS INTEGER)) as total_tickets
FROM spins 
WHERE nome_usuario = 'tibiaemprego' 
  AND tipo_recompensa = 'Tickets';

-- 10. Verificar se o usuário tibiaemprego tem dados no tibiatermo
SELECT 'USUARIO_TIBIAEMPREGO_TIBIATERMO' as tipo, COUNT(*) as total, SUM(valor) as total_tickets
FROM tibiatermo_history 
WHERE nome_usuario = 'tibiaemprego' 
  AND tipo_recompensa = 'Tickets';

-- 11. Verificar perfis relacionados ao usuário tibiaemprego
SELECT 'PERFIL_TIBIAEMPREGO' as tipo, id, nome, twitch_username
FROM profiles 
WHERE twitch_username = 'tibiaemprego' OR nome = 'tibiaemprego';

-- 12. Verificar se há problemas de join entre spins e profiles
SELECT 'SPINS_SEM_PROFILE' as tipo, COUNT(*) as total
FROM spins s
LEFT JOIN profiles p ON s.user_id = p.id
WHERE s.user_id IS NOT NULL AND p.id IS NULL;

-- 13. Verificar se há problemas de join entre tibiatermo_history e profiles
SELECT 'TIBIATERMO_SEM_PROFILE' as tipo, COUNT(*) as total
FROM tibiatermo_history t
LEFT JOIN profiles p ON t.user_id = p.id
WHERE t.user_id IS NOT NULL AND p.id IS NULL;