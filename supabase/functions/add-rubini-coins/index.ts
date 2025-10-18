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

    const { userId, twitchUsername, quantidade, motivo } = await req.json();

    if (!quantidade || quantidade <= 0) {
      return new Response(
        JSON.stringify({ error: 'Quantidade inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Se tem userId, adicionar diretamente
    if (userId) {
      // Buscar ou criar saldo
      const { data: balance } = await supabase
        .from('rubini_coins_balance')
        .select('saldo')
        .eq('user_id', userId)
        .single();

      const novoSaldo = (balance?.saldo || 0) + quantidade;

      await supabase
        .from('rubini_coins_balance')
        .upsert({
          user_id: userId,
          saldo: novoSaldo
        });

      // Registrar no histórico
      await supabase.from('rubini_coins_history').insert({
        user_id: userId,
        variacao: quantidade,
        motivo: motivo || 'Prêmio'
      });

      console.log(`Rubini Coins adicionados: ${quantidade} para user ${userId}`);

      return new Response(
        JSON.stringify({ success: true, novoSaldo }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se não tem userId mas tem twitchUsername, criar crédito provisório
    if (twitchUsername) {
      await supabase.from('creditos_provisorios').insert({
        twitch_username: twitchUsername,
        tipo_credito: 'rubini_coins',
        valor: quantidade,
        motivo: motivo || 'Prêmio'
      });

      console.log(`Crédito provisório criado: ${quantidade} Rubini Coins para ${twitchUsername}`);

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