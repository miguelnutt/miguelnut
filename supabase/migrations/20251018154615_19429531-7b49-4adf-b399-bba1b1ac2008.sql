-- Limpar resgates duplicados do usuário miguelnutt (manter apenas o primeiro)
DELETE FROM daily_rewards_history 
WHERE user_id = 'bc392aa4-999e-48ee-bafb-de50112def66' 
AND created_at > '2025-10-18 12:20:04.699863+00';