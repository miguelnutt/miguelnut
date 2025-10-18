-- Criar tabela de configurações padrão da sequência
CREATE TABLE IF NOT EXISTS public.daily_reward_default_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pontos_dia_comum INTEGER NOT NULL DEFAULT 25,
  pontos_multiplo_cinco INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir configuração padrão inicial
INSERT INTO public.daily_reward_default_config (pontos_dia_comum, pontos_multiplo_cinco)
VALUES (25, 50)
ON CONFLICT DO NOTHING;

-- RLS para configurações padrão
ALTER TABLE public.daily_reward_default_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver configurações padrão"
ON public.daily_reward_default_config
FOR SELECT
USING (true);

CREATE POLICY "Apenas admins podem gerenciar configurações padrão"
ON public.daily_reward_default_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Criar tabela de configurações de exibição do ranking
CREATE TABLE IF NOT EXISTS public.streak_ranking_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exibir_publicamente BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir configuração padrão inicial
INSERT INTO public.streak_ranking_config (exibir_publicamente)
VALUES (true)
ON CONFLICT DO NOTHING;

-- RLS para configurações de ranking
ALTER TABLE public.streak_ranking_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver configurações de ranking"
ON public.streak_ranking_config
FOR SELECT
USING (true);

CREATE POLICY "Apenas admins podem gerenciar configurações de ranking"
ON public.streak_ranking_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Criar tabela de auditoria de ações de manutenção
CREATE TABLE IF NOT EXISTS public.admin_maintenance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acao TEXT NOT NULL,
  executado_por UUID REFERENCES auth.users(id),
  executado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para log de manutenção
ALTER TABLE public.admin_maintenance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins podem ver log de manutenção"
ON public.admin_maintenance_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem inserir log de manutenção"
ON public.admin_maintenance_log
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_daily_reward_default_config_updated_at
BEFORE UPDATE ON public.daily_reward_default_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_streak_ranking_config_updated_at
BEFORE UPDATE ON public.streak_ranking_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();