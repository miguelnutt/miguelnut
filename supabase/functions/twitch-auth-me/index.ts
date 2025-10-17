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
    // Extrair cookie da requisição
    const cookies = req.headers.get('cookie') || '';
    const sessionMatch = cookies.match(/twitch_session=([^;]+)/);
    
    if (!sessionMatch) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    const sessionToken = sessionMatch[1];
    const payload = await verifyJWT(sessionToken);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          twitch_user_id: payload.twitch_user_id,
          login: payload.login,
          display_name: payload.display_name,
          profile_image_url: payload.profile_image_url,
          email: payload.email,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Auth verification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid session' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401 
      }
    );
  }
});
