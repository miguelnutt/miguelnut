import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
  'Access-Control-Allow-Credentials': 'true',
};

const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-super-secret-jwt-key-change-this';
const STREAMELEMENTS_JWT = Deno.env.get('STREAMELEMENTS_JWT_TOKEN');
const STREAMELEMENTS_CHANNEL_ID = Deno.env.get('STREAMELEMENTS_CHANNEL_ID');
const LOYALTY_API_BASE = Deno.env.get('LOYALTY_API_BASE');
const LOYALTY_API_KEY = Deno.env.get('LOYALTY_API_KEY');

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

async function getBalanceFromStreamElements(twitchLogin: string): Promise<number> {
  if (!STREAMELEMENTS_JWT || !STREAMELEMENTS_CHANNEL_ID) {
    throw new Error('StreamElements credentials not configured');
  }

  console.log(`Fetching StreamElements balance for ${twitchLogin}`);

  const response = await fetch(
    `https://api.streamelements.com/kappa/v2/points/${STREAMELEMENTS_CHANNEL_ID}/${twitchLogin}`,
    {
      headers: {
        'Authorization': `Bearer ${STREAMELEMENTS_JWT}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('StreamElements API error:', errorText);
    throw new Error(`StreamElements API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('StreamElements response:', data);
  
  return data.points || 0;
}

async function getBalanceFromGenericAPI(twitchLogin: string): Promise<number> {
  if (!LOYALTY_API_BASE || !LOYALTY_API_KEY) {
    throw new Error('Generic loyalty API credentials not configured');
  }

  console.log(`Fetching balance from generic API for ${twitchLogin}`);

  const url = `${LOYALTY_API_BASE}/balance?twitch_login=${encodeURIComponent(twitchLogin)}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${LOYALTY_API_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Generic API error:', errorText);
    throw new Error(`Generic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.balance || 0;
}

async function getBalance(twitchLogin: string): Promise<number> {
  // Prioridade: StreamElements > Generic REST API
  if (STREAMELEMENTS_JWT && STREAMELEMENTS_CHANNEL_ID) {
    console.log('Using StreamElements adapter');
    return await getBalanceFromStreamElements(twitchLogin);
  } else if (LOYALTY_API_BASE && LOYALTY_API_KEY) {
    console.log('Using Generic REST adapter');
    return await getBalanceFromGenericAPI(twitchLogin);
  } else {
    throw new Error('No loyalty provider configured. Please set StreamElements or Generic API credentials.');
  }
}

serve(async (req) => {
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

    // Obter twitch_login do JWT ou query parameter
    const url = new URL(req.url);
    const twitchLogin = url.searchParams.get('twitch_login') || payload.login;

    if (!twitchLogin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Twitch login not provided' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const balance = await getBalance(twitchLogin as string);

    return new Response(
      JSON.stringify({
        success: true,
        balance,
        twitch_login: twitchLogin,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Balance fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        balance: 0,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
