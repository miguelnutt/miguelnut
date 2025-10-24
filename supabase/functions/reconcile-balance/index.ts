import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReconcileRequest {
  userId: string;
  dryRun?: boolean;
}

interface ReconcileResult {
  success: boolean;
  userId: string;
  username: string;
  rubiniCoins: {
    before: number;
    calculated: number;
    after: number;
    divergence: number;
    corrected: boolean;
  };
  tickets: {
    before: number;
    calculated: number;
    after: number;
    divergence: number;
    corrected: boolean;
  };
  summary: {
    hadDivergence: boolean;
    correctionApplied: boolean;
    reason: string;
  };
  auditId?: string;
  requestId: string;
}

/**
 * Balance Reconciliation Service
 * 
 * Recalcula saldos a partir do histórico de transações e corrige divergências.
 * - Idempotente: rodadas repetidas em saldos corretos não fazem alterações
 * - Requer permissão de admin
 * - Gera auditoria completa de correções aplicadas
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autorização necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair token JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      console.log(`[reconcile-balance] Acesso negado para user ${user.id} (não é admin)`);
      return new Response(
        JSON.stringify({ error: 'Permissão de administrador necessária' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, dryRun = false }: ReconcileRequest = await req.json();
    const requestId = `reconcile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[${requestId}] Reconciliação iniciada: userId=${userId}, dryRun=${dryRun}, admin=${user.id}`);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, nome, twitch_username')
      .eq('id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (profileError || !profile) {
      console.error(`[${requestId}] Perfil não encontrado: ${userId}`);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PARTE 1: RECALCULAR RUBINI COINS =====
    
    // Saldo atual armazenado
    const { data: currentRCBalance } = await supabase
      .from('rubini_coins_balance')
      .select('saldo')
      .eq('user_id', userId)
      .maybeSingle();

    const currentRC = currentRCBalance?.saldo || 0;

    // Calcular saldo correto a partir do histórico (apenas transações confirmadas)
    const { data: rcHistory } = await supabase
      .from('rubini_coins_history')
      .select('variacao')
      .eq('user_id', userId)
      .eq('status', 'confirmado');

    const calculatedRC = (rcHistory || []).reduce((sum, tx) => sum + tx.variacao, 0);
    const rcDivergence = currentRC - calculatedRC;

    console.log(`[${requestId}] Rubini Coins: current=${currentRC}, calculated=${calculatedRC}, divergence=${rcDivergence}`);

    // ===== PARTE 2: RECALCULAR TICKETS =====
    
    // Saldo atual armazenado
    const { data: currentTicketsBalance } = await supabase
      .from('tickets')
      .select('tickets_atual')
      .eq('user_id', userId)
      .maybeSingle();

    const currentTickets = currentTicketsBalance?.tickets_atual || 0;

    // Calcular saldo correto a partir do histórico (apenas transações confirmadas)
    const { data: ticketsHistory } = await supabase
      .from('ticket_ledger')
      .select('variacao')
      .eq('user_id', userId)
      .eq('status', 'confirmado');

    const calculatedTickets = (ticketsHistory || []).reduce((sum, tx) => sum + tx.variacao, 0);
    const ticketsDivergence = currentTickets - calculatedTickets;

    console.log(`[${requestId}] Tickets: current=${currentTickets}, calculated=${calculatedTickets}, divergence=${ticketsDivergence}`);

    // ===== PARTE 3: DETERMINAR SE HÁ DIVERGÊNCIA =====
    
    const hadDivergence = rcDivergence !== 0 || ticketsDivergence !== 0;
    let correctionApplied = false;
    let auditId: string | undefined;
    let reason = 'Saldos já estão corretos';

    if (hadDivergence && !dryRun) {
      // ===== PARTE 4: APLICAR CORREÇÕES =====
      
      reason = 'Divergência detectada e corrigida';
      
      try {
        // Corrigir Rubini Coins
        if (rcDivergence !== 0) {
          await supabase
            .from('rubini_coins_balance')
            .upsert({
              user_id: userId,
              saldo: calculatedRC
            });

          // Registrar correção no histórico
          await supabase
            .from('rubini_coins_history')
            .insert({
              user_id: userId,
              variacao: -rcDivergence,
              motivo: `Reconciliação: correção de divergência de ${rcDivergence} (admin: ${user.id})`,
              origem: 'reconciliation',
              status: 'confirmado',
              idempotency_key: `reconcile-rc-${requestId}`
            });

          console.log(`[${requestId}] ✅ Rubini Coins corrigido: ${currentRC} → ${calculatedRC}`);
        }

        // Corrigir Tickets
        if (ticketsDivergence !== 0) {
          await supabase
            .from('tickets')
            .upsert({
              user_id: userId,
              tickets_atual: calculatedTickets
            });

          // Registrar correção no histórico
          await supabase
            .from('ticket_ledger')
            .insert({
              user_id: userId,
              variacao: -ticketsDivergence,
              motivo: `Reconciliação: correção de divergência de ${ticketsDivergence} (admin: ${user.id})`,
              origem: 'reconciliation',
              status: 'confirmado',
              idempotency_key: `reconcile-tickets-${requestId}`
            });

          console.log(`[${requestId}] ✅ Tickets corrigido: ${currentTickets} → ${calculatedTickets}`);
        }

        // ===== PARTE 5: REGISTRAR AUDITORIA =====
        
        const { data: auditRecord, error: auditError } = await supabase
          .from('balance_reconciliation_audit')
          .insert({
            user_id: userId,
            performed_by: user.id,
            rubini_coins_before: currentRC,
            rubini_coins_calculated: calculatedRC,
            rubini_coins_divergence: rcDivergence,
            tickets_before: currentTickets,
            tickets_calculated: calculatedTickets,
            tickets_divergence: ticketsDivergence,
            corrections_applied: true,
            metadata: {
              requestId,
              username: profile.twitch_username || profile.nome,
              timestamp: new Date().toISOString()
            }
          })
          .select('id')
          .single();

        if (!auditError && auditRecord) {
          auditId = auditRecord.id;
        }

        correctionApplied = true;

        console.log(`[${requestId}] ✅ Reconciliação concluída com correções aplicadas`);

      } catch (correctionError) {
        console.error(`[${requestId}] ❌ Erro ao aplicar correções:`, correctionError);
        throw correctionError;
      }

    } else if (hadDivergence && dryRun) {
      reason = 'Divergência detectada (modo dry-run, correções não aplicadas)';
      console.log(`[${requestId}] Modo dry-run: divergência detectada mas não corrigida`);
    }

    // ===== PARTE 6: MONTAR RESULTADO =====
    
    const result: ReconcileResult = {
      success: true,
      userId,
      username: profile.twitch_username || profile.nome,
      rubiniCoins: {
        before: currentRC,
        calculated: calculatedRC,
        after: correctionApplied ? calculatedRC : currentRC,
        divergence: rcDivergence,
        corrected: correctionApplied && rcDivergence !== 0
      },
      tickets: {
        before: currentTickets,
        calculated: calculatedTickets,
        after: correctionApplied ? calculatedTickets : currentTickets,
        divergence: ticketsDivergence,
        corrected: correctionApplied && ticketsDivergence !== 0
      },
      summary: {
        hadDivergence,
        correctionApplied,
        reason
      },
      auditId,
      requestId
    };

    console.log(`[${requestId}] Resultado:`, JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in reconcile-balance:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
