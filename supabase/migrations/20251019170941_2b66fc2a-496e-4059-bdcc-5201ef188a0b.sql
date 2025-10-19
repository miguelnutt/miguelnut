-- Recriar VIEW com SECURITY INVOKER para evitar problemas de segurança
DROP VIEW IF EXISTS se_sync_logs_v;

CREATE OR REPLACE VIEW se_sync_logs_v 
WITH (security_invoker = true)
AS
SELECT 
  id,
  created_at,
  user_id,
  username,
  points_added,
  tipo_operacao,
  error_message,
  tentativas_verificacao,
  saldo_antes,
  saldo_depois,
  reprocessado_em,
  reprocessado_por,
  referencia_id,
  -- Normalizar status baseado nos campos booleanos
  CASE 
    WHEN success = true AND saldo_verificado = true THEN 'confirmed'
    WHEN success = true AND saldo_verificado = false THEN 'pending'
    WHEN success = false THEN 'failed'
    ELSE 'unknown'
  END AS status,
  success,
  saldo_verificado,
  requer_reprocessamento,
  verificado_em
FROM streamelements_sync_logs;