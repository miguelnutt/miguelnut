import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClaimRequest {
  userId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId } = await req.json() as ClaimRequest;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pegar data atual no horário de Brasília usando Intl.DateTimeFormat
    const hoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    // Buscar registro de login do usuário
    const { data: loginData, error: loginError } = await supabase
      .from('user_daily_logins')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (loginError && loginError.code !== 'PGRST116') {
      throw loginError;
    }

    let diaAtual = 1;

    // VALIDAÇÃO CRÍTICA: Verificar se já resgatou hoje
    if (loginData) {
      const ultimoLogin = loginData.ultimo_login; // já está em formato YYYY-MM-DD
      
      // Se já resgatou hoje, bloquear
      if (ultimoLogin === hoje) {
        return new Response(
          JSON.stringify({ 
            error: 'Você já resgatou a recompensa de hoje',
            diaAtual: loginData.dia_atual,
            podeResgatar: false
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calcular diferença de dias
      const diffDays = Math.floor(
        (new Date(hoje).getTime() - new Date(ultimoLogin).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        // Login consecutivo - avançar dia
        diaAtual = loginData.dia_atual >= 30 ? 1 : loginData.dia_atual + 1;
      } else {
        // Perdeu consecutivo - resetar para dia 1
        diaAtual = 1;
      }
    }

    // Calcular pontos baseado na sequência
    // Regra padrão: 25 pontos, 50 pontos em múltiplos de 5
    let pontos = 25;
    
    // Verificar se há recompensa especial configurada para este dia da sequência
    const { data: specialReward } = await supabase
      .from('daily_reward_special_config')
      .select('pontos')
      .eq('dia_sequencia', diaAtual)
      .maybeSingle();
    
    if (specialReward) {
      // Usar recompensa especial se configurada
      pontos = specialReward.pontos;
    } else if (diaAtual % 5 === 0) {
      // Múltiplo de 5: 50 pontos
      pontos = 50;
    }

    // Atualizar ou inserir registro de login com validação adicional
    const { error: upsertError } = await supabase
      .from('user_daily_logins')
      .upsert({
        user_id: userId,
        dia_atual: diaAtual,
        ultimo_login: hoje,
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error('Erro ao atualizar login:', upsertError);
      throw upsertError;
    }

    // Registrar no histórico
    const { error: historyError } = await supabase
      .from('daily_rewards_history')
      .insert({
        user_id: userId,
        dia: diaAtual,
        pontos: pontos,
      });

    if (historyError) throw historyError;

    // Buscar perfil do usuário para pegar o username da Twitch
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('twitch_username')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    if (!profile.twitch_username) {
      return new Response(
        JSON.stringify({ error: 'Usuário não possui username da Twitch vinculado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Creditar pontos na StreamElements
    const seToken = Deno.env.get('STREAMELEMENTS_JWT_TOKEN');
    const seChannelId = Deno.env.get('STREAMELEMENTS_CHANNEL_ID');

    if (!seToken || !seChannelId) {
      console.error('StreamElements não configurado');
      return new Response(
        JSON.stringify({ 
          success: true, 
          diaAtual,
          pontos,
          warning: 'Recompensa registrada mas StreamElements não configurado'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const seResponse = await fetch(
      `https://api.streamelements.com/kappa/v2/points/${seChannelId}/${profile.twitch_username}/${pontos}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${seToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!seResponse.ok) {
      console.error(`StreamElements API error: ${seResponse.status}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          diaAtual,
          pontos,
          warning: 'Recompensa registrada mas erro ao creditar pontos'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        diaAtual,
        pontos,
        message: `${pontos} pontos creditados com sucesso!`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro ao processar recompensa diária:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
