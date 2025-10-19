import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log('🔄 Iniciando reconciliação StreamElements...');

    // 1️⃣ Buscar logs que requerem reprocessamento
    const { data: logsParaReprocessar, error: fetchError } = await supabase
      .from('streamelements_sync_logs')
      .select('*')
      .eq('requer_reprocessamento', true)
      .eq('success', false)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    if (!logsParaReprocessar || logsParaReprocessar.length === 0) {
      console.log('✅ Nenhum log pendente de reprocessamento');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum log pendente',
          reprocessados: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontrados ${logsParaReprocessar.length} logs para reprocessar`);

    let sucessos = 0;
    let falhas = 0;

    // 2️⃣ Reprocessar cada log
    for (const log of logsParaReprocessar) {
      try {
        console.log(`\n🔄 Reprocessando log ${log.id} (${log.username}, ${log.points_added} pontos)`);

        // Invocar função de sincronização novamente
        const { data: syncResult, error: syncError } = await supabase.functions.invoke(
          'sync-streamelements-points',
          {
            body: {
              username: log.username,
              points: log.points_added,
              tipo_operacao: `${log.tipo_operacao}_reprocessado`,
              referencia_id: log.referencia_id,
              user_id: log.user_id
            }
          }
        );

        if (syncError || !syncResult?.success) {
          console.error(`❌ Falha ao reprocessar log ${log.id}:`, syncError);
          falhas++;
          
          // Incrementar contador de tentativas
          await supabase
            .from('streamelements_sync_logs')
            .update({ 
              tentativas_verificacao: (log.tentativas_verificacao || 0) + 1,
              error_message: syncError?.message || 'Falha no reprocessamento'
            })
            .eq('id', log.id);
        } else {
          console.log(`✅ Log ${log.id} reprocessado com sucesso`);
          sucessos++;
          
          // Marcar log original como não requerendo reprocessamento
          await supabase
            .from('streamelements_sync_logs')
            .update({ 
              requer_reprocessamento: false,
              reprocessado_em: new Date().toISOString()
            })
            .eq('id', log.id);
        }

        // Aguardar entre requisições para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.error(`⚠️ Erro ao processar log ${log.id}:`, error);
        falhas++;
      }
    }

    console.log(`\n📊 Reconciliação concluída: ${sucessos} sucessos, ${falhas} falhas`);

    return new Response(
      JSON.stringify({
        success: true,
        total_processados: logsParaReprocessar.length,
        sucessos,
        falhas
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na reconciliação:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
