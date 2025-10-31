import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetricsRequest {
  timeRange: '24h' | '7d' | '30d';
  includeDetails?: boolean;
}

interface TicketMetrics {
  totalTicketsAwarded: number;
  averageTicketsPerSpin: number;
  topUsers: Array<{ username: string; tickets: number }>;
  recentActivity: Array<{ username: string; tickets: number; timestamp: string }>;
  inconsistentCount: number;
  totalBalanceDiscrepancy: number;
  inconsistentBalances: Array<{
    user_id: string;
    username: string;
    current_balance: number;
    calculated_balance: number;
    difference: number;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { timeRange = '24h', includeDetails = false }: MetricsRequest = await req.json();

    // Calculate time range
    const now = new Date();
    const timeRangeHours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
    const startTime = new Date(now.getTime() - timeRangeHours * 60 * 60 * 1000);

    // Get total tickets awarded in time range
    const { data: ticketsData, error: ticketsError } = await supabase
      .from('tickets')
      .select('quantidade, user_id, created_at')
      .gte('created_at', startTime.toISOString());

    if (ticketsError) throw ticketsError;

    const totalTicketsAwarded = ticketsData?.reduce((sum, ticket) => sum + ticket.quantidade, 0) || 0;

    // Get spins data for average calculation
    const { data: spinsData, error: spinsError } = await supabase
      .from('spins')
      .select('user_id, created_at')
      .gte('created_at', startTime.toISOString());

    if (spinsError) throw spinsError;

    const totalSpins = spinsData?.length || 0;
    const averageTicketsPerSpin = totalSpins > 0 ? totalTicketsAwarded / totalSpins : 0;

    // Get top users by tickets in time range
    const userTickets = new Map<string, number>();
    for (const ticket of ticketsData || []) {
      if (ticket.user_id) {
        userTickets.set(ticket.user_id, (userTickets.get(ticket.user_id) || 0) + ticket.quantidade);
      }
    }

    const topUserIds = Array.from(userTickets.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId]) => userId);

    // Get usernames for top users
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('id, nome_personagem, display_name')
      .in('id', topUserIds);

    if (usersError) throw usersError;

    const userMap = new Map(usersData?.map(user => [user.id, user.nome_personagem || user.display_name || 'Unknown']) || []);

    const topUsers = Array.from(userTickets.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, tickets]) => ({
        username: userMap.get(userId) || 'Unknown',
        tickets
      }));

    // Get recent activity
    const recentTickets = ticketsData
      ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20) || [];

    const recentUserIds = [...new Set(recentTickets.map(t => t.user_id).filter(Boolean))];
    const { data: recentUsersData } = await supabase
      .from('profiles')
      .select('id, nome_personagem, display_name')
      .in('id', recentUserIds);

    const recentUserMap = new Map(recentUsersData?.map(user => [user.id, user.nome_personagem || user.display_name || 'Unknown']) || []);

    const recentActivity = recentTickets.map(ticket => ({
      username: recentUserMap.get(ticket.user_id) || 'Unknown',
      tickets: ticket.quantidade,
      timestamp: ticket.created_at
    }));

    // Check ticket balance consistency
    const { data: consistencyData, error: consistencyError } = await supabase
      .rpc('check_all_ticket_balances_consistency');

    let inconsistentCount = 0;
    let totalBalanceDiscrepancy = 0;
    let inconsistentBalances: any[] = [];

    if (!consistencyError && consistencyData) {
      inconsistentBalances = consistencyData.filter((item: any) => !item.is_consistent);
      inconsistentCount = inconsistentBalances.length;
      totalBalanceDiscrepancy = inconsistentBalances.reduce((sum: number, item: any) => 
        sum + Math.abs(item.difference), 0);
    }

    // Calculate error rate (spins without user_id)
    const spinsWithoutUser = spinsData?.filter(spin => !spin.user_id).length || 0;
    const errorRate = totalSpins > 0 ? (spinsWithoutUser / totalSpins) * 100 : 0;

    // System metrics
    const { data: wheelsData } = await supabase.from('wheels').select('id');
    const { data: profilesData } = await supabase.from('profiles').select('id');
    
    // Get last reconciliation (most recent ticket transaction)
    const { data: lastTicket } = await supabase
      .from('tickets')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    const ticketMetrics: TicketMetrics = {
      totalTicketsAwarded,
      averageTicketsPerSpin: Math.round(averageTicketsPerSpin * 100) / 100,
      topUsers,
      recentActivity,
      inconsistentCount,
      totalBalanceDiscrepancy,
      inconsistentBalances: includeDetails ? inconsistentBalances : []
    };

    const systemMetrics = {
      databaseHealth: "healthy", // Could be enhanced with actual health checks
      activeWheels: wheelsData?.length || 0,
      totalUsers: profilesData?.length || 0,
      errorRate: Math.round(errorRate * 100) / 100,
      lastReconciliation: lastTicket?.[0]?.created_at || null
    };

    return new Response(JSON.stringify({
      ticketMetrics,
      systemMetrics
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in monitoring metrics:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});