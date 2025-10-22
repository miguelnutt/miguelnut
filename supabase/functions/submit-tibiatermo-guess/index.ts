import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`[${requestId}] JWT ausente`);
      return new Response(JSON.stringify({ error: 'Não autorizado - JWT ausente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    console.log(`[${requestId}] Validando Twitch token...`);
    
    // Validate Twitch token
    const twitchMeResponse = await fetch(
      `${supabaseUrl}/functions/v1/twitch-auth-me`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[${requestId}] Twitch auth response:`, twitchMeResponse.status);
    
    const twitchData = await twitchMeResponse.json();
    
    if (!twitchData.success || !twitchData.user) {
      console.error(`[${requestId}] Twitch auth failed:`, twitchData);
      return new Response(JSON.stringify({ error: 'Usuário não autenticado', details: twitchData }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const twitchUserId = twitchData.user.twitch_user_id;
    const twitchUsername = twitchData.user.login;
    const displayName = twitchData.user.display_name;

    console.log(`[${requestId}] Twitch user:`, { twitchUserId, twitchUsername });

    // Get or merge profile using canonical identity (twitch_user_id)
    const { data: profileId, error: profileError } = await supabase.rpc('get_or_merge_profile_v2', {
      p_twitch_user_id: twitchUserId,
      p_display_name: displayName,
      p_login: twitchUsername,
      p_nome_personagem: null,
    });

    if (profileError || !profileId) {
      console.error(`[${requestId}] Erro ao obter perfil:`, profileError);
      return new Response(JSON.stringify({ error: 'Erro ao identificar usuário' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] Profile ID:`, profileId);

    const profile = { id: profileId };

    const { tentativa, jogo_id } = await req.json();

    console.log(`[${requestId}] Tentativa recebida:`, { jogo_id, tentativa_length: tentativa?.length });

    // Get current game
    const { data: game, error: gameError } = await supabase
      .from('tibiatermo_user_games')
      .select('*')
      .eq('id', jogo_id)
      .eq('user_id', profile.id)
      .single();

    if (gameError || !game) {
      console.error(`[${requestId}] Jogo não encontrado:`, gameError);
      return new Response(JSON.stringify({ error: 'Jogo não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (game.acertou !== null) {
      return new Response(JSON.stringify({ error: 'Jogo já finalizado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tentativasAtuais = game.tentativas as string[];
    if (tentativasAtuais.length >= 6) {
      return new Response(JSON.stringify({ error: 'Número máximo de tentativas atingido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add new attempt (aceita qualquer palavra)
    const novasTentativas = [...tentativasAtuais, tentativa.toUpperCase()];
    const acertou = tentativa.toUpperCase() === game.palavra_dia;
    const numTentativas = novasTentativas.length;
    const jogoFinalizado = acertou || numTentativas >= 6;

    let premiacao_pontos = 0;
    let premiacao_tickets = 0;

    // Award prizes if won - buscar configuração por tentativa
    if (acertou) {
      const { data: rewardConfig, error: rewardError } = await supabase
        .from('tibiatermo_rewards_by_attempt')
        .select('*')
        .eq('tentativa', numTentativas)
        .eq('ativa', true)
        .maybeSingle();

      if (rewardError) {
        console.error('Error fetching reward config:', rewardError);
      } else if (rewardConfig) {
        premiacao_pontos = rewardConfig.pontos_loja;
        premiacao_tickets = rewardConfig.tickets;
        console.log(`Recompensas para ${numTentativas} tentativas: ${premiacao_pontos} pontos, ${premiacao_tickets} tickets`);
      } else {
        console.log(`Nenhuma recompensa configurada para ${numTentativas} tentativas`);
      }
    }

    // Update game
    const updateData: any = {
      tentativas: novasTentativas,
      num_tentativas: numTentativas,
    };

    if (jogoFinalizado) {
      updateData.acertou = acertou;
      updateData.premiacao_pontos = premiacao_pontos;
      updateData.premiacao_tickets = premiacao_tickets;
    }

    const { error: updateError } = await supabase
      .from('tibiatermo_user_games')
      .update(updateData)
      .eq('id', jogo_id);

    if (updateError) {
      console.error('Error updating game:', updateError);
      return new Response(JSON.stringify({ error: 'Erro ao atualizar jogo' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Award prizes if game is won
    if (acertou) {
      // Award store points via StreamElements usando função centralizada
      if (premiacao_pontos > 0) {
        try {
          console.log(`Creditando ${premiacao_pontos} pontos para ${twitchUsername} via sync-streamelements-points`);
          
          const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-streamelements-points', {
            body: {
              username: twitchUsername,
              points: premiacao_pontos,
              tipo_operacao: 'tibiatermo',
              referencia_id: jogo_id,
              user_id: profile.id
            }
          });

          if (syncError) {
            console.error('Erro ao sincronizar com StreamElements:', syncError);
          } else {
            console.log(`Pontos creditados e verificados com sucesso via sync:`, syncData);
            
            // Registrar no histórico do TibiaTermo apenas se sucesso
            await supabase
              .from('tibiatermo_history')
              .insert({
                user_id: profile.id,
                nome_usuario: twitchUsername,
                tipo_recompensa: 'Pontos de Loja',
                valor: premiacao_pontos,
                num_tentativas: numTentativas,
              });
          }
        } catch (error) {
          console.error('Error awarding StreamElements points:', error);
        }
      }

      // Award tickets via unified service
      if (premiacao_tickets > 0) {
        try {
          const idempotencyKey = `tibiatermo-${game.id}-tickets`;
          
          const { data: awardData, error: awardError } = await supabase.functions.invoke('award-reward', {
            body: {
              userId: profile.id,
              type: 'tickets',
              value: premiacao_tickets,
              source: 'tibiatermo',
              idempotencyKey,
              reason: `TibiaTermo - Acertou em ${numTentativas} tentativa${numTentativas > 1 ? 's' : ''}`
            }
          });

          if (awardError) {
            console.error('Error awarding tickets via award-reward:', awardError);
          } else {
            console.log(`Tickets awarded via unified service:`, awardData);
          }

          // Registrar no histórico do TibiaTermo
          await supabase
            .from('tibiatermo_history')
            .insert({
              user_id: profile.id,
              nome_usuario: twitchUsername,
              tipo_recompensa: 'Tickets',
              valor: premiacao_tickets,
              num_tentativas: numTentativas,
            });
        } catch (error) {
          console.error('Error awarding tickets:', error);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Tentativa processada`, {
      acertou,
      num_tentativas: numTentativas,
      jogo_finalizado: jogoFinalizado,
      premiacao_pontos,
      premiacao_tickets,
      duration_ms: duration
    });

    return new Response(JSON.stringify({ 
      success: true,
      tentativas: novasTentativas,
      acertou,
      num_tentativas: numTentativas,
      jogo_finalizado: jogoFinalizado,
      palavra: jogoFinalizado ? game.palavra_dia : null,
      premiacao_pontos,
      premiacao_tickets,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error in submit-tibiatermo-guess:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});