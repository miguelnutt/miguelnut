-- Adicionar campos para controle de reprocessamento na tabela de logs
ALTER TABLE streamelements_sync_logs 
ADD COLUMN IF NOT EXISTS tentativas_verificacao INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS requer_reprocessamento BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reprocessado_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reprocessado_por UUID;

-- Criar índice para facilitar busca de logs que precisam reprocessamento
CREATE INDEX IF NOT EXISTS idx_streamelements_logs_reprocessamento 
ON streamelements_sync_logs(requer_reprocessamento, created_at) 
WHERE requer_reprocessamento = true;

-- Adicionar comentários para documentação
COMMENT ON COLUMN streamelements_sync_logs.tentativas_verificacao IS 'Número de tentativas de verificação realizadas';
COMMENT ON COLUMN streamelements_sync_logs.requer_reprocessamento IS 'Indica se a operação precisa ser reprocessada manualmente';
COMMENT ON COLUMN streamelements_sync_logs.reprocessado_em IS 'Data/hora em que foi reprocessado';
COMMENT ON COLUMN streamelements_sync_logs.reprocessado_por IS 'ID do admin que reprocessou';