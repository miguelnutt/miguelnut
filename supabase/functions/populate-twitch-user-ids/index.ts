import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Para o caso Almoco10: consolidar manualmente os dois perfis
    // ID com 'A' maiúsculo: b15a7b61-e211-47d9-b31d-6b1295fd02ad (tem 50 RC)
    // ID com 'a' minúsculo: 05196acd-c380-4acd-a916-9a6a57ae6080 (tem 0 RC)
    
    const canonicalId = 'b15a7b61-e211-47d9-b31d-6b1295fd02ad';
    const duplicateId = '05196acd-c380-4acd-a916-9a6a57ae6080';

    console.log('🔧 Iniciando correção do caso Almoco10...');

    // 1. Buscar saldos
    const { data: balances } = await supabaseClient
      .from('rubini_coins_balance')
      .select('user_id, saldo')
      .in('user_id', [canonicalId, duplicateId]);

    const { data: tickets } = await supabaseClient
      .from('tickets')
      .select('user_id, tickets_atual')
      .in('user_id', [canonicalId, duplicateId]);

    const rcDup = balances?.find(b => b.user_id === duplicateId)?.saldo || 0;
    const rcCan = balances?.find(b => b.user_id === canonicalId)?.saldo || 0;
    const ticketsDup = tickets?.find(t => t.user_id === duplicateId)?.tickets_atual || 0;
    const ticketsCan = tickets?.find(t => t.user_id === canonicalId)?.tickets_atual || 0;

    console.log(`📊 Saldos encontrados:
      - Canônico (Almoco10): RC=${rcCan}, Tickets=${ticketsCan}
      - Duplicado (almoco10): RC=${rcDup}, Tickets=${ticketsDup}`);

    // 2. Reapontar todos os históricos do duplicado para o canônico
    const tablesToUpdate = [
      'rubini_coins_history',
      'rubini_coins_resgates',
      'ticket_ledger',
      'daily_rewards_history',
      'user_daily_logins',
      'tibiatermo_history',
      'tibiatermo_user_games',
      'spins',
      'chat_messages',
      'chat_bans'
    ];

    for (const table of tablesToUpdate) {
      try {
        const { count } = await supabaseClient
          .from(table)
          .update({ user_id: canonicalId })
          .eq('user_id', duplicateId);
        
        if (count && count > 0) {
          console.log(`  ✅ ${table}: ${count} registros atualizados`);
        }
      } catch (e) {
        console.warn(`  ⚠️ ${table}: erro ao atualizar`, e);
      }
    }

    // Atualizar raffles (vencedor_id)
    try {
      const { count } = await supabaseClient
        .from('raffles')
        .update({ vencedor_id: canonicalId })
        .eq('vencedor_id', duplicateId);
      
      if (count && count > 0) {
        console.log(`  ✅ raffles (vencedor_id): ${count} registros atualizados`);
      }
    } catch (e) {
      console.warn(`  ⚠️ raffles: erro ao atualizar`, e);
    }

    // 3. Somar saldos (se duplicado tiver algo)
    if (rcDup > 0 || ticketsDup > 0) {
      if (rcDup > 0) {
        await supabaseClient
          .from('rubini_coins_balance')
          .upsert({
            user_id: canonicalId,
            saldo: rcCan + rcDup,
            updated_at: new Date().toISOString()
          });

        await supabaseClient
          .from('rubini_coins_history')
          .insert({
            user_id: canonicalId,
            variacao: rcDup,
            motivo: `Consolidação de perfil duplicado almoco10 (${duplicateId})`,
            origem: 'consolidacao_hotfix',
            status: 'confirmado',
            idempotency_key: `hotfix-almoco10-${Date.now()}`
          });

        console.log(`  ✅ Rubini Coins consolidados: ${rcCan} + ${rcDup} = ${rcCan + rcDup}`);
      }

      if (ticketsDup > 0) {
        await supabaseClient
          .from('tickets')
          .upsert({
            user_id: canonicalId,
            tickets_atual: ticketsCan + ticketsDup,
            updated_at: new Date().toISOString()
          });

        await supabaseClient
          .from('ticket_ledger')
          .insert({
            user_id: canonicalId,
            variacao: ticketsDup,
            motivo: `Consolidação de perfil duplicado almoco10 (${duplicateId})`
          });

        console.log(`  ✅ Tickets consolidados: ${ticketsCan} + ${ticketsDup} = ${ticketsCan + ticketsDup}`);
      }
    }

    // 4. Registrar auditoria
    await supabaseClient
      .from('profile_merge_audit')
      .insert({
        duplicate_profile_id: duplicateId,
        canonical_profile_id: canonicalId,
        rubini_coins_before_duplicate: rcDup,
        rubini_coins_before_canonical: rcCan,
        rubini_coins_after_canonical: rcCan + rcDup,
        tickets_before_duplicate: ticketsDup,
        tickets_before_canonical: ticketsCan,
        tickets_after_canonical: ticketsCan + ticketsDup,
        metadata: { 
          action: 'hotfix_almoco10',
          timestamp: new Date().toISOString(),
          note: 'Correção manual via populate-twitch-user-ids'
        }
      });

    // 5. Marcar duplicado como inativo
    await supabaseClient
      .from('profiles')
      .update({ is_active: false, merged_into: canonicalId })
      .eq('id', duplicateId);

    // 6. Atualizar perfil canônico com display_name correto
    await supabaseClient
      .from('profiles')
      .update({
        is_active: true,
        display_name_canonical: 'Almoco10',
        nome: 'Almoco10'
      })
      .eq('id', canonicalId);

    console.log('✅ Caso Almoco10 corrigido com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Caso Almoco10 corrigido',
        details: {
          canonical_id: canonicalId,
          duplicate_id: duplicateId,
          rubini_coins_added: rcDup,
          tickets_added: ticketsDup,
          final_balances: {
            rubini_coins: rcCan + rcDup,
            tickets: ticketsCan + ticketsDup
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
