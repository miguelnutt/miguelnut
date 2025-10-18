-- Tabela de palavras do TibiaDle
CREATE TABLE public.tibiadle_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palavra TEXT NOT NULL UNIQUE,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de jogos do usuário (histórico e palavra atual do dia)
CREATE TABLE public.tibiadle_user_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  palavra_dia TEXT NOT NULL,
  data_jogo DATE NOT NULL,
  tentativas JSONB NOT NULL DEFAULT '[]'::jsonb,
  acertou BOOLEAN,
  num_tentativas INTEGER,
  premiacao_pontos INTEGER DEFAULT 0,
  premiacao_tickets INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, data_jogo)
);

-- Índices
CREATE INDEX idx_tibiadle_words_ativa ON public.tibiadle_words(ativa);
CREATE INDEX idx_tibiadle_user_games_user_date ON public.tibiadle_user_games(user_id, data_jogo);

-- Enable RLS
ALTER TABLE public.tibiadle_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tibiadle_user_games ENABLE ROW LEVEL SECURITY;

-- RLS Policies para tibiadle_words
CREATE POLICY "Palavras ativas são visíveis para todos"
  ON public.tibiadle_words FOR SELECT
  USING (ativa = true);

CREATE POLICY "Admins podem gerenciar palavras"
  ON public.tibiadle_words FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para tibiadle_user_games
CREATE POLICY "Usuários podem ver próprios jogos"
  ON public.tibiadle_user_games FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Usuários podem inserir próprios jogos"
  ON public.tibiadle_user_games FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar próprios jogos"
  ON public.tibiadle_user_games FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins podem ver todos os jogos"
  ON public.tibiadle_user_games FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_tibiadle_words_updated_at
  BEFORE UPDATE ON public.tibiadle_words
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tibiadle_user_games_updated_at
  BEFORE UPDATE ON public.tibiadle_user_games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir palavras iniciais
INSERT INTO public.tibiadle_words (palavra, ativa) VALUES
  ('DEMON', true),
  ('ROTWORM', true),
  ('WYVERN', true),
  ('HYDRA', true),
  ('GHOUL', true),
  ('BEHEMOTH', true),
  ('TARANTULA', true),
  ('EDRON', true),
  ('THAIS', true),
  ('CARLIN', true),
  ('YALAHAR', true),
  ('BANUTA', true),
  ('RASHID', true),
  ('EXURA', true),
  ('EXORI', true),
  ('DRUID', true),
  ('KNIGHT', true),
  ('PALADIN', true),
  ('SORCERER', true),
  ('GLOOTH', true),
  ('ORC', true),
  ('MINOTAUR', true),
  ('CYCLOPS', true),
  ('VAMPIRE', true),
  ('DRAGON', true),
  ('FURY', true),
  ('QUARA', true),
  ('MORGAROTH', true),
  ('FERUMBRAS', true),
  ('ORSHABAAL', true);