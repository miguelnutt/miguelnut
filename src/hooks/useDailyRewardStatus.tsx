import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-helper";

export function useDailyRewardStatus(userId: string | undefined) {
  const [hasRewardAvailable, setHasRewardAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setHasRewardAvailable(false);
      setLoading(false);
      return;
    }

    checkRewardStatus();

    // Atualizar quando houver mudanças na tabela de logins
    const channel = supabase
      .channel('daily_reward_status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_daily_logins',
          filter: `user_id=eq.${userId}`
        },
        () => {
          checkRewardStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const checkRewardStatus = async () => {
    if (!userId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-daily-login-status`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Se pode resgatar, mostrar notificação
        setHasRewardAvailable(data.pode_resgatar === true);
      }
    } catch (error) {
      console.error("Erro ao verificar status da recompensa:", error);
    } finally {
      setLoading(false);
    }
  };

  return { hasRewardAvailable, loading };
}
