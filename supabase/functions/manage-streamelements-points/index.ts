import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, points, action } = await req.json();

    if (!username || !points || !action) {
      return new Response(
        JSON.stringify({ error: "Parâmetros inválidos" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const seToken = Deno.env.get('STREAMELEMENTS_JWT_TOKEN');
    const seChannelId = Deno.env.get('STREAMELEMENTS_CHANNEL_ID');

    if (!seToken || !seChannelId) {
      return new Response(
        JSON.stringify({ error: "StreamElements não configurado" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adicionar ou remover pontos
    const finalPoints = action === 'add' ? points : -points;

    const response = await fetch(
      `https://api.streamelements.com/kappa/v2/points/${seChannelId}/${username}/${finalPoints}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${seToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('StreamElements error:', error);
      throw new Error('Erro ao modificar pontos no StreamElements');
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${action === 'add' ? 'Adicionado' : 'Removido'} ${points} pontos`,
        newBalance: data.newAmount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
