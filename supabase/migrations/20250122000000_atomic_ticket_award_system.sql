-- Migração: Sistema Atômico de Award de Tickets
-- Data: 2025-01-22
-- Descrição: Implementa função SQL atômica para garantir consistência nas operações de tickets

-- Função para award atômico de tickets
CREATE OR REPLACE FUNCTION award_tickets_atomic(
  p_user_id UUID,
  p_amount INTEGER,
  p_source TEXT,
  p_reason TEXT,
  p_idempotency_key TEXT,
  p_origem TEXT DEFAULT 'roulette'
) RETURNS JSON AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_result JSON;
  v_existing_record RECORD;
BEGIN
  -- Verificar se já existe uma transação com esta chave de idempotência
  SELECT * INTO v_existing_record 
  FROM ticket_ledger 
  WHERE idempotency_key = p_idempotency_key;
  
  IF FOUND THEN
    -- Se já existe, retornar o resultado da transação anterior
    SELECT tickets_atual INTO v_new_balance 
    FROM tickets 
    WHERE user_id = p_user_id;
    
    RETURN json_build_object(
      'success', true, 
      'newBalance', v_new_balance,
      'duplicate', true,
      'message', 'Transação já processada anteriormente'
    );
  END IF;
  
  -- Verificar se o usuário existe na tabela tickets
  SELECT tickets_atual INTO v_current_balance 
  FROM tickets 
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    -- Criar registro de tickets para o usuário se não existir
    INSERT INTO tickets (user_id, tickets_atual) 
    VALUES (p_user_id, 0);
    v_current_balance := 0;
  END IF;
  
  -- Calcular novo saldo
  v_new_balance := v_current_balance + p_amount;
  
  -- Validar que o saldo não ficará negativo
  IF v_new_balance < 0 THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Saldo insuficiente',
      'currentBalance', v_current_balance,
      'requestedAmount', p_amount
    );
  END IF;
  
  -- Atualizar saldo na tabela tickets
  UPDATE tickets 
  SET tickets_atual = v_new_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Inserir registro no ticket_ledger
  INSERT INTO ticket_ledger (
    user_id, 
    tipo, 
    quantidade, 
    saldo_anterior, 
    saldo_novo, 
    descricao, 
    idempotency_key, 
    origem, 
    status,
    created_at
  ) VALUES (
    p_user_id,
    CASE WHEN p_amount > 0 THEN 'credito' ELSE 'debito' END,
    ABS(p_amount),
    v_current_balance,
    v_new_balance,
    p_reason,
    p_idempotency_key,
    p_origem,
    'confirmado',
    NOW()
  );
  
  -- Retornar resultado de sucesso
  RETURN json_build_object(
    'success', true, 
    'newBalance', v_new_balance,
    'previousBalance', v_current_balance,
    'amount', p_amount,
    'duplicate', false
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, retornar detalhes do erro
    RETURN json_build_object(
      'success', false, 
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar consistência de saldos
CREATE OR REPLACE FUNCTION check_ticket_balance_consistency(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
  user_id UUID,
  current_balance INTEGER,
  calculated_balance INTEGER,
  difference INTEGER,
  is_consistent BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH balance_calculation AS (
    SELECT 
      t.user_id,
      t.tickets_atual as current_balance,
      COALESCE(
        SUM(
          CASE 
            WHEN tl.tipo = 'credito' THEN tl.quantidade
            WHEN tl.tipo = 'debito' THEN -tl.quantidade
            ELSE 0
          END
        ), 0
      ) as calculated_balance
    FROM tickets t
    LEFT JOIN ticket_ledger tl ON t.user_id = tl.user_id 
      AND tl.status = 'confirmado'
    WHERE (p_user_id IS NULL OR t.user_id = p_user_id)
    GROUP BY t.user_id, t.tickets_atual
  )
  SELECT 
    bc.user_id,
    bc.current_balance,
    bc.calculated_balance,
    (bc.current_balance - bc.calculated_balance) as difference,
    (bc.current_balance = bc.calculated_balance) as is_consistent
  FROM balance_calculation bc
  ORDER BY bc.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para reconciliar saldos inconsistentes
CREATE OR REPLACE FUNCTION reconcile_ticket_balance(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_current_balance INTEGER;
  v_calculated_balance INTEGER;
  v_difference INTEGER;
  v_result JSON;
BEGIN
  -- Verificar consistência atual
  SELECT 
    current_balance, 
    calculated_balance, 
    difference
  INTO 
    v_current_balance, 
    v_calculated_balance, 
    v_difference
  FROM check_ticket_balance_consistency(p_user_id)
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;
  
  IF v_difference = 0 THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Saldo já está consistente',
      'balance', v_current_balance
    );
  END IF;
  
  -- Corrigir o saldo
  UPDATE tickets 
  SET tickets_atual = v_calculated_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Registrar a correção no ledger
  INSERT INTO ticket_ledger (
    user_id,
    tipo,
    quantidade,
    saldo_anterior,
    saldo_novo,
    descricao,
    idempotency_key,
    origem,
    status,
    created_at
  ) VALUES (
    p_user_id,
    CASE WHEN v_difference > 0 THEN 'debito' ELSE 'credito' END,
    ABS(v_difference),
    v_current_balance,
    v_calculated_balance,
    'Reconciliação automática de saldo - correção de inconsistência',
    'reconcile-' || p_user_id || '-' || extract(epoch from now()),
    'system',
    'confirmado',
    NOW()
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Saldo reconciliado com sucesso',
    'previousBalance', v_current_balance,
    'newBalance', v_calculated_balance,
    'correction', v_difference
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_ticket_ledger_idempotency_key 
ON ticket_ledger(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_ticket_ledger_user_status 
ON ticket_ledger(user_id, status);

CREATE INDEX IF NOT EXISTS idx_ticket_ledger_created_at 
ON ticket_ledger(created_at DESC);

-- Função para verificar consistência de todos os usuários
CREATE OR REPLACE FUNCTION check_all_ticket_balances_consistency()
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    current_balance INTEGER,
    calculated_balance INTEGER,
    is_consistent BOOLEAN,
    difference INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.user_id,
        COALESCE(p.display_name_canonical, 'Unknown') as username,
        COALESCE(t.tickets_atual, 0) as current_balance,
        COALESCE(
            (SELECT SUM(CASE 
                WHEN ta.transaction_type = 'credit' THEN ta.amount 
                ELSE -ta.amount 
            END)
            FROM ticket_audit ta 
            WHERE ta.user_id = t.user_id), 0
        ) as calculated_balance,
        (COALESCE(t.tickets_atual, 0) = COALESCE(
            (SELECT SUM(CASE 
                WHEN ta.transaction_type = 'credit' THEN ta.amount 
                ELSE -ta.amount 
            END)
            FROM ticket_audit ta 
            WHERE ta.user_id = t.user_id), 0
        )) as is_consistent,
        (COALESCE(t.tickets_atual, 0) - COALESCE(
            (SELECT SUM(CASE 
                WHEN ta.transaction_type = 'credit' THEN ta.amount 
                ELSE -ta.amount 
            END)
            FROM ticket_audit ta 
            WHERE ta.user_id = t.user_id), 0
        )) as difference
    FROM tickets t
    LEFT JOIN profiles p ON p.id = t.user_id
    WHERE t.user_id IS NOT NULL;
END;
$$;

-- Comentários para documentação
COMMENT ON FUNCTION award_tickets_atomic IS 'Função atômica para concessão de tickets com idempotência e auditoria';
COMMENT ON FUNCTION check_ticket_balance_consistency IS 'Verifica se o saldo de tickets está consistente com o histórico';
COMMENT ON FUNCTION reconcile_ticket_balance IS 'Corrige saldos inconsistentes de tickets';
COMMENT ON FUNCTION check_all_ticket_balances_consistency IS 'Verifica consistência de saldos de todos os usuários';