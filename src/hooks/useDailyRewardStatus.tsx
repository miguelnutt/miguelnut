import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-helper";

export function useDailyRewardStatus(twitchUsername: string | undefined) {
  const [hasRewardAvailable, setHasRewardAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!twitchUsername) {
      console.log('[DailyReward] Sem twitchUsername, pulando verificação');
      setHasRewardAvailable(false);
      setLoading(false);
      return;
    }

    checkRewardStatus();

    // Ouvir mudanças na tabela user_daily_logins para atualizar em tempo real
    const channel = supabase
      .channel('daily_login_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_daily_logins'
        },
        () => {
          console.log('[DailyReward] Detectou mudança em user_daily_logins, atualizando...');
          checkRewardStatus();
        }
      )
      .subscribe();

    // Atualizar a cada 30 segundos também
    const interval = setInterval(checkRewardStatus, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [twitchUsername]);

  const checkRewardStatus = async () => {
    if (!twitchUsername) {
      console.log('[DailyReward] Sem twitchUsername, pulando verificação');
      return;
    }

    console.log('[DailyReward] Verificando status para twitchUsername:', twitchUsername);

    try {
      // Buscar perfil pelo twitch_username
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("twitch_username", twitchUsername)
        .maybeSingle();

      if (!profile?.id) {
        console.log('[DailyReward] Perfil não encontrado');
        setHasRewardAvailable(false);
        setLoading(false);
        return;
      }

      console.log('[DailyReward] Perfil encontrado, userId:', profile.id);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-daily-login-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ userId: profile.id }),
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
        const errorText = await response.text();
        console.error('[DailyReward] Erro na resposta:', errorText);
      }
    } catch (error) {
      console.error("[DailyReward] Erro ao verificar status da recompensa:", error);
    } finally {
      setLoading(false);
    }
  };

  return { hasRewardAvailable, loading };
}
