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

    // Get authenticated user via Twitch token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    console.log('Validating Twitch token...');
    
    // Validate Twitch token and get user
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

    // Get current date in Brasília timezone
    const now = new Date();
    const brasiliaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const dateStr = brasiliaDate.toISOString().split('T')[0];

    console.log('Checking word for user:', profile.id, 'date:', dateStr);

    // Check if user already has a word for today
    const { data: existingGame } = await supabase
      .from('tibiatermo_user_games')
      .select('*')
      .eq('user_id', profile.id)
      .eq('data_jogo', dateStr)
      .maybeSingle();

    if (existingGame) {
      console.log('Found existing game:', existingGame);
      return new Response(JSON.stringify({ 
        palavra: existingGame.palavra_dia,
        tentativas: existingGame.tentativas,
        acertou: existingGame.acertou,
        num_tentativas: existingGame.num_tentativas,
        jogo_id: existingGame.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all active words
    const { data: activeWords, error: wordsError } = await supabase
      .from('tibiatermo_words')
      .select('palavra')
      .eq('ativa', true);

    if (wordsError || !activeWords || activeWords.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma palavra ativa disponível' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Select random word
    const randomIndex = Math.floor(Math.random() * activeWords.length);
    const selectedWord = activeWords[randomIndex].palavra;

    console.log('Selected word:', selectedWord, 'for user:', profile.id);

    // Create new game for today
    const { data: newGame, error: insertError } = await supabase
      .from('tibiatermo_user_games')
      .insert({
        user_id: profile.id,
        palavra_dia: selectedWord,
        data_jogo: dateStr,
        tentativas: [],
        acertou: null,
        num_tentativas: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting game:', insertError);
      return new Response(JSON.stringify({ error: 'Erro ao criar jogo' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      palavra: selectedWord,
      tentativas: [],
      acertou: null,
      num_tentativas: null,
      jogo_id: newGame.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in get-tibiatermo-word:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});