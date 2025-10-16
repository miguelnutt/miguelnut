import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-helper";

export const useTwitchStatus = () => {
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkTwitchStatus();
    
    // Verifica a cada 2 minutos
    const interval = setInterval(checkTwitchStatus, 120000);
    
    return () => clearInterval(interval);
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

  return { isLive, loading };
};
