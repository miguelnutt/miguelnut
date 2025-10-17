import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

function getCorsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-super-secret-jwt-key-change-this';

async function generateJWT(payload: any) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return await create({ alg: "HS256", typ: "JWT" }, payload, key);
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, code_verifier, redirect_uri } = await req.json();
    
    const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID');
    const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET');
    
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      throw new Error('Twitch credentials not configured');
    }

    console.log('Exchanging code for token...');
    console.log('Redirect URI:', redirect_uri);

    // 1. Trocar código por access_token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirect_uri,
        code_verifier: code_verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Twitch token error:', errorText);
      throw new Error(`Failed to get Twitch access token: ${errorText}`);
    }

    const tokens = await tokenResponse.json();
    console.log('Tokens received');

    // 2. Buscar dados do usuário da Twitch
    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Client-Id': TWITCH_CLIENT_ID,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('Twitch user error:', errorText);
      throw new Error('Failed to get Twitch user data');
    }

    const { data: twitchUsers } = await userResponse.json();
    const twitchUser = twitchUsers[0];

    if (!twitchUser) {
      throw new Error('No Twitch user found');
    }

    console.log('User authenticated:', twitchUser.login);

    // 3. Criar/atualizar perfil no Supabase
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Verificar se já existe perfil com este twitch_username
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('twitch_username', twitchUser.login)
          .maybeSingle();

        if (!existingProfile) {
          // Criar novo perfil
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: crypto.randomUUID(),
              nome: twitchUser.display_name,
              twitch_username: twitchUser.login,
            });

          if (profileError) {
            console.error('Error creating profile:', profileError);
          } else {
            console.log('Profile created for:', twitchUser.login);
          }
        } else {
          console.log('Profile already exists for:', twitchUser.login);
        }
      } catch (error) {
        console.error('Error managing profile:', error);
      }
    }

    // 4. Criar JWT de sessão
    const sessionPayload = {
      twitch_user_id: twitchUser.id,
      login: twitchUser.login,
      display_name: twitchUser.display_name,
      profile_image_url: twitchUser.profile_image_url,
      email: twitchUser.email,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 dias
    };

    const sessionToken = await generateJWT(sessionPayload);

    // 5. Retornar token no response (não usar cookie cross-domain)
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json');

    return new Response(
      JSON.stringify({
        success: true,
        token: sessionToken, // Enviar token no response
        user: {
          twitch_user_id: twitchUser.id,
          login: twitchUser.login,
          display_name: twitchUser.display_name,
          profile_image_url: twitchUser.profile_image_url,
          email: twitchUser.email,
        }
      }),
      { headers }
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
