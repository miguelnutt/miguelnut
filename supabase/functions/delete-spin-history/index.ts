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

    const { spinId } = await req.json();

    if (!spinId) {
      return new Response(
        JSON.stringify({ error: 'ID do histórico é necessário' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar o registro do spin antes de deletar
    const { data: spinRecord, error: fetchError } = await supabase
      .from('spins')
      .select('*')
      .eq('id', spinId)
      .single();

    if (fetchError || !spinRecord) {
      console.error('Erro ao buscar spin:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Histórico não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Se o spin é de Rubini Coins e tem user_id, ajustar o saldo
    if (spinRecord.tipo_recompensa === 'Rubini Coins' && spinRecord.user_id) {
      const rubiniCoins = parseInt(spinRecord.valor) || 0;
      
      // Buscar saldo atual
      const { data: balance } = await supabase
        .from('rubini_coins_balance')
        .select('saldo')
        .eq('user_id', spinRecord.user_id)
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
          .eq('user_id', spinRecord.user_id);

        if (updateError) {
          console.error('Erro ao atualizar saldo de Rubini Coins:', updateError);
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar saldo' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        console.log(`Saldo de Rubini Coins ajustado: user ${spinRecord.user_id}, redução: -${rubiniCoins}, novo saldo: ${novoSaldo}`);
      }
    }

    // Se o spin é de Tickets e tem user_id, ajustar o saldo
    if (spinRecord.tipo_recompensa === 'Tickets' && spinRecord.user_id) {
      const tickets = parseInt(spinRecord.valor) || 0;
      
      // Buscar saldo atual de tickets
      const { data: ticketsBalance } = await supabase
        .from('tickets')
        .select('tickets_atual')
        .eq('user_id', spinRecord.user_id)
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
          .eq('user_id', spinRecord.user_id);

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
            user_id: spinRecord.user_id,
            variacao: -tickets,
            motivo: `Histórico deletado: -${tickets} ticket(s)`
          });

        console.log(`Saldo de tickets ajustado: user ${spinRecord.user_id}, redução: -${tickets}, novo saldo: ${novoSaldo}`);
      }
    }

    // Se o spin é de Pontos de Loja e tem user_id, processar débito na StreamElements
    if (spinRecord.tipo_recompensa === 'Pontos de Loja' && spinRecord.user_id) {
      const pontos = parseInt(spinRecord.valor) || 0;
      
      // Buscar informações do usuário para obter o username
      const { data: profile } = await supabase
        .from('profiles')
        .select('twitch_username, nome')
        .eq('id', spinRecord.user_id)
        .single();

      if (profile && profile.twitch_username) {
        try {
          // Enviar débito para StreamElements (valor negativo para remover pontos)
          const { error: syncError } = await supabase.functions.invoke('sync-streamelements-points', {
            body: {
              username: profile.twitch_username,
              user_id: spinRecord.user_id,
              points: -pontos, // Valor negativo para debitar
              tipo_operacao: 'estorno_spin',
              referencia_id: spinId,
              reason: `Histórico deletado: -${pontos} pontos`
            }
          });

          if (syncError) {
            console.error('Erro ao debitar pontos na StreamElements:', syncError);
            return new Response(
              JSON.stringify({ error: 'Erro ao debitar pontos na StreamElements' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }

          console.log(`Pontos debitados na StreamElements: user ${profile.twitch_username}, débito: -${pontos}`);
        } catch (error) {
          console.error('Erro ao processar débito de pontos:', error);
          return new Response(
            JSON.stringify({ error: 'Erro ao processar débito de pontos' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      } else {
        console.log(`Usuário sem twitch_username, não é possível debitar pontos: user_id ${spinRecord.user_id}`);
      }
    }

    // Deletar o spin
    const { error: deleteError } = await supabase
      .from('spins')
      .delete()
      .eq('id', spinId);

    if (deleteError) {
      console.error('Erro ao deletar spin:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Erro ao deletar histórico' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Spin deletado com sucesso: ${spinId}`);

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
