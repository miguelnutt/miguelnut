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
    if (!userId) {
      console.log('[DailyReward] Sem userId, pulando verificação');
      return;
    }

    console.log('[DailyReward] Verificando status para userId:', userId);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-daily-login-status`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      console.log('[DailyReward] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[DailyReward] Resposta da API:', data);
        console.log('[DailyReward] pode_resgatar:', data.pode_resgatar);
        
        // Se pode resgatar, mostrar notificação
        const hasReward = data.pode_resgatar === true;
        console.log('[DailyReward] hasRewardAvailable será:', hasReward);
        setHasRewardAvailable(hasReward);
      } else {
        console.error('[DailyReward] Erro na resposta:', await response.text());
      }
    } catch (error) {
      console.error("[DailyReward] Erro ao verificar status da recompensa:", error);
    } finally {
      setLoading(false);
    }
  };

  return { hasRewardAvailable, loading };
}
