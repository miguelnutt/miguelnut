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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Buscar perfil do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('twitch_username')
      .eq('id', user.id)
      .single();

    if (!profile?.twitch_username) {
      return new Response(
        JSON.stringify({ message: 'Nenhum username vinculado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar créditos provisórios pendentes
    const { data: creditos, error: creditosError } = await supabase
      .from('creditos_provisorios')
      .select('*')
      .eq('twitch_username', profile.twitch_username)
      .eq('aplicado', false);

    if (creditosError || !creditos || creditos.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum crédito provisório encontrado', aplicados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalRubiniCoins = 0;
    let totalTickets = 0;
    let totalPontosLoja = 0;

    // Processar cada crédito
    for (const credito of creditos) {
      if (credito.tipo_credito === 'rubini_coins') {
        totalRubiniCoins += credito.valor;
        
        // Adicionar ao saldo
        const { data: balance } = await supabase
          .from('rubini_coins_balance')
          .select('saldo')
          .eq('user_id', user.id)
          .single();

        await supabase
          .from('rubini_coins_balance')
          .upsert({
            user_id: user.id,
            saldo: (balance?.saldo || 0) + credito.valor
          });

        // Registrar no histórico
        await supabase.from('rubini_coins_history').insert({
          user_id: user.id,
          variacao: credito.valor,
          motivo: `Crédito provisório aplicado - ${credito.motivo}`
        });
      } else if (credito.tipo_credito === 'tickets') {
        totalTickets += credito.valor;
        
        // Adicionar tickets (assumindo que já existe lógica de tickets)
        const { data: ticketBalance } = await supabase
          .from('tickets')
          .select('tickets_atual')
          .eq('user_id', user.id)
          .single();

        await supabase
          .from('tickets')
          .upsert({
            user_id: user.id,
            tickets_atual: (ticketBalance?.tickets_atual || 0) + credito.valor
          });

        await supabase.from('ticket_ledger').insert({
          user_id: user.id,
          variacao: credito.valor,
          motivo: `Crédito provisório aplicado - ${credito.motivo}`
        });
      }
      // pontosLoja seria processado via StreamElements

      // Marcar crédito como aplicado
      await supabase
        .from('creditos_provisorios')
        .update({
          aplicado: true,
          aplicado_em: new Date().toISOString()
        })
        .eq('id', credito.id);
    }

    console.log(`Créditos aplicados para ${user.id}: ${totalRubiniCoins} Rubini Coins, ${totalTickets} Tickets`);

    return new Response(
      JSON.stringify({ 
        success: true,
        aplicados: creditos.length,
        totalRubiniCoins,
        totalTickets,
        totalPontosLoja
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