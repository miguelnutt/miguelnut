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

    const { action, duplicateId, canonicalId, dryRun = false } = await req.json();

    if (action === 'scan') {
      // Scanner de duplicatas: agrupa por twitch_user_id ou login similar
      const { data: profiles, error } = await supabaseClient
        .from('profiles')
        .select('id, nome, twitch_username, twitch_user_id, created_at, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Agrupar por twitch_user_id (se preenchido) ou login case-insensitive
      const groups = new Map<string, any[]>();
      
      for (const profile of profiles || []) {
        // Prioridade 1: agrupar por twitch_user_id
        if (profile.twitch_user_id) {
          const key = `twitch:${profile.twitch_user_id}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(profile);
        }
        // Prioridade 2: agrupar por login case-insensitive (apenas se não tem twitch_user_id)
        else if (profile.twitch_username) {
          const key = `login:${profile.twitch_username.toLowerCase()}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(profile);
        }
      }

      // Filtrar apenas grupos com duplicatas
      const duplicates = Array.from(groups.entries())
        .filter(([_, profiles]) => profiles.length > 1)
        .map(([key, profiles]) => ({
          key,
          count: profiles.length,
          profiles: profiles.map(p => ({
            id: p.id,
            nome: p.nome,
            twitch_username: p.twitch_username,
            twitch_user_id: p.twitch_user_id,
            created_at: p.created_at,
          }))
        }));

      return new Response(
        JSON.stringify({ success: true, duplicates }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'merge') {
      if (!duplicateId || !canonicalId) {
        throw new Error('duplicateId e canonicalId são obrigatórios');
      }

      console.log(`🔄 Consolidando perfil ${duplicateId} em ${canonicalId} (dryRun: ${dryRun})`);

      // 1. Buscar saldos atuais
      const { data: balances } = await supabaseClient
        .from('rubini_coins_balance')
        .select('user_id, saldo')
        .in('user_id', [duplicateId, canonicalId]);

      const { data: tickets } = await supabaseClient
        .from('tickets')
        .select('user_id, tickets_atual')
        .in('user_id', [duplicateId, canonicalId]);

      const rcDup = balances?.find(b => b.user_id === duplicateId)?.saldo || 0;
      const rcCan = balances?.find(b => b.user_id === canonicalId)?.saldo || 0;
      const ticketsDup = tickets?.find(t => t.user_id === duplicateId)?.tickets_atual || 0;
      const ticketsCan = tickets?.find(t => t.user_id === canonicalId)?.tickets_atual || 0;

      if (dryRun) {
        return new Response(
          JSON.stringify({
            success: true,
            dryRun: true,
            preview: {
              rubini_coins: { duplicate: rcDup, canonical: rcCan, after: rcCan + rcDup },
              tickets: { duplicate: ticketsDup, canonical: ticketsCan, after: ticketsCan + ticketsDup }
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Executar consolidação (transacional)
      console.log(`✅ Executando merge real...`);

      // Somar saldos no canônico
      if (rcDup > 0) {
        const { error } = await supabaseClient
          .from('rubini_coins_balance')
          .upsert({
            user_id: canonicalId,
            saldo: rcCan + rcDup,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;

        // Registrar no histórico
        await supabaseClient
          .from('rubini_coins_history')
          .insert({
            user_id: canonicalId,
            variacao: rcDup,
            motivo: `Consolidação de perfil duplicado ${duplicateId}`,
            origem: 'consolidacao',
            status: 'confirmado',
            idempotency_key: `merge-${duplicateId}-${canonicalId}-${Date.now()}`
          });
      }

      if (ticketsDup > 0) {
        const { error } = await supabaseClient
          .from('tickets')
          .upsert({
            user_id: canonicalId,
            tickets_atual: ticketsCan + ticketsDup,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;

        await supabaseClient
          .from('ticket_ledger')
          .insert({
            user_id: canonicalId,
            variacao: ticketsDup,
            motivo: `Consolidação de perfil duplicado ${duplicateId}`
          });
      }

      // 3. Reapontar históricos para o canônico
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
          await supabaseClient
            .from(table)
            .update({ user_id: canonicalId })
            .eq('user_id', duplicateId);
        } catch (e) {
          console.warn(`⚠️ Falha ao atualizar ${table}:`, e);
        }
      }

      // Atualizar raffles (vencedor_id)
      await supabaseClient
        .from('raffles')
        .update({ vencedor_id: canonicalId })
        .eq('vencedor_id', duplicateId);

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
          metadata: { action: 'api_merge', timestamp: new Date().toISOString() }
        });

      // 5. Marcar duplicata como inativa (não deletar)
      await supabaseClient
        .from('profiles')
        .update({ is_active: false, merged_into: canonicalId })
        .eq('id', duplicateId);

      console.log(`✅ Merge concluído: ${duplicateId} -> ${canonicalId}`);

      return new Response(
        JSON.stringify({
          success: true,
          merged: {
            duplicate: duplicateId,
            canonical: canonicalId,
            rubini_coins_added: rcDup,
            tickets_added: ticketsDup,
            new_totals: {
              rubini_coins: rcCan + rcDup,
              tickets: ticketsCan + ticketsDup
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Ação inválida. Use "scan" ou "merge".');

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
