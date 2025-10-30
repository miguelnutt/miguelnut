import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-helper';

interface TicketData {
  nome_usuario: string;
  valor: number;
  created_at: string;
  tipo_recompensa: string;
  origem: string;
}

export default function TicketRankingDebug() {
  const [ticketData, setTicketData] = useState<{
    spinsTickets: TicketData[];
    tibiaTermoTickets: TicketData[];
    rankingCalculado: { twitch_username: string; total: number }[];
    tibiaempregoData: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTicketData();
  }, []);

  const fetchTicketData = async () => {
    try {
      // Data de hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataInicio = hoje.toISOString();

      console.log('🔍 Buscando tickets de hoje desde:', dataInicio);

      // Buscar tickets de spins de hoje
      const { data: spinsTickets, error: spinsError } = await supabase
        .from('spins')
        .select('nome_usuario, valor, created_at, tipo_recompensa')
        .eq('tipo_recompensa', 'Tickets')
        .gte('created_at', dataInicio);

      if (spinsError) {
        console.error('❌ Erro ao buscar spins tickets:', spinsError);
      } else {
        console.log('✅ Spins tickets encontrados:', spinsTickets?.length, spinsTickets);
      }

      // Buscar tickets de TibiaTermo de hoje
      const { data: tibiaTermoTickets, error: tibiaTermoError } = await supabase
        .from('tibiatermo_history')
        .select('nome_usuario, valor, created_at, tipo_recompensa')
        .eq('tipo_recompensa', 'Tickets')
        .gte('created_at', dataInicio);

      if (tibiaTermoError) {
        console.error('❌ Erro ao buscar TibiaTermo tickets:', tibiaTermoError);
      } else {
        console.log('✅ TibiaTermo tickets encontrados:', tibiaTermoTickets?.length, tibiaTermoTickets);
      }

      // Buscar dados específicos do tibiaemprego
      const { data: tibiaempregoProfile } = await supabase
        .from('profiles')
        .select('*')
        .or('nome.eq.tibiaemprego,twitch_username.eq.tibiaemprego,twitch_username.eq.@tibiaemprego')
        .maybeSingle();

      const { data: tibiaempregoSpins } = await supabase
        .from('spins')
        .select('*')
        .eq('nome_usuario', 'tibiaemprego')
        .gte('created_at', dataInicio);

      const { data: tibiaempregoTibiaTermo } = await supabase
        .from('tibiatermo_history')
        .select('*')
        .eq('nome_usuario', 'tibiaemprego')
        .gte('created_at', dataInicio);

      console.log('👤 Dados do tibiaemprego:', {
        profile: tibiaempregoProfile,
        spinsHoje: tibiaempregoSpins,
        tibiaTermoHoje: tibiaempregoTibiaTermo
      });

      // Calcular ranking como o WheelRanking faz
      const ticketsMap = new Map<string, number>();
      
      const spinsFormatted = (spinsTickets || []).map(item => ({
        ...item,
        origem: 'Spins'
      }));

      const tibiaTermoFormatted = (tibiaTermoTickets || []).map(item => ({
        ...item,
        origem: 'TibiaTermo'
      }));

      spinsFormatted.forEach((spin) => {
        const valor = parseInt(spin.valor.toString()) || 0;
        ticketsMap.set(
          spin.nome_usuario,
          (ticketsMap.get(spin.nome_usuario) || 0) + valor
        );
      });

      tibiaTermoFormatted.forEach((item) => {
        const valor = item.valor || 0;
        ticketsMap.set(
          item.nome_usuario,
          (ticketsMap.get(item.nome_usuario) || 0) + valor
        );
      });

      const rankingCalculado = Array.from(ticketsMap.entries())
        .map(([twitch_username, total]) => ({ twitch_username, total }))
        .sort((a, b) => b.total - a.total);

      console.log('🏆 Ranking calculado:', rankingCalculado);

      setTicketData({
        spinsTickets: spinsFormatted,
        tibiaTermoTickets: tibiaTermoFormatted,
        rankingCalculado,
        tibiaempregoData: {
          profile: tibiaempregoProfile,
          spinsHoje: tibiaempregoSpins,
          tibiaTermoHoje: tibiaempregoTibiaTermo
        }
      });
    } catch (error) {
      console.error('❌ Erro ao buscar dados de tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'white',
        border: '2px solid #007bff',
        padding: '20px',
        borderRadius: '8px',
        zIndex: 9999,
        fontSize: '14px'
      }}>
        🔄 Carregando dados de tickets...
      </div>
    );
  }

  if (!ticketData) {
    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'white',
        border: '2px solid #dc3545',
        padding: '20px',
        borderRadius: '8px',
        zIndex: 9999,
        fontSize: '14px'
      }}>
        ❌ Erro ao carregar dados
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'white',
      border: '2px solid #28a745',
      padding: '20px',
      borderRadius: '8px',
      maxWidth: '500px',
      maxHeight: '80vh',
      overflow: 'auto',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#28a745' }}>🎫 Debug Ranking de Tickets</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 5px 0' }}>📊 Resumo:</h4>
        <ul style={{ margin: '0', paddingLeft: '20px' }}>
          <li>Tickets de Spins hoje: <strong>{ticketData.spinsTickets.length}</strong></li>
          <li>Tickets de TibiaTermo hoje: <strong>{ticketData.tibiaTermoTickets.length}</strong></li>
          <li>Usuários no ranking: <strong>{ticketData.rankingCalculado.length}</strong></li>
        </ul>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 5px 0' }}>🏆 Top 5 Ranking:</h4>
        {ticketData.rankingCalculado.slice(0, 5).map((item, index) => (
          <div key={item.twitch_username} style={{ 
            padding: '2px 0', 
            backgroundColor: item.twitch_username === 'tibiaemprego' ? '#fff3cd' : 'transparent'
          }}>
            {index + 1}. <strong>{item.twitch_username}</strong>: {item.total} tickets
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 5px 0' }}>👤 Dados do tibiaemprego:</h4>
        <div style={{ fontSize: '11px' }}>
          <p><strong>Profile encontrado:</strong> {ticketData.tibiaempregoData.profile ? 'Sim' : 'Não'}</p>
          <p><strong>Spins hoje:</strong> {ticketData.tibiaempregoData.spinsHoje?.length || 0}</p>
          <p><strong>TibiaTermo hoje:</strong> {ticketData.tibiaempregoData.tibiaTermoHoje?.length || 0}</p>
          
          {ticketData.tibiaempregoData.profile && (
            <div>
              <p><strong>ID:</strong> {ticketData.tibiaempregoData.profile.id}</p>
              <p><strong>Nome:</strong> {ticketData.tibiaempregoData.profile.nome}</p>
              <p><strong>Twitch Username:</strong> {ticketData.tibiaempregoData.profile.twitch_username}</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 5px 0' }}>🎯 Tickets de Hoje (Detalhado):</h4>
        <div style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
          {[...ticketData.spinsTickets, ...ticketData.tibiaTermoTickets]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((ticket, index) => (
              <div key={index} style={{ 
                padding: '2px 0', 
                borderBottom: '1px solid #eee',
                backgroundColor: ticket.nome_usuario === 'tibiaemprego' ? '#fff3cd' : 'transparent'
              }}>
                <strong>{ticket.nome_usuario}</strong> - {ticket.valor} tickets ({ticket.origem}) - {new Date(ticket.created_at).toLocaleTimeString()}
              </div>
            ))}
        </div>
      </div>

      <button 
        onClick={fetchTicketData}
        style={{
          padding: '5px 10px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        🔄 Atualizar
      </button>
    </div>
  );
}