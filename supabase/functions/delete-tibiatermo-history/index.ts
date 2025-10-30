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

    const { historyId } = await req.json();

    if (!historyId) {
      return new Response(
        JSON.stringify({ error: 'ID do histórico é necessário' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[DeleteTibiaTermoHistory] Iniciando exclusão para historyId: ${historyId} por admin: ${user.id}`);

    // 1️⃣ Buscar o histórico original
    const { data: historyRecord, error: fetchError } = await supabase
      .from('tibiatermo_history')
      .select('*')
      .eq('id', historyId)
      .single();

    if (fetchError || !historyRecord) {
      console.error('[DeleteTibiaTermoHistory] Erro ao buscar histórico:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Histórico não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // 2️⃣ Se for Pontos de Loja, fazer estorno na StreamElements
    if (historyRecord.tipo_recompensa === 'Pontos de Loja') {
      const pontosOriginal = parseInt(historyRecord.valor) || 0;
      
      if (pontosOriginal <= 0) {
        return new Response(
          JSON.stringify({ error: 'Valor de pontos inválido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Buscar o log original na SE (se existir)
      const { data: originalSeLog } = await supabase
        .from('streamelements_sync_logs')
        .select('id, success, saldo_verificado')
        .eq('tipo_operacao', 'tibiatermo')
        .eq('username', historyRecord.nome_usuario)
        .eq('points_added', pontosOriginal)
        .eq('success', true)
        .eq('saldo_verificado', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Se tiver log confirmado, fazer o estorno
      if (originalSeLog) {
        console.log(`[DeleteTibiaTermoHistory] Log SE encontrado: ${originalSeLog.id}, processando estorno`);

        // Verificar idempotência
        const idempotencyKey = `reversal:tibiatermo:${historyId}`;
        const { data: existingReversal } = await supabase
          .from('streamelements_sync_logs')
          .select('id')
          .eq('referencia_id', idempotencyKey)
          .maybeSingle();

        if (!existingReversal) {
          // Criar o estorno
          const pontosReverso = -pontosOriginal;
          const username = historyRecord.nome_usuario;

          console.log(`[DeleteTibiaTermoHistory] Enviando estorno: ${pontosReverso} pontos para ${username}`);

          try {
            const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-streamelements-points', {
              body: {
                username: username,
                points: pontosReverso,
                tipo_operacao: 'estorno_tibiatermo',
                referencia_id: idempotencyKey,
                user_id: historyRecord.user_id
              }
            });

            if (syncError) {
              console.error('[DeleteTibiaTermoHistory] Erro ao enviar estorno:', syncError);
            } else {
              console.log('[DeleteTibiaTermoHistory] Estorno enviado com sucesso');

              // Atualizar o log de estorno com referências
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
              }
            }
          } catch (error) {
            console.error('[DeleteTibiaTermoHistory] Erro ao processar estorno:', error);
          }
        } else {
          console.log(`[DeleteTibiaTermoHistory] Reverso já existe: ${existingReversal.id}`);
        }
      } else {
        console.log(`[DeleteTibiaTermoHistory] Sem log SE confirmado, apenas deletando`);
      }
    } else if (historyRecord.tipo_recompensa === 'Tickets') {
      // Estornar tickets
      const tickets = parseInt(historyRecord.valor) || 0;
      
      if (tickets > 0 && historyRecord.user_id) {
        const { data: ticketsBalance } = await supabase
          .from('tickets')
          .select('tickets_atual')
          .eq('user_id', historyRecord.user_id)
          .maybeSingle();

        if (ticketsBalance) {
          const novoSaldo = ticketsBalance.tickets_atual - tickets;
          
          if (novoSaldo < 0) {
            return new Response(
              JSON.stringify({ error: 'Exclusão resultaria em saldo negativo de Tickets' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }

          await supabase
            .from('tickets')
            .update({ tickets_atual: novoSaldo })
            .eq('user_id', historyRecord.user_id);

          await supabase
            .from('ticket_ledger')
            .insert({
              user_id: historyRecord.user_id,
              variacao: -tickets,
              motivo: `TibiaTermo histórico deletado: -${tickets} ticket(s)`
            });

          console.log(`[DeleteTibiaTermoHistory] Tickets estornados: -${tickets}, novo saldo: ${novoSaldo}`);
        }
      }
    }

    // 3️⃣ Deletar o histórico
    const { error: deleteError } = await supabase
      .from('tibiatermo_history')
      .delete()
      .eq('id', historyId);

    if (deleteError) {
      console.error('[DeleteTibiaTermoHistory] Erro ao deletar:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Erro ao deletar histórico' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`[DeleteTibiaTermoHistory] Histórico deletado com sucesso: ${historyId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Histórico deletado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DeleteTibiaTermoHistory] Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
