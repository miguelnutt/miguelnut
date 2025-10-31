import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MetricsRequest {
  timeRange?: '1h' | '24h' | '7d' | '30d';
  includeDetails?: boolean;
}

interface TicketMetrics {
  totalTicketsAwarded: number;
  totalSpins: number;
  uniqueUsers: number;
  averageTicketsPerSpin: number;
  topUsers: Array<{
    username: string;
    totalTickets: number;
    totalSpins: number;
  }>;
  recentActivity: Array<{
    timestamp: string;
    username: string;
    ticketsAwarded: number;
    wheelName: string;
  }>;
  errorRate: number;
  inconsistentBalances: number;
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

    const { timeRange = '24h', includeDetails = true }: MetricsRequest = await req.json()

    console.log('📊 [MONITORING] Collecting metrics for timeRange:', timeRange)

    // Calcular o timestamp de início baseado no timeRange
    const now = new Date()
    const startTime = new Date()
    
    switch (timeRange) {
      case '1h':
        startTime.setHours(now.getHours() - 1)
        break
      case '24h':
        startTime.setDate(now.getDate() - 1)
        break
      case '7d':
        startTime.setDate(now.getDate() - 7)
        break
      case '30d':
        startTime.setDate(now.getDate() - 30)
        break
    }

    const metrics: TicketMetrics = {
      totalTicketsAwarded: 0,
      totalSpins: 0,
      uniqueUsers: 0,
      averageTicketsPerSpin: 0,
      topUsers: [],
      recentActivity: [],
      errorRate: 0,
      inconsistentBalances: 0
    }

    // 1. Métricas básicas de spins
    const { data: spinsData, error: spinsError } = await supabase
      .from('spins')
      .select(`
        id,
        created_at,
        nome_usuario,
        tipo_recompensa,
        valor,
        wheels!inner(nome)
      `)
      .gte('created_at', startTime.toISOString())
      .eq('tipo_recompensa', 'Tickets')

    if (spinsError) {
      throw spinsError
    }

    metrics.totalSpins = spinsData.length
    metrics.uniqueUsers = new Set(spinsData.map(spin => spin.nome_usuario)).size
    metrics.totalTicketsAwarded = spinsData.reduce((sum, spin) => sum + parseInt(spin.valor || '0'), 0)
    metrics.averageTicketsPerSpin = metrics.totalSpins > 0 ? metrics.totalTicketsAwarded / metrics.totalSpins : 0

    // 2. Top usuários (se incluir detalhes)
    if (includeDetails) {
      const userStats = new Map<string, { tickets: number, spins: number }>()
      
      spinsData.forEach(spin => {
        const username = spin.nome_usuario
        const tickets = parseInt(spin.valor || '0')
        
        if (!userStats.has(username)) {
          userStats.set(username, { tickets: 0, spins: 0 })
        }
        
        const stats = userStats.get(username)!
        stats.tickets += tickets
        stats.spins += 1
      })

      metrics.topUsers = Array.from(userStats.entries())
        .map(([username, stats]) => ({
          username,
          totalTickets: stats.tickets,
          totalSpins: stats.spins
        }))
        .sort((a, b) => b.totalTickets - a.totalTickets)
        .slice(0, 10)

      // 3. Atividade recente
      metrics.recentActivity = spinsData
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)
        .map(spin => ({
          timestamp: spin.created_at,
          username: spin.nome_usuario,
          ticketsAwarded: parseInt(spin.valor || '0'),
          wheelName: spin.wheels?.nome || 'Unknown'
        }))
    }

    // 4. Verificar inconsistências de saldo usando a nova função SQL
    const { data: balanceConsistency, error: consistencyError } = await supabase
      .rpc('check_all_ticket_balances_consistency')

    if (consistencyError) {
      console.error('Error checking balance consistency:', consistencyError)
    }

    const inconsistentCount = balanceConsistency?.filter(balance => !balance.is_consistent).length || 0
    const totalBalanceDiscrepancy = balanceConsistency?.reduce((sum, balance) => 
      sum + Math.abs(balance.difference || 0), 0) || 0
    
    metrics.inconsistentBalances = inconsistentCount

    // 5. Taxa de erro (baseada em logs de erro recentes)
    const { data: errorLogs, error: errorLogsError } = await supabase
      .from('spins')
      .select('id')
      .gte('created_at', startTime.toISOString())
      .is('user_id', null) // Spins sem user_id podem indicar erros

    if (!errorLogsError && errorLogs) {
      metrics.errorRate = metrics.totalSpins > 0 ? (errorLogs.length / metrics.totalSpins) * 100 : 0
    }

    // 6. Métricas adicionais de sistema
    const { data: activeWheelsCount } = await supabase
      .from('wheels')
      .select('id')
      .eq('is_active', true)

    const { data: totalUsersCount } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)

    // Verificação de saúde do banco
    const { data: dbHealthCheck, error: dbHealthError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    const databaseHealth = !dbHealthError ? 'healthy' : 'error'

    // Última reconciliação
    const { data: lastReconciliationData } = await supabase
      .from('ticket_audit')
      .select('created_at')
      .eq('transaction_type', 'reconciliation')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()



    const response = {
      ticketMetrics: {
        totalTicketsAwarded: metrics.totalTicketsAwarded,
        totalSpins: metrics.totalSpins,
        uniqueUsers: metrics.uniqueUsers,
        averageTicketsPerSpin: Math.round(metrics.averageTicketsPerSpin * 100) / 100,
        topUsers: includeDetails ? metrics.topUsers : [],
        recentActivity: includeDetails ? metrics.recentActivity : [],
        errorRate: Math.round(metrics.errorRate * 100) / 100,
        inconsistentBalances: inconsistentCount,
        totalBalanceDiscrepancy
      },
      systemMetrics: {
        databaseHealth,
        activeWheels: activeWheelsCount?.length || 0,
        totalUsers: totalUsersCount?.length || 0,
        lastReconciliation: lastReconciliationData?.created_at || null
      },
      timeRange,
      generatedAt: now.toISOString()
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in monitoring-metrics function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
})