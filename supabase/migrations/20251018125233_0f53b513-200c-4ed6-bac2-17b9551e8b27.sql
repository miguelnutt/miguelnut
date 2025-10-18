-- Criar tabela para recompensas especiais configuradas pelo admin
CREATE TABLE IF NOT EXISTS public.daily_reward_special_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_sequencia INTEGER NOT NULL UNIQUE,
  pontos INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_reward_special_config ENABLE ROW LEVEL SECURITY;

-- Policies para recompensas especiais
CREATE POLICY "Todos podem ver recompensas especiais"
ON public.daily_reward_special_config
FOR SELECT
USING (true);

CREATE POLICY "Apenas admins podem gerenciar recompensas especiais"
ON public.daily_reward_special_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_daily_reward_special_config_updated_at
BEFORE UPDATE ON public.daily_reward_special_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar dados existentes: usuários que já resgataram terão sequência = 1
-- Atualizar user_daily_logins para dar sequência inicial de 1 para quem já tem histórico
UPDATE public.user_daily_logins
SET dia_atual = 1
WHERE user_id IN (
  SELECT DISTINCT user_id 
  FROM public.daily_rewards_history
)
AND dia_atual > 1;

-- Criar índice para performance no ranking de sequências
CREATE INDEX IF NOT EXISTS idx_user_daily_logins_streak 
ON public.user_daily_logins(dia_atual DESC, ultimo_login DESC);