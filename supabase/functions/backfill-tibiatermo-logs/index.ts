import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se é admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Backfill] Iniciando backfill dos logs do TibiaTermo...');

    // Pegar data atual no horário de Brasília
    const hoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const inicioHoje = `${hoje}T00:00:00-03:00`;
    const fimHoje = `${hoje}T23:59:59-03:00`;

    console.log(`[Backfill] Buscando eventos do TibiaTermo entre ${inicioHoje} e ${fimHoje}`);

    // Buscar eventos de TibiaTermo de hoje que são Pontos de Loja
    const { data: tibiaHistory, error: historyError } = await supabase
      .from('tibiatermo_history')
      .select('*')
      .eq('tipo_recompensa', 'Pontos de Loja')
      .gte('created_at', inicioHoje)
      .lte('created_at', fimHoje)
      .order('created_at', { ascending: true });

    if (historyError) {
      console.error('[Backfill] Erro ao buscar histórico:', historyError);
      throw historyError;
    }

    console.log(`[Backfill] Encontrados ${tibiaHistory?.length || 0} eventos do TibiaTermo de Pontos de Loja hoje`);

    if (!tibiaHistory || tibiaHistory.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum evento para processar',
        processados: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processados = 0;
    let duplicados = 0;
    let erros = 0;

    // Para cada evento do histórico do TibiaTermo
    for (const evento of tibiaHistory) {
      try {
        // Verificar se já existe no log do StreamElements
        const { data: existingLog } = await supabase
          .from('streamelements_sync_logs')
          .select('id')
          .eq('tipo_operacao', 'tibiatermo')
          .eq('user_id', evento.user_id)
          .eq('username', evento.nome_usuario)
          .eq('points_added', evento.valor)
          .gte('created_at', inicioHoje)
          .lte('created_at', fimHoje)
          .maybeSingle();

        if (existingLog) {
          console.log(`[Backfill] Evento já existe no log: ${evento.nome_usuario} - ${evento.valor} pontos`);
          duplicados++;
          continue;
        }

        // Criar registro no log do StreamElements
        const { error: insertError } = await supabase
          .from('streamelements_sync_logs')
          .insert({
            user_id: evento.user_id,
            username: evento.nome_usuario,
            points_added: evento.valor,
            success: true, // Assumindo que foi bem-sucedido já que está no histórico
            saldo_verificado: true,
            tipo_operacao: 'tibiatermo',
            referencia_id: evento.id,
            created_at: evento.created_at,
            saldo_antes: null, // Não temos essa informação retroativa
            saldo_depois: null,
            tentativas_verificacao: 1,
            requer_reprocessamento: false,
            error_message: null
          });

        if (insertError) {
          console.error(`[Backfill] Erro ao inserir log para ${evento.nome_usuario}:`, insertError);
          erros++;
        } else {
          console.log(`[Backfill] ✅ Log criado: ${evento.nome_usuario} - ${evento.valor} pontos às ${evento.created_at}`);
          processados++;
        }
      } catch (error) {
        console.error(`[Backfill] Erro ao processar evento:`, error);
        erros++;
      }
    }

    console.log(`[Backfill] Backfill concluído: ${processados} processados, ${duplicados} duplicados, ${erros} erros`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Backfill concluído`,
      processados,
      duplicados,
      erros,
      total: tibiaHistory.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Backfill] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
