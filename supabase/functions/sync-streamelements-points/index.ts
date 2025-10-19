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
    
    console.log(`🔄 Sincronizando ${points} pontos para: ${username}`);

    if (!STREAMELEMENTS_JWT || !CHANNEL_ID) {
      console.error('❌ StreamElements credentials not configured');
      
      // Registrar falha no log
      await supabase.from('streamelements_sync_logs').insert({
        username,
        points_added: points,
        success: false,
        error_message: 'StreamElements credentials not configured',
        tipo_operacao,
        referencia_id,
        user_id
      });
      
      return new Response(
        JSON.stringify({ error: 'StreamElements credentials not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 1️⃣ PRIMEIRA VERIFICAÇÃO: Buscar saldo ANTES da operação
    let saldoAntes: number | null = null;
    try {
      const saldoResponse = await fetch(
        `https://api.streamelements.com/kappa/v2/points/${CHANNEL_ID}/${username}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${STREAMELEMENTS_JWT}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (saldoResponse.ok) {
        const saldoData = await saldoResponse.json();
        saldoAntes = saldoData.points || 0;
        console.log(`💰 Saldo ANTES: ${saldoAntes} pontos`);
      }
    } catch (error) {
      console.error('⚠️ Erro ao buscar saldo inicial:', error);
    }

    // 2️⃣ ADICIONAR PONTOS no StreamElements
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
      const errorText = await addResponse.text();
      console.error('❌ StreamElements API error:', errorText);
      
      // Registrar falha no log
      await supabase.from('streamelements_sync_logs').insert({
        username,
        points_added: points,
        success: false,
        error_message: `API error ${addResponse.status}: ${errorText}`,
        saldo_antes: saldoAntes,
        tipo_operacao,
        referencia_id,
        user_id
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to sync with StreamElements',
          details: errorText 
        }),
        { 
          status: addResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const addData = await addResponse.json();
    console.log('✅ Pontos adicionados:', addData);

    // 3️⃣ SEGUNDA VERIFICAÇÃO: Buscar saldo DEPOIS e validar
    let saldoDepois: number | null = null;
    let saldoVerificado = false;
    
    try {
      // Pequeno delay para garantir que o SE processou
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
        
        // Verificar se o saldo aumentou corretamente
        if (saldoAntes !== null) {
          const diferencaEsperada = points;
          const diferencaReal = saldoDepois - saldoAntes;
          saldoVerificado = diferencaReal === diferencaEsperada;
          
          console.log(`🔍 Verificação: Esperado +${diferencaEsperada}, Real +${diferencaReal}, Verificado: ${saldoVerificado}`);
        } else {
          // Se não conseguimos o saldo inicial, apenas confirma que o saldo final existe
          saldoVerificado = true;
        }
        
        console.log(`💰 Saldo DEPOIS: ${saldoDepois} pontos`);
      }
    } catch (error) {
      console.error('⚠️ Erro na verificação de saldo:', error);
    }

    // 4️⃣ REGISTRAR LOG de sucesso com verificação
    const { data: logData, error: logError } = await supabase
      .from('streamelements_sync_logs')
      .insert({
        username,
        points_added: points,
        success: true,
        saldo_antes: saldoAntes,
        saldo_depois: saldoDepois,
        saldo_verificado: saldoVerificado,
        tipo_operacao,
        referencia_id,
        user_id,
        verificado_em: saldoVerificado ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (logError) {
      console.error('⚠️ Erro ao salvar log:', logError);
    } else {
      console.log('📝 Log registrado:', logData?.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${points} points added to ${username} on StreamElements`,
        saldoAntes,
        saldoDepois,
        verificado: saldoVerificado,
        data: addData,
        logId: logData?.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('❌ Error in sync-streamelements-points:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
