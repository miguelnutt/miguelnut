-- Adicionar colunas de auditoria em rubini_coins_history (backward-compatible)
ALTER TABLE rubini_coins_history 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmado' CHECK (status IN ('pendente', 'confirmado', 'falhou')),
ADD COLUMN IF NOT EXISTS origem TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS retries INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referencia_id UUID;

-- Index para buscar duplicatas por idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_rubini_coins_history_idempotency 
ON rubini_coins_history(idempotency_key) 
WHERE idempotency_key IS NOT NULL AND status = 'confirmado';

-- Index para buscas por status e origem
CREATE INDEX IF NOT EXISTS idx_rubini_coins_history_status ON rubini_coins_history(status);
CREATE INDEX IF NOT EXISTS idx_rubini_coins_history_origem ON rubini_coins_history(origem);
CREATE INDEX IF NOT EXISTS idx_rubini_coins_history_created ON rubini_coins_history(created_at DESC);

-- Atualizar registros antigos para terem status 'confirmado' e origem 'legacy'
UPDATE rubini_coins_history 
SET 
  status = 'confirmado',
  origem = CASE 
    WHEN motivo ILIKE '%roleta%' THEN 'roulette'
    WHEN motivo ILIKE '%tibiatermo%' THEN 'tibiatermo'
    WHEN motivo ILIKE '%manual%' THEN 'admin'
    ELSE 'legacy'
  END
WHERE status IS NULL OR origem IS NULL;