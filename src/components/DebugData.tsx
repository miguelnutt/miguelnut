import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-helper';

interface DebugInfo {
  totalSpins: number;
  totalTibiaTermoHistory: number;
  totalTickets: number;
  totalTicketLedger: number;
  tibiaempregoSpins: any[];
  tibiaempregoTibiaTermoHistory: any[];
  tibiaempregoProfile: any;
  todayTicketsFromSpins: any[];
  todayTicketsFromTibiaTermo: any[];
  rankingQuery: any[];
}

export default function DebugData() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDebugData();
  }, []);

  const fetchDebugData = async () => {
    try {
      // Contar totais
      const { count: spinsCount } = await supabase
        .from('spins')
        .select('*', { count: 'exact', head: true });

      const { count: tibiaTermoCount } = await supabase
        .from('tibiatermo_history')
        .select('*', { count: 'exact', head: true });

      const { count: ticketsCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true });

      const { count: ticketLedgerCount } = await supabase
        .from('ticket_ledger')
        .select('*', { count: 'exact', head: true });

      // Buscar dados específicos do usuário tibiaemprego
      const { data: tibiaempregoSpins } = await supabase
        .from('spins')
        .select('*')
        .ilike('nome_usuario', 'tibiaemprego')
        .order('created_at', { ascending: false });

      const { data: tibiaempregoTibiaTermoHistory } = await supabase
        .from('tibiatermo_history')
        .select('*')
        .ilike('nome_usuario', 'tibiaemprego')
        .order('created_at', { ascending: false });

      const { data: tibiaempregoProfile } = await supabase
        .from('profiles')
        .select('*')
        .or('nome.ilike.tibiaemprego,twitch_username.ilike.tibiaemprego,twitch_username.ilike.@tibiaemprego')
        .maybeSingle();

      // Buscar tickets de hoje - mesma query que o WheelRanking usa
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataInicio = hoje.toISOString();

      // Tickets de spins de hoje
      const { data: todayTicketsFromSpins } = await supabase
        .from('spins')
        .select('nome_usuario, valor, created_at, tipo_recompensa')
        .eq('tipo_recompensa', 'Tickets')
        .gte('created_at', dataInicio);

      // Tickets de TibiaTermo de hoje
      const { data: todayTicketsFromTibiaTermo } = await supabase
        .from('tibiatermo_history')
        .select('nome_usuario, valor, created_at, tipo_recompensa')
        .eq('tipo_recompensa', 'Tickets')
        .gte('created_at', dataInicio);

      // Simular a query do ranking
      const ticketsMap = new Map<string, number>();
      
      todayTicketsFromSpins?.forEach((spin) => {
        const valor = parseInt(spin.valor) || 0;
        ticketsMap.set(
          spin.nome_usuario,
          (ticketsMap.get(spin.nome_usuario) || 0) + valor
        );
      });

      todayTicketsFromTibiaTermo?.forEach((item) => {
        const valor = item.valor || 0;
        ticketsMap.set(
          item.nome_usuario,
          (ticketsMap.get(item.nome_usuario) || 0) + valor
        );
      });

      const rankingQuery = Array.from(ticketsMap.entries())
        .map(([twitch_username, total]) => ({ twitch_username, total }))
        .sort((a, b) => b.total - a.total);

      setDebugInfo({
        totalSpins: spinsCount || 0,
        totalTibiaTermoHistory: tibiaTermoCount || 0,
        totalTickets: ticketsCount || 0,
        totalTicketLedger: ticketLedgerCount || 0,
        tibiaempregoSpins: tibiaempregoSpins || [],
        tibiaempregoTibiaTermoHistory: tibiaempregoTibiaTermoHistory || [],
        tibiaempregoProfile: tibiaempregoProfile || null,
        todayTicketsFromSpins: todayTicketsFromSpins || [],
        todayTicketsFromTibiaTermo: todayTicketsFromTibiaTermo || [],
        rankingQuery: rankingQuery || []
      });
    } catch (error) {
      console.error('Erro ao buscar dados de debug:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Carregando dados de debug...</div>;
  }

  if (!debugInfo) {
    return <div>Erro ao carregar dados de debug</div>;
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '1px solid #ccc', 
      padding: '20px', 
      maxWidth: '600px',
      maxHeight: '80vh',
      overflow: 'auto',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <h3>Debug Data - Tickets Ranking</h3>
      
      <h4>Totais:</h4>
      <ul>
        <li>Spins: {debugInfo.totalSpins}</li>
        <li>TibiaTermo History: {debugInfo.totalTibiaTermoHistory}</li>
        <li>Tickets: {debugInfo.totalTickets}</li>
        <li>Ticket Ledger: {debugInfo.totalTicketLedger}</li>
      </ul>

      <h4>Tickets de HOJE - Spins ({debugInfo.todayTicketsFromSpins.length}):</h4>
      <pre>{JSON.stringify(debugInfo.todayTicketsFromSpins, null, 2)}</pre>

      <h4>Tickets de HOJE - TibiaTermo ({debugInfo.todayTicketsFromTibiaTermo.length}):</h4>
      <pre>{JSON.stringify(debugInfo.todayTicketsFromTibiaTermo, null, 2)}</pre>

      <h4>Ranking Calculado:</h4>
      <pre>{JSON.stringify(debugInfo.rankingQuery, null, 2)}</pre>

      <h4>Dados do usuário tibiaemprego:</h4>
      <h5>Profile:</h5>
      <pre>{JSON.stringify(debugInfo.tibiaempregoProfile, null, 2)}</pre>
      
      <h5>Todos os Spins:</h5>
      <pre>{JSON.stringify(debugInfo.tibiaempregoSpins, null, 2)}</pre>
      
      <h5>Todo TibiaTermo History:</h5>
      <pre>{JSON.stringify(debugInfo.tibiaempregoTibiaTermoHistory, null, 2)}</pre>
    </div>
  );
}