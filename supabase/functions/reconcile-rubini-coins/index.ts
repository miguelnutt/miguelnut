import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { historyId, adminUserId } = await req.json();

    if (!historyId) {
      return new Response(
        JSON.stringify({ error: 'historyId é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[reconcile-rubini-coins] Reprocessando evento: ${historyId}`);

    // Buscar evento pendente ou falho
    const { data: event, error: fetchError } = await supabase
      .from('rubini_coins_history')
      .select('*')
      .eq('id', historyId)
      .in('status', ['pendente', 'falhou'])
      .single();

    if (fetchError || !event) {
      console.error('[reconcile-rubini-coins] Evento não encontrado ou já confirmado:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Evento não encontrado ou já está confirmado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verificar se idempotency_key já foi confirmado
    if (event.idempotency_key) {
      const { data: confirmedEvent } = await supabase
        .from('rubini_coins_history')
        .select('id')
        .eq('idempotency_key', event.idempotency_key)
        .eq('status', 'confirmado')
        .maybeSingle();

      if (confirmedEvent && confirmedEvent.id !== historyId) {
        console.log(`[reconcile-rubini-coins] ⚠️ Evento ${historyId} já foi confirmado em ${confirmedEvent.id}, marcando como falhou (duplicado)`);
        
        await supabase
          .from('rubini_coins_history')
          .update({
            status: 'falhou',
            error_message: `Duplicado de ${confirmedEvent.id}`,
            retries: (event.retries || 0) + 1
          })
          .eq('id', historyId);
        
        return new Response(
          JSON.stringify({ success: false, error: 'Evento já foi processado', duplicated: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    try {
      // Buscar saldo atual
      const { data: balance } = await supabase
        .from('rubini_coins_balance')
        .select('saldo')
        .eq('user_id', event.user_id)
        .maybeSingle();

      const saldoAtual = balance?.saldo || 0;
      const novoSaldo = saldoAtual + event.variacao;

      // Verificar se saldo ficaria negativo
      if (novoSaldo < 0) {
        console.error('[reconcile-rubini-coins] Saldo insuficiente após reprocessamento');
        
        await supabase
          .from('rubini_coins_history')
          .update({
            status: 'falhou',
            error_message: 'Saldo insuficiente',
            retries: (event.retries || 0) + 1
          })
          .eq('id', historyId);
        
        return new Response(
          JSON.stringify({ success: false, error: 'Saldo insuficiente' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Atualizar saldo
      await supabase
        .from('rubini_coins_balance')
        .upsert({
          user_id: event.user_id,
          saldo: novoSaldo
        });

      // Marcar como confirmado
      await supabase
        .from('rubini_coins_history')
        .update({
          status: 'confirmado',
          error_message: null,
          retries: (event.retries || 0) + 1
        })
        .eq('id', historyId);

      console.log(`[reconcile-rubini-coins] ✅ Evento ${historyId} reprocessado com sucesso. Novo saldo: ${novoSaldo}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          novoSaldo,
          message: `+${event.variacao} Rubini Coins creditados`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('[reconcile-rubini-coins] ❌ Erro ao reprocessar:', error);
      
      // Atualizar status para falhou
      await supabase
        .from('rubini_coins_history')
        .update({
          status: 'falhou',
          error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          retries: (event.retries || 0) + 1
        })
        .eq('id', historyId);
      
      throw error;
    }

  } catch (error) {
    console.error('[reconcile-rubini-coins] Erro inesperado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});