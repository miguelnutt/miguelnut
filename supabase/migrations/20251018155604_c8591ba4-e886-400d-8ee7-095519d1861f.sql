-- Padronizar todos os registros antigos de "RC" e "Rubini Coins" para "RubiniCoin"
UPDATE spins 
SET tipo_recompensa = 'RubiniCoin' 
WHERE tipo_recompensa IN ('RC', 'Rubini Coins');

UPDATE raffles 
SET tipo_premio = 'RubiniCoin' 
WHERE tipo_premio = 'Rubini Coins';

-- Adicionar índices para melhorar performance das queries de streak
CREATE INDEX IF NOT EXISTS idx_user_daily_logins_user_id ON user_daily_logins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_logins_ultimo_login ON user_daily_logins(ultimo_login);
CREATE INDEX IF NOT EXISTS idx_daily_rewards_history_user_id_created ON daily_rewards_history(user_id, created_at DESC);