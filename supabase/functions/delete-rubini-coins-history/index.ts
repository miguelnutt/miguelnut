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

    const { historyId } = await req.json();

    if (!historyId) {
      return new Response(
        JSON.stringify({ error: 'ID do histórico é necessário' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar o registro do histórico antes de deletar
    const { data: historyRecord, error: fetchError } = await supabase
      .from('rubini_coins_history')
      .select('*')
      .eq('id', historyId)
      .single();

    if (fetchError || !historyRecord) {
      console.error('Erro ao buscar histórico:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Histórico não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Se o histórico tem user_id, ajustar o saldo
    let novoSaldo: number | null = null;
    if (historyRecord.user_id) {
      const { data: balance } = await supabase
        .from('rubini_coins_balance')
        .select('saldo')
        .eq('user_id', historyRecord.user_id)
        .maybeSingle();

      if (balance) {
        novoSaldo = balance.saldo - historyRecord.variacao;
        
        // Não permitir saldo negativo
        if (novoSaldo < 0) {
          return new Response(
            JSON.stringify({ error: 'Exclusão resultaria em saldo negativo' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Atualizar saldo
        const { error: updateError } = await supabase
          .from('rubini_coins_balance')
          .update({ saldo: novoSaldo })
          .eq('user_id', historyRecord.user_id);

        if (updateError) {
          console.error('Erro ao atualizar saldo:', updateError);
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar saldo' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        console.log(`Saldo ajustado: user ${historyRecord.user_id}, variação: -${historyRecord.variacao}, novo saldo: ${novoSaldo}`);
      }
    }

    // 4. Se for Pontos de Loja e tem user_id, processar débito na StreamElements
    if (historyRecord.tipo === 'Pontos de Loja' && historyRecord.user_id) {
      const pontos = Math.abs(historyRecord.variacao) || 0; // Usar valor absoluto
      
      // Buscar informações do usuário para obter o username
      const { data: profile } = await supabase
        .from('profiles')
        .select('twitch_username, nome')
        .eq('id', historyRecord.user_id)
        .single();

      if (profile && profile.twitch_username) {
        try {
          // Enviar débito para StreamElements (valor negativo para remover pontos)
          const { error: syncError } = await supabase.functions.invoke('sync-streamelements-points', {
            body: {
              username: profile.twitch_username,
              user_id: historyRecord.user_id,
              points: -pontos, // Valor negativo para debitar
              tipo_operacao: 'estorno_historico',
              referencia_id: historyId,
              reason: `Histórico deletado: -${pontos} pontos de loja`
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
        console.log(`Usuário sem twitch_username, não é possível debitar pontos: user_id ${historyRecord.user_id}`);
      }
    }

    // 5. Deletar o registro do histórico
    const { error: deleteError } = await supabase
      .from('rubini_coins_history')
      .delete()
      .eq('id', historyId);

    if (deleteError) {
      console.error('Erro ao deletar histórico:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Erro ao deletar histórico' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`✅ Histórico ${historyId} deletado com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: historyRecord.tipo === 'Pontos de Loja' && historyRecord.user_id 
          ? 'Histórico deletado e pontos debitados na StreamElements com sucesso'
          : 'Histórico deletado com sucesso',
        balanceUpdated: historyRecord.user_id ? true : false,
        newBalance: historyRecord.user_id ? novoSaldo : null,
        streamElementsDebited: historyRecord.tipo === 'Pontos de Loja' && historyRecord.user_id
      }),
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
