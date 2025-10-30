import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const STREAMELEMENTS_JWT = Deno.env.get('STREAMELEMENTS_JWT_TOKEN');
const CHANNEL_ID = Deno.env.get('STREAMELEMENTS_CHANNEL_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  username: string;
  points: number;
  tipo_operacao?: string;
  referencia_id?: string;
  user_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const { username, points, tipo_operacao = 'manual', referencia_id, user_id }: SyncRequest = await req.json();
    
    const operacao = points >= 0 ? 'creditando' : 'debitando';
    const valorAbsoluto = Math.abs(points);
    console.log(`🔄 Sincronizando (${operacao} ${valorAbsoluto} pontos) para: ${username}`);

    if (!STREAMELEMENTS_JWT || !CHANNEL_ID) {
      console.error('❌ StreamElements credentials not configured');
      
      await supabase.from('streamelements_sync_logs').insert({
        username,
        points_added: points,
        success: false,
        error_message: 'StreamElements credentials not configured',
        tipo_operacao,
        referencia_id,
        user_id,
        requer_reprocessamento: true
      });
      
      return new Response(
        JSON.stringify({ error: 'StreamElements credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const MAX_TENTATIVAS = 3;
    let tentativaAtual = 0;
    let saldoAntes: number | null = null;
    let saldoDepois: number | null = null;
    let saldoVerificado = false;
    let ultimoErro: string | null = null;

    while (tentativaAtual < MAX_TENTATIVAS && !saldoVerificado) {
      tentativaAtual++;
      console.log(`\n🔄 Tentativa ${tentativaAtual}/${MAX_TENTATIVAS}`);

      try {
        // 1️⃣ BUSCAR SALDO ANTES
        const saldoAntesResponse = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${CHANNEL_ID}/${username}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${STREAMELEMENTS_JWT}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (saldoAntesResponse.ok) {
          const saldoAntesData = await saldoAntesResponse.json();
          saldoAntes = saldoAntesData.points || 0;
          console.log(`💰 Saldo ANTES (tentativa ${tentativaAtual}): ${saldoAntes} pontos`);
          
          // Verificar se há saldo suficiente para débito
          if (points < 0 && saldoAntes < Math.abs(points)) {
            ultimoErro = `Saldo insuficiente: usuário tem ${saldoAntes} pontos, tentando debitar ${Math.abs(points)}`;
            console.error(`❌ ${ultimoErro}`);
            break; // Não tentar novamente se não há saldo suficiente
          }
        }

        // 2️⃣ ADICIONAR PONTOS
        const addResponse = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${CHANNEL_ID}/${username}/${points}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${STREAMELEMENTS_JWT}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!addResponse.ok) {
          ultimoErro = `API error ${addResponse.status}: ${await addResponse.text()}`;
          console.error(`❌ Tentativa ${tentativaAtual} falhou:`, ultimoErro);
          
          if (tentativaAtual < MAX_TENTATIVAS) {
            await new Promise(resolve => setTimeout(resolve, 1000 * tentativaAtual));
            continue;
          }
          break;
        }

        const addData = await addResponse.json();
        const operacaoLog = points >= 0 ? 'creditados' : 'debitados';
        console.log(`✅ Pontos ${operacaoLog} (tentativa ${tentativaAtual}):`, addData);

        // 3️⃣ AGUARDAR E VERIFICAR SALDO DEPOIS
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const verificacaoResponse = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${CHANNEL_ID}/${username}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${STREAMELEMENTS_JWT}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (verificacaoResponse.ok) {
          const verificacaoData = await verificacaoResponse.json();
          saldoDepois = verificacaoData.points || 0;
          
          // 4️⃣ VALIDAR VERIFICAÇÃO
          if (saldoAntes !== null && saldoDepois !== null) {
            const diferencaEsperada = points;
            const diferencaReal = saldoDepois - saldoAntes;
            saldoVerificado = diferencaReal === diferencaEsperada;
            
            // Melhorar log para mostrar corretamente valores negativos
            const sinalEsperado = diferencaEsperada >= 0 ? '+' : '';
            const sinalReal = diferencaReal >= 0 ? '+' : '';
            console.log(`🔍 Verificação (tentativa ${tentativaAtual}): Esperado ${sinalEsperado}${diferencaEsperada}, Real ${sinalReal}${diferencaReal}, Verificado: ${saldoVerificado}`);
            
            if (!saldoVerificado && tentativaAtual < MAX_TENTATIVAS) {
              ultimoErro = `Verificação falhou: esperado ${sinalEsperado}${diferencaEsperada}, obtido ${sinalReal}${diferencaReal}`;
              console.warn(`⚠️ ${ultimoErro}. Tentando novamente...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
          } else {
            saldoVerificado = true;
          }
          
          console.log(`💰 Saldo DEPOIS (tentativa ${tentativaAtual}): ${saldoDepois} pontos`);
        }

        if (saldoVerificado) {
          break;
        }
      } catch (error: any) {
        ultimoErro = error.message;
        console.error(`⚠️ Erro na tentativa ${tentativaAtual}:`, error);
        
        if (tentativaAtual < MAX_TENTATIVAS) {
          await new Promise(resolve => setTimeout(resolve, 2000 * tentativaAtual));
        }
      }
    }

    // 5️⃣ REGISTRAR LOG COM RESULTADO FINAL
    const { data: logData, error: logError } = await supabase
      .from('streamelements_sync_logs')
      .insert({
        username,
        points_added: points,
        success: saldoVerificado,
        saldo_antes: saldoAntes,
        saldo_depois: saldoDepois,
        saldo_verificado: saldoVerificado,
        tipo_operacao,
        referencia_id,
        user_id,
        verificado_em: saldoVerificado ? new Date().toISOString() : null,
        tentativas_verificacao: tentativaAtual,
        requer_reprocessamento: !saldoVerificado,
        error_message: saldoVerificado ? null : ultimoErro
      })
      .select()
      .single();

    if (logError) {
      console.error('⚠️ Erro ao salvar log:', logError);
    } else {
      console.log(`📝 Log registrado: ${logData?.id} (${tentativaAtual} tentativas)`);
    }

    if (!saldoVerificado) {
      return new Response(
        JSON.stringify({ 
          error: 'Falha na verificação após múltiplas tentativas',
          details: ultimoErro,
          tentativas: tentativaAtual,
          saldoAntes,
          saldoDepois,
          requerReprocessamento: true
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${points} pontos adicionados com verificação para ${username}`,
        saldoAntes,
        saldoDepois,
        verificado: saldoVerificado,
        tentativas: tentativaAtual,
        logId: logData?.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in sync-streamelements-points:', error);
    
    // Registrar erro crítico
    await supabase.from('streamelements_sync_logs').insert({
      username: 'unknown',
      points_added: 0,
      success: false,
      error_message: error.message,
      requer_reprocessamento: true
    });
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
