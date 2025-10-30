import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge Function para resolver identidade canônica de usuários
 * 
 * Prioridades de busca:
 * 1. twitch_user_id exato (fonte única da verdade)
 * 2. Alias registrado em user_aliases
 * 3. display_name ou login (case-insensitive)
 * 
 * Se encontrar duplicatas, consolida saldos em memória e retorna conta canônica
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { searchTerm, twitch_user_id } = await req.json();

    if (!searchTerm && !twitch_user_id) {
      throw new Error('searchTerm ou twitch_user_id é obrigatório');
    }

    let canonicalProfile = null;
    let allDuplicates: any[] = [];

    // 1. Buscar por twitch_user_id (prioridade máxima)
    if (twitch_user_id) {
      const { data } = await supabaseClient
        .from('profiles')
        .select('id, nome, twitch_username, twitch_user_id, display_name_canonical, is_active')
        .eq('twitch_user_id', twitch_user_id)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        canonicalProfile = data;
      }
    }

    // 2. Se não encontrou, buscar por alias
    if (!canonicalProfile && searchTerm) {
      const { data: aliases } = await supabaseClient
        .from('user_aliases')
        .select('user_id, old_display_name, old_login, twitch_user_id')
        .or(`old_display_name.ilike.%${searchTerm}%,old_login.ilike.%${searchTerm}%`)
        .limit(1);

      if (aliases && aliases.length > 0) {
        const { data } = await supabaseClient
          .from('profiles')
          .select('id, nome, twitch_username, twitch_user_id, display_name_canonical, is_active')
          .eq('id', aliases[0].user_id)
          .eq('is_active', true)
          .maybeSingle();

        if (data) {
          canonicalProfile = data;
        }
      }
    }

    // 3. Se não encontrou, buscar por nome (case-insensitive)
    if (!canonicalProfile && searchTerm) {
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, nome, twitch_username, twitch_user_id, display_name_canonical, is_active')
        .or(`nome.ilike.%${searchTerm}%,twitch_username.ilike.%${searchTerm}%,display_name_canonical.ilike.%${searchTerm}%`)
        .eq('is_active', true);

      if (profiles && profiles.length > 0) {
        // Se houver múltiplos perfis, priorizar por:
        // 1. Tem twitch_user_id
        // 2. Nome exato (case-insensitive)
        // 3. Mais antigo
        allDuplicates = profiles;

        canonicalProfile = profiles.find(p => p.twitch_user_id) || profiles[0];
      }
    }

    // Se não encontrou usuário existente, criar perfil temporário para permitir entrega de prêmios
    if (!canonicalProfile && searchTerm) {
      console.log(`🆕 Criando perfil temporário para usuário não encontrado: ${searchTerm}`);
      
      // Criar perfil temporário na tabela profiles
      const { data: newProfile, error: createError } = await supabaseClient
        .from('profiles')
        .insert({
          nome: searchTerm,
          twitch_username: searchTerm.toLowerCase(),
          display_name_canonical: searchTerm,
          is_active: true,
          is_temporary: true, // Flag para indicar que é um perfil temporário
          created_via: 'prize_delivery' // Indicar como foi criado
        })
        .select('id, nome, twitch_username, twitch_user_id, display_name_canonical, is_active')
        .single();

      if (createError) {
        console.error('❌ Erro ao criar perfil temporário:', createError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao criar perfil temporário para usuário',
            canonicalProfile: null,
            hasDuplicates: false
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      canonicalProfile = newProfile;
      console.log(`✅ Perfil temporário criado com sucesso:`, {
        id: canonicalProfile.id,
        nome: canonicalProfile.nome,
        isTemporary: true
      });
    }

    if (!canonicalProfile) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Usuário não encontrado e não foi possível criar perfil temporário',
          canonicalProfile: null,
          hasDuplicates: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // 4. Buscar saldos consolidados (caso haja duplicatas)
    let consolidatedBalances = {
      rubini_coins: 0,
      tickets: 0
    };

    const profileIds = allDuplicates.length > 0 
      ? allDuplicates.map(p => p.id) 
      : [canonicalProfile.id];

    // Buscar Rubini Coins
    const { data: rcBalances } = await supabaseClient
      .from('rubini_coins_balance')
      .select('user_id, saldo')
      .in('user_id', profileIds);

    if (rcBalances) {
      consolidatedBalances.rubini_coins = rcBalances.reduce((sum, b) => sum + (b.saldo || 0), 0);
    }

    // Buscar Tickets
    const { data: ticketBalances } = await supabaseClient
      .from('tickets')
      .select('user_id, tickets_atual')
      .in('user_id', profileIds);

    if (ticketBalances) {
      consolidatedBalances.tickets = ticketBalances.reduce((sum, t) => sum + (t.tickets_atual || 0), 0);
    }

    // 5. Buscar aliases do usuário canônico
    const { data: userAliases } = await supabaseClient
      .from('user_aliases')
      .select('old_display_name, old_login, changed_at')
      .eq('user_id', canonicalProfile.id)
      .order('changed_at', { ascending: false })
      .limit(10);

    return new Response(
      JSON.stringify({
        success: true,
        canonicalProfile: {
          id: canonicalProfile.id,
          nome: canonicalProfile.nome,
          twitch_username: canonicalProfile.twitch_username,
          twitch_user_id: canonicalProfile.twitch_user_id,
          display_name_canonical: canonicalProfile.display_name_canonical,
        },
        consolidatedBalances,
        aliases: userAliases || [],
        hasDuplicates: allDuplicates.length > 1,
        duplicateProfiles: allDuplicates.length > 1 ? allDuplicates.map(p => ({
          id: p.id,
          nome: p.nome,
          twitch_username: p.twitch_username,
        })) : []
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
