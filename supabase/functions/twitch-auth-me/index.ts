import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

function getCorsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
    'Access-Control-Allow-Credentials': 'true',
  };
}

const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-super-secret-jwt-key-change-this';

async function verifyJWT(token: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  return await verify(token, key);
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Pegar token do header Authorization
    const authHeader = req.headers.get('authorization') || '';
    const tokenMatch = authHeader.match(/Bearer (.+)/);
    
    if (!tokenMatch) {
      console.error('[twitch-auth-me] Missing authorization token');
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    const sessionToken = tokenMatch[1];
    const payload = await verifyJWT(sessionToken);

    // Validar campos obrigatórios
    if (!payload.twitch_user_id || !payload.login) {
      console.error('[twitch-auth-me] Missing required fields in token', { payload });
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token payload' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    // Normalizar identificadores Twitch
    const twitchUserId = String(payload.twitch_user_id).trim();
    const twitchLogin = String(payload.login).toLowerCase().trim();
    const twitchDisplayName = payload.display_name ? String(payload.display_name).trim() : twitchLogin;

    // Validar formato do twitch_user_id (deve ser numérico)
    if (!/^\d+$/.test(twitchUserId)) {
      console.error('[twitch-auth-me] Invalid twitch_user_id format', { twitchUserId });
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user identifier' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    console.log('[twitch-auth-me] Session validated', { 
      twitchUserId, 
      twitchLogin,
      profile_id: payload.profile_id 
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          twitch_user_id: twitchUserId,
          login: twitchLogin,
          display_name: twitchDisplayName,
          profile_image_url: payload.profile_image_url,
          email: payload.email,
          profile_id: payload.profile_id,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[twitch-auth-me] Auth verification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid session' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401 
      }
    );
  }
});
