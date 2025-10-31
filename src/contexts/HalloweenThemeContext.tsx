import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-helper';

interface HalloweenThemeContextType {
  isHalloweenActive: boolean;
  toggleHalloween: () => Promise<void>;
  loading: boolean;
}

const HalloweenThemeContext = createContext<HalloweenThemeContextType | undefined>(undefined);

export const HalloweenThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHalloweenActive, setIsHalloweenActive] = useState(false);
  const [loading, setLoading] = useState(true);

  // Buscar configuração inicial do banco
  useEffect(() => {
    const fetchHalloweenStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('halloween_mode_enabled')
          .single();

        if (error) throw error;
        
        if (data) {
          setIsHalloweenActive(data.halloween_mode_enabled || false);
        }
      } catch (error) {
        console.error('Erro ao buscar status do Halloween:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHalloweenStatus();

    // Subscrever para mudanças em tempo real
    const channel = supabase
      .channel('site_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'site_settings',
        },
        (payload) => {
          if (payload.new && 'halloween_mode_enabled' in payload.new) {
            setIsHalloweenActive(payload.new.halloween_mode_enabled || false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Aplicar ou remover classes do tema Halloween
  useEffect(() => {
    if (isHalloweenActive) {
      document.documentElement.classList.add('halloween-theme');
    } else {
      document.documentElement.classList.remove('halloween-theme');
    }
  }, [isHalloweenActive]);

  const toggleHalloween = async () => {
    const newValue = !isHalloweenActive;
    
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({ halloween_mode_enabled: newValue })
        .eq('id', (await supabase.from('site_settings').select('id').single()).data?.id);

      if (error) throw error;
      
      // O estado será atualizado via realtime subscription
    } catch (error) {
      console.error('Erro ao alternar tema Halloween:', error);
      throw error;
    }
  };

  return (
    <HalloweenThemeContext.Provider value={{ isHalloweenActive, toggleHalloween, loading }}>
      {children}
    </HalloweenThemeContext.Provider>
  );
};

export const useHalloweenTheme = () => {
  const context = useContext(HalloweenThemeContext);
  if (context === undefined) {
    throw new Error('useHalloweenTheme must be used within a HalloweenThemeProvider');
  }
  return context;
};
