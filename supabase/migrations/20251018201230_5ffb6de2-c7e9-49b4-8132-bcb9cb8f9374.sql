-- Criar tabela para configuração de recompensas por tentativa do TibiaTermo
CREATE TABLE IF NOT EXISTS public.tibiatermo_rewards_by_attempt (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tentativa integer NOT NULL UNIQUE CHECK (tentativa >= 1 AND tentativa <= 6),
  pontos_loja integer NOT NULL DEFAULT 0 CHECK (pontos_loja >= 0),
  tickets integer NOT NULL DEFAULT 0 CHECK (tickets >= 0),
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.tibiatermo_rewards_by_attempt ENABLE ROW LEVEL SECURITY;

-- Políticas: todos podem ler, apenas admins podem modificar
CREATE POLICY "Todos podem ver configurações de recompensas"
  ON public.tibiatermo_rewards_by_attempt
  FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar configurações de recompensas"
  ON public.tibiatermo_rewards_by_attempt
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserir valores padrão para as 6 tentativas
INSERT INTO public.tibiatermo_rewards_by_attempt (tentativa, pontos_loja, tickets, ativa)
VALUES 
  (1, 50, 2, true),
  (2, 40, 1, true),
  (3, 30, 1, true),
  (4, 25, 0, true),
  (5, 20, 0, true),
  (6, 15, 0, true)
ON CONFLICT (tentativa) DO NOTHING;

-- Criar tabela para configurações gerais do TibiaTermo
CREATE TABLE IF NOT EXISTS public.tibiatermo_general_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exigir_login boolean NOT NULL DEFAULT true,
  bloquear_nova_partida boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.tibiatermo_general_config ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Todos podem ver configurações gerais"
  ON public.tibiatermo_general_config
  FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar configurações gerais"
  ON public.tibiatermo_general_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserir configuração padrão
INSERT INTO public.tibiatermo_general_config (exigir_login, bloquear_nova_partida)
VALUES (true, true)
ON CONFLICT DO NOTHING;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_tibiatermo_rewards_by_attempt_updated_at
  BEFORE UPDATE ON public.tibiatermo_rewards_by_attempt
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tibiatermo_general_config_updated_at
  BEFORE UPDATE ON public.tibiatermo_general_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();