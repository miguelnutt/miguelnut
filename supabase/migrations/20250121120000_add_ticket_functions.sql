-- Função para atualizar saldo de tickets contornando RLS
CREATE OR REPLACE FUNCTION update_tickets_balance(p_user_id UUID, p_new_balance INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO tickets (user_id, tickets_atual, updated_at)
  VALUES (p_user_id, p_new_balance, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET 
    tickets_atual = p_new_balance,
    updated_at = NOW();
END;
$$;

-- Função para inserir no ticket_ledger contornando RLS
CREATE OR REPLACE FUNCTION insert_ticket_ledger(
  p_user_id UUID,
  p_variacao INTEGER,
  p_motivo TEXT,
  p_idempotency_key TEXT,
  p_origem TEXT,
  p_status TEXT DEFAULT 'confirmado'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO ticket_ledger (
    user_id,
    variacao,
    motivo,
    idempotency_key,
    origem,
    status,
    retries,
    created_at
  )
  VALUES (
    p_user_id,
    p_variacao,
    p_motivo,
    p_idempotency_key,
    p_origem,
    p_status,
    0,
    NOW()
  );
END;
$$;

-- Conceder permissões para o service_role
GRANT EXECUTE ON FUNCTION update_tickets_balance(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION insert_ticket_ledger(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Comentários para documentação
COMMENT ON FUNCTION update_tickets_balance IS 'Atualiza saldo de tickets contornando RLS - usado pelas Edge Functions';
COMMENT ON FUNCTION insert_ticket_ledger IS 'Insere registro no ticket_ledger contornando RLS - usado pelas Edge Functions';