-- Adicionar campo 'pago' nas tabelas spins e raffles
-- Para verificação de pagamento de Rubini Coins apenas

-- Adicionar coluna 'pago' na tabela spins (default false = não pago)
ALTER TABLE public.spins 
ADD COLUMN pago BOOLEAN NOT NULL DEFAULT false;

-- Adicionar coluna 'pago' na tabela raffles (default false = não pago)
ALTER TABLE public.raffles 
ADD COLUMN pago BOOLEAN NOT NULL DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN public.spins.pago IS 'Indica se o prêmio de Rubini Coins foi pago (apenas para tipo_recompensa = Rubini Coins)';
COMMENT ON COLUMN public.raffles.pago IS 'Indica se o prêmio de Rubini Coins foi pago (apenas para tipo_premio = Rubini Coins)';