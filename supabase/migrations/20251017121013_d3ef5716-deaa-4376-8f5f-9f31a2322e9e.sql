-- Adicionar campos de prêmio na tabela raffles
ALTER TABLE public.raffles 
ADD COLUMN tipo_premio text DEFAULT 'Rubini Coins',
ADD COLUMN valor_premio integer DEFAULT 25;

-- Atualizar os 4 sorteios existentes para cada um valer 25 rubini coins
UPDATE public.raffles
SET tipo_premio = 'Rubini Coins', valor_premio = 25
WHERE tipo_premio IS NULL OR valor_premio IS NULL;