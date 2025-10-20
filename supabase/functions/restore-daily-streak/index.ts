import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId, diasPerdidos, custoTotal } = await req.json();

    if (!userId || !diasPerdidos || !custoTotal) {
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[restore-streak] Restaurando streak - userId: ${userId}, dias: ${diasPerdidos}, custo: ${custoTotal}`);

    // Buscar username
    const { data: profile } = await supabase
      .from('profiles')
      .select('twitch_username')
      .eq('id', userId)
      .single();

    if (!profile?.twitch_username) {
      return new Response(JSON.stringify({ error: 'Usuário sem Twitch username' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Criar idempotency key baseado em userId + timestamp do dia
    const hoje = new Date().toISOString().split('T')[0];
    const idempotencyKey = `streak_restore:${userId}:${hoje}`;

    // Verificar se já foi processado
    const { data: existingLog } = await supabase
      .from('streamelements_sync_logs')
      .select('id, success')
      .eq('tipo_operacao', 'streak_restore')
      .eq('username', profile.twitch_username)
      .eq('created_at::date', hoje)
      .maybeSingle();

    if (existingLog) {
      if (existingLog.success) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Restauração já foi processada hoje' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Invocar sync-streamelements-points para debitar
    const syncResponse = await supabase.functions.invoke('sync-streamelements-points', {
      body: {
        username: profile.twitch_username,
        points: -custoTotal, // Negativo para debitar
        tipo_operacao: 'streak_restore',
        referencia_id: crypto.randomUUID(),
      },
    });

    if (syncResponse.error) {
      console.error('[restore-streak] Erro ao sincronizar pontos:', syncResponse.error);
      return new Response(
        JSON.stringify({ error: 'Erro ao debitar pontos da StreamElements' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const syncData = syncResponse.data;

    if (!syncData.success) {
      return new Response(
        JSON.stringify({ error: syncData.error || 'Falha ao debitar pontos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar ultimo_login para ontem (permitir resgate hoje)
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(ontem);

    const { error: updateError } = await supabase
      .from('user_daily_logins')
      .update({ ultimo_login: ontemStr })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[restore-streak] Erro ao atualizar login:', updateError);
      // Pontos já foram debitados, mas não conseguiu restaurar
      return new Response(
        JSON.stringify({ error: 'Pontos debitados mas erro ao restaurar sequência. Contate o suporte.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[restore-streak] Sequência restaurada com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sequência restaurada! ${custoTotal} pontos debitados.`,
        saldo_atual: syncData.balance_after
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[restore-streak] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
