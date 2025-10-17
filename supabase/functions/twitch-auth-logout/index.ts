import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function getCorsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Invalidar cookie
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json');
    headers.append('Set-Cookie', 'twitch_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');

    return new Response(
      JSON.stringify({ success: true, message: 'Logged out' }),
      { headers }
    );

  } catch (error) {
    console.error('Logout error:', error);
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
