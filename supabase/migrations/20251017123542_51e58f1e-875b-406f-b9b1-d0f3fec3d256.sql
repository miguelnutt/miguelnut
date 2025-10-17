-- Adicionar campos para integração Twitch e nome de personagem
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS twitch_username TEXT,
ADD COLUMN IF NOT EXISTS nome_personagem TEXT;

-- Criar índice para busca rápida por twitch_username
CREATE INDEX IF NOT EXISTS idx_profiles_twitch_username ON public.profiles(twitch_username);

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.twitch_username IS 'Nome de usuário da Twitch do jogador';
COMMENT ON COLUMN public.profiles.nome_personagem IS 'Nome do personagem do jogador no jogo para recebimento de Rubini Coins';