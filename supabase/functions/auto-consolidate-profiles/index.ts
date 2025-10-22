import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Auto-consolidação de perfis duplicados
 * 
 * Detecta perfis com mesmo twitch_username mas IDs diferentes
 * (um com twitch_user_id, outro sem) e consolida automaticamente
 * 
 * IMPORTANTE: Só roda se houver saldo fragmentado
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

    console.log(`🔍 Buscando perfis duplicados (dryRun: ${dryRun})...`);

    // Buscar todos os perfis duplicados
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, twitch_username, twitch_user_id, is_active')
      .eq('is_active', true)
      .order('created_at');

    if (profilesError) throw profilesError;

    // Agrupar por twitch_username
    const groupedByUsername = new Map<string, any[]>();
    for (const profile of profiles || []) {
      if (!profile.twitch_username) continue;
      
      const key = profile.twitch_username.toLowerCase();
      if (!groupedByUsername.has(key)) {
        groupedByUsername.set(key, []);
      }
      groupedByUsername.get(key)!.push(profile);
    }

    // Filtrar apenas grupos com duplicatas
    const duplicateGroups = Array.from(groupedByUsername.entries())
      .filter(([_, profiles]) => profiles.length > 1)
      .map(([username, profiles]) => ({ username, profiles }));

    console.log(`📊 Encontrados ${duplicateGroups.length} grupos com duplicatas`);

    const consolidationResults: any[] = [];

    for (const group of duplicateGroups) {
      // Identificar perfil canônico (com twitch_user_id) e duplicado (sem twitch_user_id)
      const canonical = group.profiles.find(p => p.twitch_user_id);
      const duplicate = group.profiles.find(p => !p.twitch_user_id);

      if (!canonical || !duplicate) {
        console.log(`⚠️ Grupo ${group.username} não tem padrão esperado (1 com ID, 1 sem)`);
        continue;
      }

      // Buscar saldos
      const { data: balances } = await supabase
        .from('rubini_coins_balance')
        .select('user_id, saldo')
        .in('user_id', [canonical.id, duplicate.id]);

      const { data: tickets } = await supabase
        .from('tickets')
        .select('user_id, tickets_atual')
        .in('user_id', [canonical.id, duplicate.id]);

      const rcDup = balances?.find(b => b.user_id === duplicate.id)?.saldo || 0;
      const rcCan = balances?.find(b => b.user_id === canonical.id)?.saldo || 0;
      const ticketsDup = tickets?.find(t => t.user_id === duplicate.id)?.tickets_atual || 0;
      const ticketsCan = tickets?.find(t => t.user_id === canonical.id)?.tickets_atual || 0;

      // Só consolidar se houver saldo no perfil duplicado
      if (rcDup === 0 && ticketsDup === 0) {
        console.log(`✓ ${group.username}: sem saldo no perfil antigo, pulando`);
        continue;
      }

      if (dryRun) {
        consolidationResults.push({
          username: group.username,
          canonical_id: canonical.id,
          duplicate_id: duplicate.id,
          preview: {
            tickets: { canonical: ticketsCan, duplicate: ticketsDup, after: ticketsCan + ticketsDup },
            rubini_coins: { canonical: rcCan, duplicate: rcDup, after: rcCan + rcDup }
          },
          action: 'would_consolidate'
        });
        continue;
      }

      // CONSOLIDAR
      console.log(`🔄 Consolidando ${group.username}: ${duplicate.id} → ${canonical.id}`);

      try {
        // 1. Somar Rubini Coins
        if (rcDup > 0 || rcCan > 0) {
          await supabase
            .from('rubini_coins_balance')
            .upsert({
              user_id: canonical.id,
              saldo: rcCan + rcDup
            });

          // Registrar no histórico
          await supabase
            .from('rubini_coins_history')
            .insert({
              user_id: canonical.id,
              variacao: rcDup,
              motivo: `Consolidação de perfil duplicado (${duplicate.id})`,
              origem: 'profile_consolidation',
              status: 'confirmado'
            });

          // Zerar duplicado
          await supabase
            .from('rubini_coins_balance')
            .upsert({
              user_id: duplicate.id,
              saldo: 0
            });
        }

        // 2. Somar Tickets
        if (ticketsDup > 0 || ticketsCan > 0) {
          await supabase
            .from('tickets')
            .upsert({
              user_id: canonical.id,
              tickets_atual: ticketsCan + ticketsDup
            });

          // Registrar no ledger
          await supabase
            .from('ticket_ledger')
            .insert({
              user_id: canonical.id,
              variacao: ticketsDup,
              motivo: `Consolidação de perfil duplicado (${duplicate.id})`
            });

          // Zerar duplicado
          await supabase
            .from('tickets')
            .upsert({
              user_id: duplicate.id,
              tickets_atual: 0
            });
        }

        // 3. Migrar históricos
        const tables = [
          'rubini_coins_history',
          'ticket_ledger',
          'tibiatermo_user_games',
          'tibiatermo_history',
          'daily_rewards_history',
          'user_daily_logins',
          'spins',
          'chat_messages',
          'rubini_coins_resgates'
        ];

        for (const table of tables) {
          await supabase
            .from(table as any)
            .update({ user_id: canonical.id })
            .eq('user_id', duplicate.id);
        }

        // Atualizar raffles (vencedor_id)
        await supabase
          .from('raffles')
          .update({ vencedor_id: canonical.id })
          .eq('vencedor_id', duplicate.id);

        // 4. Registrar auditoria
        await supabase
          .from('profile_merge_audit')
          .insert({
            canonical_profile_id: canonical.id,
            duplicate_profile_id: duplicate.id,
            tickets_before_canonical: ticketsCan,
            tickets_before_duplicate: ticketsDup,
            tickets_after_canonical: ticketsCan + ticketsDup,
            rubini_coins_before_canonical: rcCan,
            rubini_coins_before_duplicate: rcDup,
            rubini_coins_after_canonical: rcCan + rcDup,
            metadata: {
              twitch_username: group.username,
              twitch_user_id: canonical.twitch_user_id,
              auto_consolidated: true
            }
          });

        // 5. Desativar perfil duplicado
        await supabase
          .from('profiles')
          .update({ is_active: false, merged_into: canonical.id })
          .eq('id', duplicate.id);

        consolidationResults.push({
          username: group.username,
          canonical_id: canonical.id,
          duplicate_id: duplicate.id,
          success: true,
          tickets_added: ticketsDup,
          rc_added: rcDup,
          new_totals: {
            tickets: ticketsCan + ticketsDup,
            rubini_coins: rcCan + rcDup
          }
        });

        console.log(`✅ ${group.username} consolidado com sucesso`);
      } catch (error) {
        console.error(`❌ Erro consolidando ${group.username}:`, error);
        consolidationResults.push({
          username: group.username,
          canonical_id: canonical.id,
          duplicate_id: duplicate.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = consolidationResults.filter(r => r.success).length;
    const totalCount = consolidationResults.length;

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        total_groups: duplicateGroups.length,
        consolidated: totalCount,
        successful: successCount,
        results: consolidationResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in auto-consolidate-profiles:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
