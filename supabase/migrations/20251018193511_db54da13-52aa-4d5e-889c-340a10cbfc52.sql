-- Renomear tabelas de TibiaDle para TibiaTermo
ALTER TABLE public.tibiadle_words RENAME TO tibiatermo_words;
ALTER TABLE public.tibiadle_user_games RENAME TO tibiatermo_user_games;

-- Renomear índices
ALTER INDEX idx_tibiadle_words_ativa RENAME TO idx_tibiatermo_words_ativa;
ALTER INDEX idx_tibiadle_user_games_user_date RENAME TO idx_tibiatermo_user_games_user_date;

-- Renomear triggers
DROP TRIGGER IF EXISTS update_tibiadle_words_updated_at ON public.tibiatermo_words;
DROP TRIGGER IF EXISTS update_tibiadle_user_games_updated_at ON public.tibiatermo_user_games;

CREATE TRIGGER update_tibiatermo_words_updated_at
  BEFORE UPDATE ON public.tibiatermo_words
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tibiatermo_user_games_updated_at
  BEFORE UPDATE ON public.tibiatermo_user_games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela de configuração de recompensas
CREATE TABLE public.tibiatermo_rewards_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pontos_acerto INTEGER NOT NULL DEFAULT 25,
  tickets_bonus INTEGER NOT NULL DEFAULT 1,
  max_tentativas_bonus INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tibiatermo_rewards_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Todos podem ver configurações de recompensas"
  ON public.tibiatermo_rewards_config FOR SELECT
  USING (true);

CREATE POLICY "Admins podem gerenciar configurações de recompensas"
  ON public.tibiatermo_rewards_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserir configuração padrão
INSERT INTO public.tibiatermo_rewards_config (pontos_acerto, tickets_bonus, max_tentativas_bonus)
VALUES (25, 1, 4);