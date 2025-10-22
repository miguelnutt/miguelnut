import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase-helper";
import { useAuth } from "@/contexts/AuthContext";
import { TwitchUser } from "./useTwitchAuth";

export function useDailyRewardStatus(
  twitchUser: TwitchUser | undefined | null,
  onClaimSuccess?: () => void // Callback para invalidar após claim
) {
  const { authReady, sessionUserId } = useAuth();
  const [hasRewardAvailable, setHasRewardAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userIdFromSession, setUserIdFromSession] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const lastCheckRef = useRef<string | null>(null);

  // Buscar userId da sessão se não tiver twitchUser
  useEffect(() => {
    if (!authReady || twitchUser) return;

    const fetchSessionUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserIdFromSession(session.user.id);
      }
    };

    fetchSessionUserId();
  }, [authReady, twitchUser]);

  // Verificar se a recompensa está disponível
  useEffect(() => {
    if (!authReady) {
      console.log('[DailyReward] Auth não está pronto, aguardando...');
      return;
    }

    if (!twitchUser && !userIdFromSession && !sessionUserId) {
      console.log('[DailyReward] Nenhum identificador disponível');
      setHasRewardAvailable(false);
      setLoading(false);
      return;
    }

    console.log('[DailyReward] Verificando recompensa disponível...');
    checkRewardStatus();

    // Verificar a cada 60 segundos
    const interval = setInterval(checkRewardStatus, 60000);

    // Subscrever mudanças em user_daily_logins
    const channel = supabase
      .channel("daily_logins_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_daily_logins",
        },
        () => {
          console.log('[DailyReward] Mudança detectada em user_daily_logins');
          checkRewardStatus();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [authReady, twitchUser?.twitch_user_id, userIdFromSession, sessionUserId]);

  const checkRewardStatus = async () => {
    // Single-flight: evitar chamadas concorrentes
    if (isFetchingRef.current) {
      console.log('[DailyReward] Verificação já em andamento, ignorando chamada duplicada');
      return;
    }

    try {
      isFetchingRef.current = true;
      let userId: string | null = null;

      // Buscar perfil por twitch_user_id primeiro (identidade canônica)
      if (twitchUser?.twitch_user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("twitch_user_id", twitchUser.twitch_user_id)
          .maybeSingle();
        
        if (profile) {
          userId = profile.id;
        }
      }

      // Se não encontrou por twitch_user_id, usar userId da sessão
      if (!userId && (userIdFromSession || sessionUserId)) {
        userId = userIdFromSession || sessionUserId;
      }

      // Se ainda não tem userId, não fazer nada
      if (!userId) {
        setHasRewardAvailable(false);
        setLoading(false);
        return;
      }

      // Resetar debounce ao forçar nova verificação
      lastCheckRef.current = userId;

      console.log('[DailyReward] Verificando recompensa para userId:', userId);

      const token = localStorage.getItem('twitch_token');
      if (!token) {
        setHasRewardAvailable(false);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-daily-login-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ userId }),
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
      isFetchingRef.current = false;
    }
  };

  // Expor método para forçar re-verificação (chamado após claim)
  const forceRefresh = () => {
    console.log('[DailyReward] Forçando refresh após claim...');
    setHasRewardAvailable(false);
    checkRewardStatus();
  };

  return { hasRewardAvailable, loading, forceRefresh };
}
