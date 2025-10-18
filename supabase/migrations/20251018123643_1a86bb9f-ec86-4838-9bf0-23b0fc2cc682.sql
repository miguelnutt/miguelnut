-- Corrigir histórico de recompensas diárias para horário de Brasília
-- Remove registros duplicados e ajusta datas incorretas

-- Primeiro, vamos limpar registros do dia 16/10 que deveriam ser 17/10
-- (a funcionalidade começou em 17/10)
UPDATE public.daily_rewards_history
SET created_at = created_at + INTERVAL '1 day'
WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = '2025-10-16';

-- Atualizar user_daily_logins para refletir o horário correto de Brasília
UPDATE public.user_daily_logins
SET ultimo_login = DATE(ultimo_login::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')
WHERE ultimo_login < CURRENT_DATE;

-- Criar índice para melhorar performance de consultas por data
CREATE INDEX IF NOT EXISTS idx_daily_rewards_history_date 
ON public.daily_rewards_history (date(timezone('America/Sao_Paulo', created_at)));

CREATE INDEX IF NOT EXISTS idx_daily_rewards_history_user_date 
ON public.daily_rewards_history (user_id, date(timezone('America/Sao_Paulo', created_at)));