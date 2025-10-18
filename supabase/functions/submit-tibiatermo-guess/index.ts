import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

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
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    console.log('Validating Twitch token...');
    
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

    console.log('Twitch auth response status:', twitchMeResponse.status);
    
    const twitchData = await twitchMeResponse.json();
    console.log('Twitch auth data:', JSON.stringify(twitchData));
    
    if (!twitchData.success || !twitchData.user) {
      console.error('Twitch auth failed:', twitchData);
      return new Response(JSON.stringify({ error: 'Usuário não encontrado', details: twitchData }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const twitchUsername = twitchData.user.login;

    // Get profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('twitch_username', twitchUsername)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tentativa, jogo_id } = await req.json();

    // Get current game
    const { data: game, error: gameError } = await supabase
      .from('tibiatermo_user_games')
      .select('*')
      .eq('id', jogo_id)
      .eq('user_id', profile.id)
      .single();

    if (gameError || !game) {
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

    // Validate word exists in dictionary
    const { data: validWord } = await supabase
      .from('tibiatermo_words')
      .select('palavra')
      .eq('palavra', tentativa.toUpperCase())
      .eq('ativa', true)
      .maybeSingle();

    if (!validWord) {
      return new Response(JSON.stringify({ 
        error: 'Palavra inválida',
        invalid_word: true
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add new attempt
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
      // Award store points via StreamElements
      if (premiacao_pontos > 0) {
        const streamElementsJwt = Deno.env.get('STREAMELEMENTS_JWT_TOKEN');
        const channelId = Deno.env.get('STREAMELEMENTS_CHANNEL_ID');

        if (streamElementsJwt && channelId) {
          try {
            const seResponse = await fetch(
              `https://api.streamelements.com/kappa/v2/points/${channelId}/${twitchUsername}/${premiacao_pontos}`,
              {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${streamElementsJwt}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (!seResponse.ok) {
              console.error('StreamElements error:', await seResponse.text());
            } else {
              console.log(`Awarded ${premiacao_pontos} points to ${twitchUsername}`);
              
              // Registrar no histórico (tabela spins)
              await supabase
                .from('spins')
                .insert({
                  user_id: profile.id,
                  nome_usuario: twitchUsername,
                  tipo_recompensa: 'Pontos de Loja',
                  valor: premiacao_pontos.toString(),
                  wheel_id: null, // TibiaTermo não tem wheel_id
                });
            }
          } catch (error) {
            console.error('Error awarding StreamElements points:', error);
          }
        }
      }

      // Award tickets
      if (premiacao_tickets > 0) {
        const { data: currentTickets } = await supabase
          .from('tickets')
          .select('tickets_atual')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (currentTickets) {
          await supabase
            .from('tickets')
            .update({ tickets_atual: currentTickets.tickets_atual + premiacao_tickets })
            .eq('user_id', profile.id);
        } else {
          await supabase
            .from('tickets')
            .insert({ user_id: profile.id, tickets_atual: premiacao_tickets });
        }

        await supabase
          .from('ticket_ledger')
          .insert({
            user_id: profile.id,
            variacao: premiacao_tickets,
            motivo: `TibiaTermo - Acertou em ${numTentativas} tentativa${numTentativas > 1 ? 's' : ''}`,
          });

        // Registrar no histórico (tabela spins)
        await supabase
          .from('spins')
          .insert({
            user_id: profile.id,
            nome_usuario: twitchUsername,
            tipo_recompensa: 'Tickets',
            valor: premiacao_tickets.toString(),
            wheel_id: null, // TibiaTermo não tem wheel_id
          });
      }
    }

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
    console.error('Error in submit-tibiatermo-guess:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});