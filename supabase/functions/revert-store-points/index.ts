import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Verificar autenticação e obter admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verificar se é admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado: apenas administradores' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { spinId } = await req.json();

    if (!spinId) {
      return new Response(
        JSON.stringify({ error: 'ID do histórico é necessário' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[RevertStorePoints] Iniciando estorno para spin: ${spinId} por admin: ${user.id}`);

    // 1️⃣ Buscar o spin original
    const { data: spinRecord, error: fetchError } = await supabase
      .from('spins')
      .select('*')
      .eq('id', spinId)
      .single();

    if (fetchError || !spinRecord) {
      console.error('[RevertStorePoints] Erro ao buscar spin:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Histórico não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // 2️⃣ Validar que é Pontos de Loja
    if (spinRecord.tipo_recompensa !== 'Pontos de Loja') {
      return new Response(
        JSON.stringify({ error: 'Este histórico não é de Pontos de Loja' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const pontosOriginal = parseInt(spinRecord.valor) || 0;
    
    if (pontosOriginal <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valor de pontos inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 3️⃣ Buscar o log original na SE (se existir)
    const { data: originalSeLog } = await supabase
      .from('streamelements_sync_logs')
      .select('id, success, saldo_verificado, username')
      .eq('referencia_id', spinId)
      .eq('success', true)
      .eq('saldo_verificado', true)
      .maybeSingle();

    // Se não tiver log confirmado na SE, apenas deletar o spin sem estornar
    if (!originalSeLog) {
      console.log(`[RevertStorePoints] Spin ${spinId} não tem log confirmado na SE, apenas deletando`);
      
      const { error: deleteError } = await supabase
        .from('spins')
        .delete()
        .eq('id', spinId);

      if (deleteError) {
        console.error('[RevertStorePoints] Erro ao deletar spin:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Erro ao deletar histórico' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          reverted: false,
          message: 'Histórico deletado (não havia crédito confirmado na SE)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RevertStorePoints] Log original SE encontrado: ${originalSeLog.id}`);

    // 4️⃣ Verificar idempotência - se já existe um reverso para este log
    const idempotencyKey = `reversal:${spinId}`;
    const { data: existingReversal } = await supabase
      .from('streamelements_sync_logs')
      .select('id, success, saldo_verificado')
      .eq('referencia_id', idempotencyKey)
      .maybeSingle();

    if (existingReversal) {
      console.log(`[RevertStorePoints] Reverso já existe: ${existingReversal.id}`);
      
      // Deletar o spin se ainda existir
      await supabase.from('spins').delete().eq('id', spinId);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          reverted: true,
          alreadyProcessed: true,
          message: 'Estorno já foi processado anteriormente'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5️⃣ Criar o estorno enviando pontos negativos para a SE
    const pontosReverso = -pontosOriginal;
    const username = spinRecord.nome_usuario;

    // Verificar se o username está vazio ou é inválido
    if (!username || username.trim() === '' || username === 'Visitante') {
      console.log(`[RevertStorePoints] Username inválido ou vazio (${username}), apenas deletando histórico`);
      
      const { error: deleteError } = await supabase
        .from('spins')
        .delete()
        .eq('id', spinId);

      if (deleteError) {
        console.error('[RevertStorePoints] Erro ao deletar spin:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Erro ao deletar histórico' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          reverted: false,
          message: 'Histórico deletado (usuário não identificado, não foi possível estornar na StreamElements)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RevertStorePoints] Enviando estorno: ${pontosReverso} pontos para ${username}`);

    try {
      // Invocar função sync com pontos negativos
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-streamelements-points', {
        body: {
          username: username,
          points: pontosReverso,
          tipo_operacao: 'store_points_reversal',
          referencia_id: idempotencyKey,
          user_id: spinRecord.user_id
        }
      });

      if (syncError) {
        console.error('[RevertStorePoints] Erro ao enviar estorno:', syncError);
        
        // Verificar se é erro de saldo insuficiente
        const errorMessage = syncError.message || '';
        const isInsufficientBalance = errorMessage.includes('Saldo insuficiente') || 
                                    errorMessage.includes('insufficient balance') ||
                                    syncData?.details?.includes('Saldo insuficiente');
        
        if (isInsufficientBalance) {
          // Para saldo insuficiente, deletar o histórico mesmo assim mas informar o problema
          const { error: deleteError } = await supabase
            .from('spins')
            .delete()
            .eq('id', spinId);

          if (deleteError) {
            console.error('[RevertStorePoints] Erro ao deletar spin após saldo insuficiente:', deleteError);
            return new Response(
              JSON.stringify({ 
                error: 'Saldo insuficiente na StreamElements e erro ao deletar histórico',
                details: `StreamElements: ${errorMessage}, Delete: ${deleteError.message}`
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }

          return new Response(
            JSON.stringify({ 
              success: true,
              reverted: false,
              insufficientBalance: true,
              message: `Histórico deletado, mas não foi possível debitar ${pontosOriginal} pontos da StreamElements (saldo insuficiente do usuário ${username})`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Para outros erros, retornar erro normal
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao processar estorno na StreamElements',
            details: syncError.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log('[RevertStorePoints] Estorno enviado com sucesso:', syncData);

      // 6️⃣ Atualizar o log de estorno com referência ao original e admin
      const { data: reversalLog } = await supabase
        .from('streamelements_sync_logs')
        .select('id')
        .eq('referencia_id', idempotencyKey)
        .maybeSingle();

      if (reversalLog) {
        await supabase
          .from('streamelements_sync_logs')
          .update({
            ref_original_log_id: originalSeLog.id,
            admin_user_id: user.id
          })
          .eq('id', reversalLog.id);
        
        console.log(`[RevertStorePoints] Log de estorno atualizado com referências: ${reversalLog.id}`);
      }

      // 7️⃣ Deletar o spin original
      const { error: deleteError } = await supabase
        .from('spins')
        .delete()
        .eq('id', spinId);

      if (deleteError) {
        console.error('[RevertStorePoints] Erro ao deletar spin:', deleteError);
        return new Response(
          JSON.stringify({ 
            success: true, 
            reverted: true,
            warning: 'Estorno processado mas falha ao deletar histórico'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[RevertStorePoints] Spin deletado com sucesso: ${spinId}`);

      return new Response(
        JSON.stringify({ 
          success: true,
          reverted: true,
          pontosEstornados: pontosReverso,
          username: username,
          message: `${Math.abs(pontosReverso)} pontos estornados da StreamElements`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error: any) {
      console.error('[RevertStorePoints] Erro crítico:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao processar estorno',
          details: error.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

  } catch (error) {
    console.error('[RevertStorePoints] Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
