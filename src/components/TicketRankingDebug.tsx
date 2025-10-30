import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-helper';

interface TicketData {
  nome_usuario: string;
  valor: number;
  created_at: string;
  tipo_recompensa: string;
}

export default function TicketRankingDebug() {
  const [loading, setLoading] = useState(true);
  const [ticketCount, setTicketCount] = useState(0);

  useEffect(() => {
    fetchTicketData();
  }, []);

  const fetchTicketData = async () => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataInicio = hoje.toISOString();

      const { data: spinsTickets } = await supabase
        .from('spins')
        .select('nome_usuario, valor, created_at, tipo_recompensa')
        .eq('tipo_recompensa', 'Tickets')
        .gte('created_at', dataInicio);

      setTicketCount(spinsTickets?.length || 0);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar tickets:', error);
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
        zIndex: 9999
      }}>
        🔄 Carregando...
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
      zIndex: 9999
    }}>
      <h3>🎫 Debug Tickets</h3>
      <p>Tickets encontrados hoje: {ticketCount}</p>
      <button 
        onClick={fetchTicketData}
        style={{
          background: '#007bff',
          color: 'white',
          border: 'none',
          padding: '5px 10px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        🔄 Atualizar
      </button>
    </div>
  );
}