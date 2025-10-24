import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Batch Consolidation Service
 * 
 * Executa consolidação em lote de perfis duplicados existentes.
 * Requer permissões de admin.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { dryRun = false } = await req.json().catch(() => ({ dryRun: false }));
    const requestId = `consolidate-batch-${Date.now()}`;

    console.log(`[${requestId}] Iniciando consolidação em lote (dryRun: ${dryRun})`);

    if (dryRun) {
      // Modo dry-run: apenas listar duplicatas sem consolidar
      const { data: duplicates, error: scanError } = await supabase.rpc(
        'consolidate_duplicate_profiles',
        {},
        { count: 'exact' }
      );

      if (scanError) {
        console.error(`[${requestId}] Erro ao escanear duplicatas:`, scanError);
        return new Response(
          JSON.stringify({ error: scanError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[${requestId}] Scan concluído. Duplicatas encontradas: ${duplicates?.length || 0}`);

      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          message: `Encontradas ${duplicates?.length || 0} duplicatas para consolidar`,
          duplicates: duplicates || [],
          requestId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Modo real: executar consolidação
    const { data: results, error: consolidateError } = await supabase.rpc(
      'consolidate_duplicate_profiles'
    );

    if (consolidateError) {
      console.error(`[${requestId}] Erro ao consolidar:`, consolidateError);
      return new Response(
        JSON.stringify({ error: consolidateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const consolidated = results?.filter((r: any) => r.action_taken === 'consolidated') || [];
    const totalRubiniCoins = consolidated.reduce((sum: number, r: any) => sum + (r.rubini_coins_consolidated || 0), 0);
    const totalTickets = consolidated.reduce((sum: number, r: any) => sum + (r.tickets_consolidated || 0), 0);

    console.log(`[${requestId}] ✅ Consolidação concluída:`);
    console.log(`  - Perfis consolidados: ${consolidated.length}`);
    console.log(`  - Rubini Coins migrados: ${totalRubiniCoins}`);
    console.log(`  - Tickets migrados: ${totalTickets}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Consolidação concluída. ${consolidated.length} perfis duplicados processados.`,
        summary: {
          profilesConsolidated: consolidated.length,
          totalRubiniCoins,
          totalTickets
        },
        details: consolidated,
        requestId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in consolidate-profiles-batch:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
