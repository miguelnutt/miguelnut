import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
  'Access-Control-Allow-Credentials': 'true',
};

const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-super-secret-jwt-key-change-this';

async function verifyJWT(token: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  return await verify(token, key);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação via token customizado Twitch
    const authHeader = req.headers.get('authorization') || '';
    const tokenMatch = authHeader.match(/Bearer (.+)/);
    
    if (!tokenMatch) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    const token = tokenMatch[1];
    let payload;
    
    try {
      payload = await verifyJWT(token);
      console.log('✅ Usuário autenticado via Twitch JWT');
    } catch (error) {
      console.error('❌ Erro ao verificar JWT:', error);
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { quantidade, personagem, userId } = await req.json();

    console.log('📝 Processando resgate:', { quantidade, personagem, userId });

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

    console.log(`✅ Resgate criado: ${resgate.id} - ${quantidade} Rubini Coins para ${personagem} (user: ${userId})`);

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
