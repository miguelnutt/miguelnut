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

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { raffleId } = await req.json();

    if (!raffleId) {
      return new Response(
        JSON.stringify({ error: 'ID do sorteio é necessário' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar o registro do sorteio antes de deletar
    const { data: raffleRecord, error: fetchError } = await supabase
      .from('raffles')
      .select('*')
      .eq('id', raffleId)
      .single();

    if (fetchError || !raffleRecord) {
      console.error('Erro ao buscar sorteio:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Sorteio não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Se o sorteio é de Rubini Coins e tem vencedor_id, ajustar o saldo
    if (raffleRecord.tipo_premio === 'Rubini Coins' && raffleRecord.vencedor_id) {
      const rubiniCoins = raffleRecord.valor_premio || 0;
      
      // Buscar saldo atual
      const { data: balance } = await supabase
        .from('rubini_coins_balance')
        .select('saldo')
        .eq('user_id', raffleRecord.vencedor_id)
        .maybeSingle();

      if (balance) {
        const novoSaldo = balance.saldo - rubiniCoins;
        
        // Não permitir saldo negativo
        if (novoSaldo < 0) {
          return new Response(
            JSON.stringify({ error: 'Exclusão resultaria em saldo negativo de Rubini Coins' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Atualizar saldo
        const { error: updateError } = await supabase
          .from('rubini_coins_balance')
          .update({ saldo: novoSaldo })
          .eq('user_id', raffleRecord.vencedor_id);

        if (updateError) {
          console.error('Erro ao atualizar saldo de Rubini Coins:', updateError);
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar saldo' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        console.log(`Saldo de Rubini Coins ajustado: user ${raffleRecord.vencedor_id}, redução: -${rubiniCoins}, novo saldo: ${novoSaldo}`);
      }
    }

    // Se o sorteio é de Tickets e tem vencedor_id, ajustar o saldo
    if (raffleRecord.tipo_premio === 'Tickets' && raffleRecord.vencedor_id) {
      const tickets = raffleRecord.valor_premio || 0;
      
      // Buscar saldo atual de tickets
      const { data: ticketsBalance } = await supabase
        .from('tickets')
        .select('tickets_atual')
        .eq('user_id', raffleRecord.vencedor_id)
        .maybeSingle();

      if (ticketsBalance) {
        const novoSaldo = ticketsBalance.tickets_atual - tickets;
        
        // Não permitir saldo negativo
        if (novoSaldo < 0) {
          return new Response(
            JSON.stringify({ error: 'Exclusão resultaria em saldo negativo de Tickets' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Atualizar saldo de tickets
        const { error: updateError } = await supabase
          .from('tickets')
          .update({ tickets_atual: novoSaldo })
          .eq('user_id', raffleRecord.vencedor_id);

        if (updateError) {
          console.error('Erro ao atualizar saldo de tickets:', updateError);
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar saldo de tickets' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        // Adicionar entrada negativa no ledger
        await supabase
          .from('ticket_ledger')
          .insert({
            user_id: raffleRecord.vencedor_id,
            variacao: -tickets,
            motivo: `Sorteio deletado: -${tickets} ticket(s)`
          });

        console.log(`Saldo de tickets ajustado: user ${raffleRecord.vencedor_id}, redução: -${tickets}, novo saldo: ${novoSaldo}`);
      }
    }

    // Deletar o sorteio
    const { error: deleteError } = await supabase
      .from('raffles')
      .delete()
      .eq('id', raffleId);

    if (deleteError) {
      console.error('Erro ao deletar sorteio:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Erro ao deletar sorteio' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Sorteio deletado com sucesso: ${raffleId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
