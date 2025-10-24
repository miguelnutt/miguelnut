import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AwardRewardRequest {
  userId: string;
  type: 'store_points' | 'rubini_coins' | 'tickets';
  value: number;
  source: string; // ex: 'daily_reward', 'roulette', 'tibiatermo', 'admin'
  idempotencyKey: string;
  reason: string;
}

/**
 * Unified Reward Service
 * 
 * Centralizes all reward distribution with:
 * - Idempotency
 * - Proper routing (Store Points -> SE, RC -> balance, Tickets -> tickets table)
 * - Status tracking (confirmed/pending/failed)
 * - Unified monitoring
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { userId, type, value, source, idempotencyKey, reason }: AwardRewardRequest = await req.json();
    const requestId = `award-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[${requestId}] Award reward: userId=${userId}, type=${type}, value=${value}, source=${source}`);

    if (!userId || !type || value === undefined || !idempotencyKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, type, value, idempotencyKey' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar perfil para obter twitch_username
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('twitch_username')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      console.error(`[${requestId}] Profile not found for userId: ${userId}`);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const username = profile.twitch_username;

    // ROUTING por tipo de recompensa
    if (type === 'store_points') {
      // Pontos de Loja -> StreamElements
      console.log(`[${requestId}] Routing to StreamElements: ${value} points for ${username}`);

      const { data: seData, error: seError } = await supabase.functions.invoke('sync-streamelements-points', {
        body: {
          username,
          points: value,
          tipo_operacao: source,
          referencia_id: idempotencyKey,
          user_id: userId
        }
      });

      if (seError) {
        console.error(`[${requestId}] SE sync error:`, seError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            status: 'failed',
            error: seError.message,
            requestId
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: seData.verificado ? 'confirmed' : 'pending',
          message: `${value} pontos de loja ${seData.verificado ? 'confirmados' : 'enviados (pendente)'}`,
          requestId,
          details: seData
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (type === 'rubini_coins') {
      // Rubini Coins -> rubini_coins_balance
      console.log(`[${requestId}] Routing to Rubini Coins: ${value} RC for userId ${userId}`);

      const { data: rcData, error: rcError } = await supabase.functions.invoke('add-rubini-coins', {
        body: {
          userId,
          valor: value,
          motivo: reason || `Recompensa: ${source}`,
          idempotencyKey,
          origem: source
        }
      });

      if (rcError) {
        console.error(`[${requestId}] RC error:`, rcError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            status: 'failed',
            error: rcError.message,
            requestId
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'confirmed',
          message: `${value} Rubini Coins creditados`,
          requestId,
          newBalance: rcData.novoSaldo
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (type === 'tickets') {
      // Tickets -> tickets table
      console.log(`[${requestId}] Routing to Tickets: ${value} tickets for userId ${userId}`);

      // IDEMPOTÊNCIA: Verificar se já existe operação confirmada com mesmo idempotency_key
      const { data: existingTicketLog } = await supabase
        .from('ticket_ledger')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .eq('status', 'confirmado')
        .maybeSingle();

      if (existingTicketLog) {
        console.log(`[${requestId}] Duplicate ticket award detected (idempotencyKey: ${idempotencyKey}), retornando sucesso sem duplicar`);
        const { data: currentTickets } = await supabase
          .from('tickets')
          .select('tickets_atual')
          .eq('user_id', userId)
          .maybeSingle();

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'confirmed',
            message: `${value} tickets (já creditado)`,
            requestId,
            currentBalance: currentTickets?.tickets_atual || 0,
            duplicated: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Buscar saldo atual
        const { data: currentTickets } = await supabase
          .from('tickets')
          .select('tickets_atual')
          .eq('user_id', userId)
          .maybeSingle();

        const currentBalance = currentTickets?.tickets_atual || 0;
        const newBalance = currentBalance + value;

        // Validar saldo não-negativo
        if (newBalance < 0) {
          // Registrar falha no ledger
          await supabase.from('ticket_ledger').insert({
            user_id: userId,
            variacao: value,
            motivo: reason || `Recompensa: ${source}`,
            idempotency_key: idempotencyKey,
            origem: source,
            status: 'falhou',
            error_message: 'Saldo insuficiente',
            retries: 0
          });

          return new Response(
            JSON.stringify({ error: 'Saldo de tickets insuficiente para essa operação' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Atualizar saldo
        await supabase
          .from('tickets')
          .upsert({
            user_id: userId,
            tickets_atual: newBalance,
            updated_at: new Date().toISOString()
          });

        // Registrar no ledger como CONFIRMADO
        await supabase
          .from('ticket_ledger')
          .insert({
            user_id: userId,
            variacao: value,
            motivo: reason || `Recompensa: ${source}`,
            idempotency_key: idempotencyKey,
            origem: source,
            status: 'confirmado',
            retries: 0
          });

        console.log(`[${requestId}] ✅ Tickets ${value > 0 ? 'adicionados' : 'removidos'}: ${Math.abs(value)} para user ${userId}, novo saldo: ${newBalance}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'confirmed',
            message: `${value} tickets creditados`,
            requestId,
            newBalance
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: any) {
        console.error(`[${requestId}] ❌ Erro ao processar tickets:`, error);
        
        // Registrar falha no ledger
        await supabase.from('ticket_ledger').insert({
          user_id: userId,
          variacao: value,
          motivo: reason || `Recompensa: ${source}`,
          idempotency_key: idempotencyKey,
          origem: source,
          status: 'falhou',
          error_message: error.message || 'Erro desconhecido',
          retries: 0
        });
        
        throw error;
      }

    } else {
      return new Response(
        JSON.stringify({ error: `Unknown reward type: ${type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('Error in award-reward:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});