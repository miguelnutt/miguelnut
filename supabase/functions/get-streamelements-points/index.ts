import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const JWT_TOKEN = Deno.env.get('STREAMELEMENTS_JWT_TOKEN');
const CHANNEL_ID = Deno.env.get('STREAMELEMENTS_CHANNEL_ID');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GetPointsRequest {
  username: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { username }: GetPointsRequest = await req.json();

    if (!username) {
      return new Response(
        JSON.stringify({ error: 'Username is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!JWT_TOKEN || !CHANNEL_ID) {
      console.error('StreamElements credentials not configured');
      return new Response(
        JSON.stringify({ error: 'StreamElements credentials not configured', points: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Buscar pontos do usuário no StreamElements
    const response = await fetch(
      `https://api.streamelements.com/kappa/v2/points/${CHANNEL_ID}/${username}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('StreamElements API error:', response.status);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch points', points: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const data = await response.json();
    const points = data.points || 0;

    return new Response(
      JSON.stringify({ points }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in get-streamelements-points:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, points: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
