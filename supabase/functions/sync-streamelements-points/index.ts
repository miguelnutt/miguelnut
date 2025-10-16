import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const STREAMELEMENTS_JWT = Deno.env.get('STREAMELEMENTS_JWT_TOKEN');
const CHANNEL_ID = Deno.env.get('STREAMELEMENTS_CHANNEL_ID');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  username: string;
  points: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, points }: SyncRequest = await req.json();
    
    console.log(`Syncing ${points} points to StreamElements for user: ${username}`);

    if (!STREAMELEMENTS_JWT || !CHANNEL_ID) {
      console.error('StreamElements credentials not configured');
      return new Response(
        JSON.stringify({ error: 'StreamElements credentials not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Add points to StreamElements
    const response = await fetch(
      `https://api.streamelements.com/kappa/v2/points/${CHANNEL_ID}/${username}/${points}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${STREAMELEMENTS_JWT}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('StreamElements API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to sync with StreamElements',
          details: errorText 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('StreamElements sync successful:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${points} points added to ${username} on StreamElements`,
        data 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in sync-streamelements-points:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
