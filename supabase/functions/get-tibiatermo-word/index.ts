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

    // Get authenticated user via Twitch token
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

    console.log(`[${requestId}] Twitch auth response:`, twitchMeResponse.status);
    
    const twitchData = await twitchMeResponse.json();
    
    if (!twitchData.success || !twitchData.user) {
      console.error(`[${requestId}] Twitch auth failed:`, twitchData);
      return new Response(JSON.stringify({ error: 'Usuário não autenticado', details: twitchData }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const twitchUserId = twitchData.user.id;
    const twitchUsername = twitchData.user.login;
    const displayName = twitchData.user.display_name;

    console.log(`[${requestId}] Twitch user:`, { twitchUserId, twitchUsername, displayName });

    // Get or merge profile using canonical identity (twitch_user_id)
    const { data: profileId, error: profileError } = await supabase.rpc('get_or_merge_profile_v2', {
      p_twitch_user_id: twitchUserId,
      p_display_name: displayName,
      p_login: twitchUsername,
    });

    if (profileError || !profileId) {
      console.error(`[${requestId}] Erro ao obter perfil:`, profileError);
      return new Response(JSON.stringify({ error: 'Erro ao identificar usuário' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] Profile ID:`, profileId);

    // Get current date in Brasília timezone
    const now = new Date();
    const brasiliaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const dateStr = brasiliaDate.toISOString().split('T')[0];

    console.log(`[${requestId}] Data Brasília:`, dateStr);

    // Check if user already has a word for today (idempotência)
    const { data: existingGame } = await supabase
      .from('tibiatermo_user_games')
      .select('*')
      .eq('user_id', profileId)
      .eq('data_jogo', dateStr)
      .maybeSingle();

    if (existingGame) {
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] Jogo existente encontrado`, { 
        palavra_length: existingGame.palavra_dia.length,
        tentativas: existingGame.tentativas.length,
        acertou: existingGame.acertou,
        duration_ms: duration
      });
      
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
      console.error(`[${requestId}] Nenhuma palavra ativa`);
      return new Response(JSON.stringify({ error: 'Nenhuma palavra ativa disponível' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] Palavras ativas:`, activeWords.length);

    // Select word deterministically by user+date (seed-based)
    // Isso garante que o mesmo usuário recebe a mesma palavra no mesmo dia
    const seed = `${profileId}-${dateStr}`;
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(seed)
    );
    const hashArray = Array.from(new Uint8Array(hash));
    const hashNum = hashArray.reduce((acc, byte) => acc + byte, 0);
    const wordIndex = hashNum % activeWords.length;
    const selectedWord = activeWords[wordIndex].palavra;

    console.log(`[${requestId}] Palavra selecionada:`, {
      palavra_length: selectedWord.length,
      seed,
      wordIndex,
      totalWords: activeWords.length
    });

    // Create new game for today
    const { data: newGame, error: insertError } = await supabase
      .from('tibiatermo_user_games')
      .insert({
        user_id: profileId,
        palavra_dia: selectedWord,
        data_jogo: dateStr,
        tentativas: [],
        acertou: null,
        num_tentativas: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[${requestId}] Error inserting game:`, insertError);
      return new Response(JSON.stringify({ error: 'Erro ao criar jogo' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Novo jogo criado`, { 
      jogo_id: newGame.id,
      palavra_length: selectedWord.length,
      duration_ms: duration
    });

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
    console.error(`[${requestId}] Error in get-tibiatermo-word:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});