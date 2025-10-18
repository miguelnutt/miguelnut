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

    // Pegar data atual no horário de Brasília (UTC-3)
    const agora = new Date();
    const brasiliaOffset = -3 * 60; // UTC-3 em minutos
    const offsetAtual = agora.getTimezoneOffset();
    const diffMinutos = offsetAtual - brasiliaOffset;
    
    const horarioBrasilia = new Date(agora.getTime() + diffMinutos * 60000);
    const hoje = horarioBrasilia.toISOString().split('T')[0];

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
    let podeResgatar = true;

    if (loginData) {
      const ultimoLogin = new Date(loginData.ultimo_login);
      const hojeDat = new Date(hoje);
      const diffTime = hojeDat.getTime() - ultimoLogin.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Já resgatou hoje
        return new Response(
          JSON.stringify({ 
            error: 'Você já resgatou a recompensa de hoje',
            diaAtual: loginData.dia_atual,
            podeResgatar: false
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (diffDays === 1) {
        // Login consecutivo
        diaAtual = loginData.dia_atual === 30 ? 1 : loginData.dia_atual + 1;
      } else {
        // Perdeu o consecutivo, volta ao dia 1
        diaAtual = 1;
      }
    }

    // Buscar pontos da recompensa do dia
    const { data: rewardConfig, error: configError } = await supabase
      .from('daily_reward_config')
      .select('pontos')
      .eq('dia', diaAtual)
      .single();

    if (configError) throw configError;

    const pontos = rewardConfig.pontos;

    // Atualizar ou inserir registro de login
    const { error: upsertError } = await supabase
      .from('user_daily_logins')
      .upsert({
        user_id: userId,
        dia_atual: diaAtual,
        ultimo_login: hoje,
      });

    if (upsertError) throw upsertError;

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
