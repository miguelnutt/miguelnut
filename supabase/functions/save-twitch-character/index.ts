import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Pegar token da Twitch do header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Token não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twitchToken = authHeader.replace('Bearer ', '');

    // Validar token com a API da Twitch
    const twitchResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${twitchToken}`,
        'Client-Id': Deno.env.get('TWITCH_CLIENT_ID')!,
      },
    });

    if (!twitchResponse.ok) {
      console.error('Twitch validation failed:', await twitchResponse.text());
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twitchData = await twitchResponse.json();
    const twitchUser = twitchData.data[0];

    if (!twitchUser) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pegar nome do personagem do body
    const { nome_personagem } = await req.json();

    if (!nome_personagem || !nome_personagem.trim()) {
      return new Response(
        JSON.stringify({ error: 'Nome do personagem não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Salvando personagem:', {
      twitch_username: twitchUser.login,
      nome_personagem: nome_personagem.trim()
    });

    // Buscar perfil existente
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('twitch_username', twitchUser.login)
      .maybeSingle();

    if (existingProfile) {
      // Atualizar perfil existente
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ nome_personagem: nome_personagem.trim() })
        .eq('id', existingProfile.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      console.log('Perfil atualizado com sucesso');
    } else {
      // Criar novo perfil
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          nome: twitchUser.display_name,
          twitch_username: twitchUser.login,
          nome_personagem: nome_personagem.trim()
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      console.log('Perfil criado com sucesso');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        nome_personagem: nome_personagem.trim()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});