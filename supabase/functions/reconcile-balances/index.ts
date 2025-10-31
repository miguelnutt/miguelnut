import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReconciliationRequest {
  userId?: string;
  dryRun?: boolean;
  fixInconsistencies?: boolean;
}

interface ReconciliationResult {
  userId: string;
  username: string;
  currentBalance: number;
  calculatedBalance: number;
  isConsistent: boolean;
  difference: number;
  fixed?: boolean;
  error?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, dryRun = true, fixInconsistencies = false }: ReconciliationRequest = await req.json()

    console.log('🔍 [RECONCILIATION] Starting balance reconciliation:', {
      userId,
      dryRun,
      fixInconsistencies
    })

    let results: ReconciliationResult[] = []

    if (userId) {
      // Reconciliar um usuário específico
      const result = await reconcileUserBalance(supabase, userId, dryRun, fixInconsistencies)
      results = [result]
    } else {
      // Reconciliar todos os usuários
      results = await reconcileAllBalances(supabase, dryRun, fixInconsistencies)
    }

    const summary = {
      totalUsers: results.length,
      consistentUsers: results.filter(r => r.isConsistent).length,
      inconsistentUsers: results.filter(r => !r.isConsistent).length,
      fixedUsers: results.filter(r => r.fixed).length,
      totalDifference: results.reduce((sum, r) => sum + Math.abs(r.difference), 0)
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
        dryRun
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ [RECONCILIATION] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

async function reconcileUserBalance(
  supabase: any,
  userId: string,
  dryRun: boolean,
  fixInconsistencies: boolean
): Promise<ReconciliationResult> {
  try {
    // Buscar informações do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name_canonical')
      .eq('id', userId)
      .single()

    if (!profile) {
      throw new Error(`User ${userId} not found`)
    }

    // Usar a função SQL para verificar consistência
    const { data: consistencyData, error: consistencyError } = await supabase
      .rpc('check_ticket_balance_consistency', { p_user_id: userId })

    if (consistencyError) {
      throw consistencyError
    }

    const result: ReconciliationResult = {
      userId,
      username: profile.display_name_canonical || 'Unknown',
      currentBalance: consistencyData.current_balance || 0,
      calculatedBalance: consistencyData.calculated_balance || 0,
      isConsistent: consistencyData.is_consistent || false,
      difference: (consistencyData.current_balance || 0) - (consistencyData.calculated_balance || 0)
    }

    // Se não está consistente e deve corrigir
    if (!result.isConsistent && fixInconsistencies && !dryRun) {
      try {
        const { error: reconcileError } = await supabase
          .rpc('reconcile_ticket_balance', { p_user_id: userId })

        if (reconcileError) {
          result.error = reconcileError.message
        } else {
          result.fixed = true
          console.log(`✅ [RECONCILIATION] Fixed balance for user ${userId}`)
        }
      } catch (error) {
        result.error = error.message
        console.error(`❌ [RECONCILIATION] Failed to fix balance for user ${userId}:`, error)
      }
    }

    return result

  } catch (error) {
    return {
      userId,
      username: 'Error',
      currentBalance: 0,
      calculatedBalance: 0,
      isConsistent: false,
      difference: 0,
      error: error.message
    }
  }
}

async function reconcileAllBalances(
  supabase: any,
  dryRun: boolean,
  fixInconsistencies: boolean
): Promise<ReconciliationResult[]> {
  // Buscar todos os usuários que têm tickets
  const { data: users, error: usersError } = await supabase
    .from('tickets')
    .select(`
      user_id,
      profiles!inner(display_name_canonical)
    `)
    .not('user_id', 'is', null)

  if (usersError) {
    throw usersError
  }

  console.log(`🔍 [RECONCILIATION] Found ${users.length} users with ticket balances`)

  const results: ReconciliationResult[] = []
  const batchSize = 10 // Processar em lotes para evitar sobrecarga

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize)
    const batchPromises = batch.map(user => 
      reconcileUserBalance(supabase, user.user_id, dryRun, fixInconsistencies)
    )

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    console.log(`📊 [RECONCILIATION] Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(users.length/batchSize)}`)
  }

  return results
}