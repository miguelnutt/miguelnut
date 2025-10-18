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
    if (historyRecord.user_id) {
      const { data: balance } = await supabase
        .from('rubini_coins_balance')
        .select('saldo')
        .eq('user_id', historyRecord.user_id)
        .maybeSingle();

      if (balance) {
        const novoSaldo = balance.saldo - historyRecord.variacao;
        
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

    // Deletar o histórico
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

    console.log(`Histórico deletado com sucesso: ${historyId}`);

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
