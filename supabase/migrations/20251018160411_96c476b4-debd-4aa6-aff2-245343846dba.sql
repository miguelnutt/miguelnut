-- Reverter padronização de "RubiniCoin" para "Rubini Coins"
UPDATE spins 
SET tipo_recompensa = 'Rubini Coins' 
WHERE tipo_recompensa = 'RubiniCoin';

UPDATE raffles 
SET tipo_premio = 'Rubini Coins' 
WHERE tipo_premio = 'RubiniCoin';