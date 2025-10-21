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

    const { userId, twitchUsername, quantidade, valor, motivo } = await req.json();
    
    // Aceitar tanto "quantidade" quanto "valor" para compatibilidade
    const valorOperacao = valor !== undefined ? valor : quantidade;

    if (valorOperacao === undefined || valorOperacao === 0) {
      return new Response(
        JSON.stringify({ error: 'Valor/Quantidade inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Se tem userId, adicionar/remover diretamente
    if (userId) {
      // Buscar ou criar saldo
      const { data: balance } = await supabase
        .from('rubini_coins_balance')
        .select('saldo')
        .eq('user_id', userId)
        .maybeSingle();

      const saldoAtual = balance?.saldo || 0;
      const novoSaldo = saldoAtual + valorOperacao;

      // Verificar se a remoção não deixará saldo negativo
      if (novoSaldo < 0) {
        return new Response(
          JSON.stringify({ error: 'Saldo insuficiente para essa operação' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      await supabase
        .from('rubini_coins_balance')
        .upsert({
          user_id: userId,
          saldo: novoSaldo
        });

      // Registrar no histórico
      await supabase.from('rubini_coins_history').insert({
        user_id: userId,
        variacao: valorOperacao,
        motivo: motivo || 'Operação manual'
      });

      console.log(`Rubini Coins ${valorOperacao > 0 ? 'adicionados' : 'removidos'}: ${Math.abs(valorOperacao)} para user ${userId}, novo saldo: ${novoSaldo}`);

      return new Response(
        JSON.stringify({ success: true, novoSaldo }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se não tem userId mas tem twitchUsername, criar crédito provisório (apenas adição)
    if (twitchUsername && valorOperacao > 0) {
      await supabase.from('creditos_provisorios').insert({
        twitch_username: twitchUsername,
        tipo_credito: 'rubini_coins',
        valor: valorOperacao,
        motivo: motivo || 'Prêmio'
      });

      console.log(`Crédito provisório criado: ${valorOperacao} Rubini Coins para ${twitchUsername}`);

      return new Response(
        JSON.stringify({ success: true, provisorio: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'userId ou twitchUsername necessário' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
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