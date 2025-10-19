import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const { log_id, admin_user_id } = await req.json();
    
    console.log(`🔄 Reprocessando log: ${log_id}`);

    // 1️⃣ Buscar o log original
    const { data: originalLog, error: fetchError } = await supabase
      .from('streamelements_sync_logs')
      .select('*')
      .eq('id', log_id)
      .single();

    if (fetchError || !originalLog) {
      throw new Error('Log não encontrado');
    }

    if (!originalLog.requer_reprocessamento) {
      return new Response(
        JSON.stringify({ 
          error: 'Este log não requer reprocessamento',
          log: originalLog 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2️⃣ Chamar a função de sincronização novamente
    const syncResponse = await supabase.functions.invoke('sync-streamelements-points', {
      body: {
        username: originalLog.username,
        points: originalLog.points_added,
        tipo_operacao: `reprocessamento_${originalLog.tipo_operacao}`,
        referencia_id: originalLog.referencia_id,
        user_id: originalLog.user_id
      }
    });

    if (syncResponse.error) {
      throw new Error(`Erro ao reprocessar: ${syncResponse.error.message}`);
    }

    // 3️⃣ Marcar log original como reprocessado
    await supabase
      .from('streamelements_sync_logs')
      .update({
        requer_reprocessamento: false,
        reprocessado_em: new Date().toISOString(),
        reprocessado_por: admin_user_id
      })
      .eq('id', log_id);

    console.log(`✅ Log ${log_id} reprocessado com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Log reprocessado com sucesso',
        originalLog,
        newSync: syncResponse.data
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in reprocess-streamelements-failed:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
