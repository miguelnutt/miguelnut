import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar ranking de sequências ativas (top 10)
    const { data: rankings, error: rankingsError } = await supabase
      .from('user_daily_logins')
      .select(`
        user_id,
        dia_atual,
        ultimo_login,
        profiles!inner(nome, twitch_username)
      `)
      .gt('dia_atual', 0)
      .order('dia_atual', { ascending: false })
      .order('ultimo_login', { ascending: true })
      .limit(10);

    if (rankingsError) {
      console.error('Erro ao buscar ranking:', rankingsError);
      throw rankingsError;
    }

    // Formatar dados
    const formattedRankings = (rankings || []).map((item: any, index: number) => {
      const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      
      // Formatar data do último resgate em Brasília
      const ultimoResgateDate = new Date(item.ultimo_login + 'T00:00:00-03:00');
      const ultimoResgate = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(ultimoResgateDate);

      return {
        posicao: index + 1,
        user_id: item.user_id,
        nome: profile?.nome || 'Desconhecido',
        twitch_username: profile?.twitch_username,
        dias_consecutivos: item.dia_atual,
        ultimo_resgate: ultimoResgate
      };
    });

    return new Response(
      JSON.stringify({ rankings: formattedRankings }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro ao buscar ranking de sequências:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
