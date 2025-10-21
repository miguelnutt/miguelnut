import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase-helper";
import { useAuth } from "@/contexts/AuthContext";

export function useDailyRewardStatus(twitchUsername: string | undefined) {
  const { authReady, sessionUserId } = useAuth();
  const [hasRewardAvailable, setHasRewardAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userIdFromSession, setUserIdFromSession] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const lastCheckRef = useRef<string | null>(null);

  // Buscar userId da sessão se não tiver twitchUsername
  useEffect(() => {
    const getUserIdFromSession = async () => {
      if (twitchUsername) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserIdFromSession(session.user.id);
      }
    };
    
    getUserIdFromSession();
  }, [twitchUsername]);

  useEffect(() => {
    // GATE: Só verificar quando auth estiver pronto
    if (!authReady) {
      console.log('[DailyReward] Auth não está pronto, aguardando...');
      setLoading(false);
      return;
    }

    // Só verificar se tiver twitchUsername OU userId da sessão
    if (!twitchUsername && !userIdFromSession && !sessionUserId) {
      console.log('[DailyReward] Nenhum identificador de usuário disponível');
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
  }, [twitchUsername, userIdFromSession, authReady, sessionUserId]);

  const checkRewardStatus = async () => {
    // Single-flight: evitar chamadas concorrentes
    if (isFetchingRef.current) {
      console.log('[DailyReward] Verificação já em andamento, ignorando chamada duplicada');
      return;
    }

    try {
      isFetchingRef.current = true;
      let userId: string | null = null;

      // Tentar buscar perfil por twitch_username primeiro
      if (twitchUsername) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("twitch_username", twitchUsername)
          .maybeSingle();
        
        if (profile) {
          userId = profile.id;
        }
      }

      // Se não encontrou por twitchUsername, usar userId da sessão
      if (!userId && (userIdFromSession || sessionUserId)) {
        userId = userIdFromSession || sessionUserId;
      }

      // Se ainda não tem userId, não fazer nada
      if (!userId) {
        setHasRewardAvailable(false);
        setLoading(false);
        return;
      }

      // Debounce: evitar verificações duplicadas para o mesmo userId
      if (lastCheckRef.current === userId) {
        console.log('[DailyReward] Verificação já feita para este userId, ignorando');
        return;
      }
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

  return { hasRewardAvailable, loading };
}
