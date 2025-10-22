import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para forçar refresh de saldos (Tickets e Rubini Coins)
 * após operações de recompensa
 */
export function useBalanceRefresh() {
  const refreshBalances = useCallback(async (userId: string) => {
    if (!userId) return;

    try {
      // Força re-fetch de tickets
      const ticketsChannel = supabase.channel(`balance-refresh-tickets-${Date.now()}`);
      await ticketsChannel.send({
        type: 'broadcast',
        event: 'balance-updated',
        payload: { userId, type: 'tickets' }
      });
      supabase.removeChannel(ticketsChannel);

      // Força re-fetch de rubini coins
      const rcChannel = supabase.channel(`balance-refresh-rc-${Date.now()}`);
      await rcChannel.send({
        type: 'broadcast',
        event: 'balance-updated',
        payload: { userId, type: 'rubini_coins' }
      });
      supabase.removeChannel(rcChannel);

      console.log('✅ Balance refresh triggered for user:', userId);
    } catch (error) {
      console.error('Error triggering balance refresh:', error);
    }
  }, []);

  return { refreshBalances };
}
