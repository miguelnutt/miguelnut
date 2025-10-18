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
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tentativa, jogo_id } = await req.json();

    // Get current game
    const { data: game, error: gameError } = await supabase
      .from('tibiadle_user_games')
      .select('*')
      .eq('id', jogo_id)
      .eq('user_id', user.id)
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

    // Add new attempt
    const novasTentativas = [...tentativasAtuais, tentativa.toUpperCase()];
    const acertou = tentativa.toUpperCase() === game.palavra_dia;
    const numTentativas = novasTentativas.length;
    const jogoFinalizado = acertou || numTentativas >= 6;

    let premiacao_pontos = 0;
    let premiacao_tickets = 0;

    // Award prizes if won
    if (acertou) {
      premiacao_pontos = 25;
      if (numTentativas <= 4) {
        premiacao_tickets = 1;
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
      .from('tibiadle_user_games')
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
      // Get user's Twitch username
      const { data: profile } = await supabase
        .from('profiles')
        .select('twitch_username')
        .eq('id', user.id)
        .single();

      // Award store points via StreamElements
      if (premiacao_pontos > 0 && profile?.twitch_username) {
        const streamElementsJwt = Deno.env.get('STREAMELEMENTS_JWT_TOKEN');
        const channelId = Deno.env.get('STREAMELEMENTS_CHANNEL_ID');

        if (streamElementsJwt && channelId) {
          try {
            const seResponse = await fetch(
              `https://api.streamelements.com/kappa/v2/points/${channelId}/${profile.twitch_username}/${premiacao_pontos}`,
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
              console.log(`Awarded ${premiacao_pontos} points to ${profile.twitch_username}`);
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
          .eq('user_id', user.id)
          .maybeSingle();

        if (currentTickets) {
          await supabase
            .from('tickets')
            .update({ tickets_atual: currentTickets.tickets_atual + premiacao_tickets })
            .eq('user_id', user.id);
        } else {
          await supabase
            .from('tickets')
            .insert({ user_id: user.id, tickets_atual: premiacao_tickets });
        }

        await supabase
          .from('ticket_ledger')
          .insert({
            user_id: user.id,
            variacao: premiacao_tickets,
            motivo: 'TibiaDle - Acertou em 4 tentativas ou menos',
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
    console.error('Error in submit-tibiadle-guess:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});