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

    console.log(`[${new Date().toISOString()}] Iniciando resgate para userId: ${userId}`);

    // Pegar data atual no horário de Brasília usando Intl.DateTimeFormat
    const hoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    console.log(`Data atual (Brasília): ${hoje}`);

    // Buscar registro de login do usuário
    const { data: loginData, error: loginError } = await supabase
      .from('user_daily_logins')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (loginError && loginError.code !== 'PGRST116') {
      console.error('Erro ao buscar login:', loginError);
      throw loginError;
    }

    console.log('Dados de login encontrados:', loginData);

    let diaAtual = 1;

    // VALIDAÇÃO CRÍTICA: Verificar se já resgatou hoje
    if (loginData) {
      const ultimoLogin = loginData.ultimo_login; // já está em formato YYYY-MM-DD
      
      console.log(`Último login: ${ultimoLogin}, Dia atual: ${loginData.dia_atual}`);
      
      // Se já resgatou hoje, bloquear
      if (ultimoLogin === hoje) {
        console.log('BLOQUEADO: Usuário já resgatou hoje');
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

      console.log(`Diferença de dias: ${diffDays}`);

      if (diffDays === 1) {
        // Login consecutivo - avançar dia
        diaAtual = loginData.dia_atual >= 30 ? 1 : loginData.dia_atual + 1;
        console.log(`Login consecutivo detectado. Novo dia: ${diaAtual}`);
      } else {
        // Perdeu consecutivo - resetar para dia 1
        diaAtual = 1;
        console.log(`Streak perdido. Resetando para dia 1`);
      }
    } else {
      console.log('Primeiro resgate do usuário');
    }

    // Calcular pontos baseado na sequência
    let pontos = 25;
    
    // Verificar se há recompensa especial configurada para este dia da sequência
    const { data: specialReward } = await supabase
      .from('daily_reward_special_config')
      .select('pontos')
      .eq('dia_sequencia', diaAtual)
      .maybeSingle();
    
    if (specialReward) {
      pontos = specialReward.pontos;
      console.log(`Recompensa especial aplicada: ${pontos} pontos`);
    } else if (diaAtual % 5 === 0) {
      pontos = 50;
      console.log(`Múltiplo de 5 detectado: ${pontos} pontos`);
    } else {
      console.log(`Recompensa padrão: ${pontos} pontos`);
    }

    // ATUALIZAÇÃO ATÔMICA: Usar upsert com validação adicional
    console.log(`Atualizando registro com dia_atual=${diaAtual}, ultimo_login=${hoje}`);
    
    const { data: updatedLogin, error: upsertError } = await supabase
      .from('user_daily_logins')
      .upsert({
        user_id: userId,
        dia_atual: diaAtual,
        ultimo_login: hoje,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Erro ao atualizar login:', upsertError);
      throw upsertError;
    }

    console.log('Login atualizado com sucesso:', updatedLogin);

    // Registrar no histórico
    const { error: historyError } = await supabase
      .from('daily_rewards_history')
      .insert({
        user_id: userId,
        dia: diaAtual,
        pontos: pontos,
      });

    if (historyError) {
      console.error('Erro ao inserir histórico:', historyError);
      throw historyError;
    }

    console.log('Histórico registrado com sucesso');

    // Buscar perfil do usuário para pegar o username da Twitch
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('twitch_username')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);
      throw profileError;
    }

    if (!profile || !profile.twitch_username) {
      console.log('Usuário não possui username da Twitch vinculado');
      return new Response(
        JSON.stringify({ error: 'Usuário não possui username da Twitch vinculado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Creditar pontos na StreamElements usando função centralizada
    console.log(`Creditando ${pontos} pontos para ${profile.twitch_username} via sync`);

    try {
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-streamelements-points', {
        body: {
          username: profile.twitch_username,
          points: pontos,
          tipo_operacao: 'daily_reward',
          referencia_id: userId,
          user_id: userId
        }
      });

      if (syncError) {
        console.error('Erro ao sincronizar com StreamElements:', syncError);
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

      console.log('Pontos creditados e verificados com sucesso:', syncData);

      return new Response(
        JSON.stringify({ 
          success: true, 
          diaAtual,
          pontos,
          message: `${pontos} pontos creditados com sucesso!`,
          syncResult: syncData
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (seError: any) {
      console.error('Erro crítico ao sincronizar pontos:', seError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          diaAtual,
          pontos,
          warning: 'Recompensa registrada mas falha na sincronização'
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