import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    
    const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID');
    const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      throw new Error('Twitch credentials not configured');
    }

    // 1. Trocar o código por access token
    const redirectUri = `${new URL(req.url).origin}/login`;
    
    console.log('Usando redirect_uri:', redirectUri);
    console.log('Client ID:', TWITCH_CLIENT_ID);
    
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Twitch token error:', errorText);
      console.error('Redirect URI usado:', redirectUri);
      throw new Error(`Failed to get Twitch access token: ${errorText}`);
    }

    const { access_token } = await tokenResponse.json();

    // 2. Buscar dados do usuário da Twitch
    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Client-Id': TWITCH_CLIENT_ID,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get Twitch user data');
    }

    const { data: twitchUsers } = await userResponse.json();
    const twitchUser = twitchUsers[0];

    if (!twitchUser) {
      throw new Error('No Twitch user found');
    }

    // 3. Criar ou buscar usuário no Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Buscar se já existe um perfil com esse twitch_username
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('twitch_username', twitchUser.login)
      .maybeSingle();

    let userId: string;

    if (existingProfile) {
      // Usuário já existe
      userId = existingProfile.id;
    } else {
      // Criar novo usuário
      const { data: newUser, error: signUpError } = await supabase.auth.admin.createUser({
        email: `${twitchUser.login}@twitch.local`,
        email_confirm: true,
        user_metadata: {
          twitch_username: twitchUser.login,
          twitch_display_name: twitchUser.display_name,
          twitch_id: twitchUser.id,
        }
      });

      if (signUpError) throw signUpError;
      userId = newUser.user.id;

      // Criar perfil
      await supabase
        .from('profiles')
        .insert({
          id: userId,
          nome: twitchUser.display_name || twitchUser.login,
          twitch_username: twitchUser.login,
        });
    }

    // 4. Gerar token de sessão para o usuário
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: `${twitchUser.login}@twitch.local`,
    });

    if (sessionError) throw sessionError;

    return new Response(
      JSON.stringify({
        success: true,
        access_token: sessionData.properties.action_link.split('#access_token=')[1]?.split('&')[0],
        refresh_token: sessionData.properties.action_link.split('&refresh_token=')[1]?.split('&')[0],
        user: {
          id: userId,
          twitch_username: twitchUser.login,
          display_name: twitchUser.display_name,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Twitch OAuth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
