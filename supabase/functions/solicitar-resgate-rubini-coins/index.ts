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

    const { quantidade, personagem, userId } = await req.json();

    console.log('📝 Processando resgate para userId:', userId);

    // Validar quantidade (múltiplo de 25)
    if (!quantidade || quantidade <= 0 || quantidade % 25 !== 0) {
      return new Response(
        JSON.stringify({ error: 'Quantidade deve ser múltiplo de 25' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validar personagem
    if (!personagem || personagem.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Selecione um personagem vinculado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // userId é obrigatório
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar saldo disponível
    const { data: balance, error: balanceError } = await supabase
      .from('rubini_coins_balance')
      .select('saldo')
      .eq('user_id', userId)
      .maybeSingle();

    if (balanceError) {
      console.error('❌ Erro ao buscar saldo:', balanceError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar saldo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!balance) {
      console.log('❌ Saldo não encontrado para userId:', userId);
      return new Response(
        JSON.stringify({ error: 'Saldo não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (balance.saldo < quantidade) {
      return new Response(
        JSON.stringify({ error: 'Saldo insuficiente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Iniciar transação: debitar saldo e criar solicitação
    const { error: debitError } = await supabase
      .from('rubini_coins_balance')
      .update({ saldo: balance.saldo - quantidade })
      .eq('user_id', userId);

    if (debitError) {
      console.error('❌ Erro ao debitar saldo:', debitError);
      throw new Error('Erro ao processar resgate');
    }

    // Criar solicitação
    const { data: resgate, error: resgateError } = await supabase
      .from('rubini_coins_resgates')
      .insert({
        user_id: userId,
        quantidade,
        personagem: personagem.trim(),
        status: 'PENDENTE'
      })
      .select()
      .single();

    if (resgateError) {
      // Reverter débito em caso de erro
      await supabase
        .from('rubini_coins_balance')
        .update({ saldo: balance.saldo })
        .eq('user_id', userId);
      
      console.error('❌ Erro ao criar resgate:', resgateError);
      throw new Error('Erro ao criar solicitação');
    }

    // Registrar no histórico
    await supabase.from('rubini_coins_history').insert({
      user_id: userId,
      variacao: -quantidade,
      motivo: `Resgate solicitado - ${personagem}`
    });

    console.log(`✅ Resgate criado com sucesso: ${resgate.id} - ${quantidade} RC para ${personagem}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        resgate,
        novoSaldo: balance.saldo - quantidade 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
