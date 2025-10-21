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
    // Validar Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[get-streamelements-points] Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Token de autenticação obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const body = await req.json();
    console.log('[get-streamelements-points] Request body:', JSON.stringify(body));
    
    const { username } = body;

    if (!username) {
      console.error('[get-streamelements-points] Missing username parameter');
      return new Response(
        JSON.stringify({ error: 'MISSING_USERNAME', message: 'Username é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!JWT_TOKEN || !CHANNEL_ID) {
      console.error('[get-streamelements-points] StreamElements credentials not configured');
      return new Response(
        JSON.stringify({ error: 'SE_ENV_MISSING', message: 'Credenciais do StreamElements não configuradas', points: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`[get-streamelements-points] Fetching points for username: ${username}`);
    
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
      const errorText = await response.text();
      console.error(`[get-streamelements-points] StreamElements API error: ${response.status} - ${errorText}`);
      
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: 'USER_NOT_FOUND', message: 'Usuário não encontrado no StreamElements', points: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'SE_UNAVAILABLE', message: 'Falha ao consultar StreamElements', points: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const data = await response.json();
    const points = data.points || 0;
    
    console.log(`[get-streamelements-points] Success - Username: ${username}, Points: ${points}`);

    return new Response(
      JSON.stringify({ points }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[get-streamelements-points] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: errorMessage, points: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
