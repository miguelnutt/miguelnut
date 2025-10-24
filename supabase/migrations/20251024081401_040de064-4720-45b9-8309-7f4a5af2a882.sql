-- =====================================================
-- MIGRATION: Auditoria de Reconciliação de Saldos
-- =====================================================

-- Criar tabela de auditoria de reconciliação
CREATE TABLE IF NOT EXISTS balance_reconciliation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  performed_by UUID NOT NULL,
  
  -- Rubini Coins
  rubini_coins_before INTEGER NOT NULL DEFAULT 0,
  rubini_coins_calculated INTEGER NOT NULL DEFAULT 0,
  rubini_coins_divergence INTEGER NOT NULL DEFAULT 0,
  
  -- Tickets
  tickets_before INTEGER NOT NULL DEFAULT 0,
  tickets_calculated INTEGER NOT NULL DEFAULT 0,
  tickets_divergence INTEGER NOT NULL DEFAULT 0,
  
  -- Controle
  corrections_applied BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Habilitar RLS
ALTER TABLE balance_reconciliation_audit ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Apenas admins podem ver auditorias de reconciliação"
ON balance_reconciliation_audit
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir auditorias de reconciliação"
ON balance_reconciliation_audit
FOR INSERT
WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_balance_reconciliation_user_id 
ON balance_reconciliation_audit(user_id);

CREATE INDEX idx_balance_reconciliation_performed_by 
ON balance_reconciliation_audit(performed_by);

CREATE INDEX idx_balance_reconciliation_created_at 
ON balance_reconciliation_audit(created_at DESC);

CREATE INDEX idx_balance_reconciliation_corrections 
ON balance_reconciliation_audit(corrections_applied) 
WHERE corrections_applied = true;

-- Comentários de documentação
COMMENT ON TABLE balance_reconciliation_audit IS 'Auditoria de reconciliações de saldo executadas por administradores';
COMMENT ON COLUMN balance_reconciliation_audit.rubini_coins_divergence IS 'Diferença entre saldo armazenado e calculado (positivo = saldo maior que deveria)';
COMMENT ON COLUMN balance_reconciliation_audit.tickets_divergence IS 'Diferença entre saldo armazenado e calculado (positivo = saldo maior que deveria)';
COMMENT ON COLUMN balance_reconciliation_audit.corrections_applied IS 'Se true, correções foram aplicadas; se false, foi apenas análise (dry-run)';
