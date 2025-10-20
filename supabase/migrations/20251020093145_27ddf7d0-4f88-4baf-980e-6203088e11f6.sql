-- Adicionar campos de configuração para restauração de streak
ALTER TABLE daily_reward_default_config 
ADD COLUMN IF NOT EXISTS custo_restauracao_por_dia integer DEFAULT 200 NOT NULL,
ADD COLUMN IF NOT EXISTS permitir_restauracao boolean DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS rubini_coins_por_dia integer DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS tickets_por_dia integer DEFAULT 0 NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN daily_reward_default_config.custo_restauracao_por_dia IS 'Custo em pontos de loja por dia perdido para restaurar streak';
COMMENT ON COLUMN daily_reward_default_config.permitir_restauracao IS 'Se false, não permite restaurar streak perdida';
COMMENT ON COLUMN daily_reward_default_config.rubini_coins_por_dia IS 'Rubini Coins adicionais por dia de streak';
COMMENT ON COLUMN daily_reward_default_config.tickets_por_dia IS 'Tickets adicionais por dia de streak';