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

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');

    // Data atual em Brasília
    const hoje = dateParam || new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    // Buscar resgates do dia
    const { data: rewards, error: rewardsError } = await supabase
      .from('daily_rewards_history')
      .select(`
        id,
        user_id,
        dia,
        pontos,
        created_at,
        profiles!inner(nome, twitch_username)
      `)
      .gte('created_at', `${hoje}T00:00:00-03:00`)
      .lt('created_at', `${hoje}T23:59:59-03:00`)
      .order('created_at', { ascending: true });

    if (rewardsError) {
      console.error('Erro ao buscar resgates:', rewardsError);
      throw rewardsError;
    }

    // Formatar dados com posição
    const formattedRewards = (rewards || []).map((reward: any, index: number) => {
      const createdAt = new Date(reward.created_at);
      const brasiliaTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(createdAt);

      const profile = Array.isArray(reward.profiles) ? reward.profiles[0] : reward.profiles;

      return {
        id: reward.id,
        user_id: reward.user_id,
        nome: profile?.nome || 'Desconhecido',
        twitch_username: profile?.twitch_username,
        dia: reward.dia,
        pontos: reward.pontos,
        created_at: brasiliaTime,
        posicao: index + 1
      };
    });

    return new Response(
      JSON.stringify({
        date: hoje,
        total: formattedRewards.length,
        rewards: formattedRewards
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro ao buscar estatísticas:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
