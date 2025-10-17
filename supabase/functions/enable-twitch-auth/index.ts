import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID');
    const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET');
    const PROJECT_REF = SUPABASE_URL?.split('//')[1]?.split('.')[0];

    if (!PROJECT_REF || !SERVICE_ROLE_KEY || !TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      throw new Error('Missing required environment variables');
    }

    console.log('Enabling Twitch provider for project:', PROJECT_REF);

    // Habilitar o provider Twitch via Management API
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          EXTERNAL_TWITCH_ENABLED: true,
          EXTERNAL_TWITCH_CLIENT_ID: TWITCH_CLIENT_ID,
          EXTERNAL_TWITCH_SECRET: TWITCH_CLIENT_SECRET,
          EXTERNAL_TWITCH_REDIRECT_URI: `${SUPABASE_URL}/auth/v1/callback`,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase Management API error:', response.status, errorText);
      throw new Error(`Failed to enable Twitch provider: ${response.status}`);
    }

    const result = await response.json();
    console.log('Twitch provider enabled successfully:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Twitch authentication enabled successfully',
        config: result 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error enabling Twitch auth:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
