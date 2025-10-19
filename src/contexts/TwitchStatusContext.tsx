import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase-helper";

interface TwitchStatusContextType {
  isLive: boolean;
  loading: boolean;
}

const TwitchStatusContext = createContext<TwitchStatusContextType>({
  isLive: false,
  loading: true,
});

export const useTwitchStatus = () => {
  const context = useContext(TwitchStatusContext);
  if (!context) {
    throw new Error('useTwitchStatus deve ser usado dentro de TwitchStatusProvider');
  }
  return context;
};

interface TwitchStatusProviderProps {
  children: ReactNode;
}

export const TwitchStatusProvider = ({ children }: TwitchStatusProviderProps) => {
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkTwitchStatus();
    
    // Verifica a cada 2 minutos, MAS apenas se a aba estiver visível
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkTwitchStatus();
      }
    }, 120000);
    
    // Listener para quando a aba ficar visível novamente
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTwitchStatus();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const checkTwitchStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-twitch-status", {
        body: { username: "miguelnutt" }
      });

      if (error) {
        console.error("Error checking Twitch status:", error);
        setIsLive(false);
      } else {
        setIsLive(data?.isLive || false);
      }
    } catch (error) {
      console.error("Error:", error);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TwitchStatusContext.Provider value={{ isLive, loading }}>
      {children}
    </TwitchStatusContext.Provider>
  );
};
