import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-helper';
import profileImageDefault from "@/assets/profile-miguelnut.png";

interface HalloweenThemeContextType {
  isHalloweenActive: boolean;
  toggleHalloween: () => Promise<void>;
  loading: boolean;
  headerProfileImage: string;
  updateHeaderImage: (imageUrl: string) => Promise<void>;
}

const HalloweenThemeContext = createContext<HalloweenThemeContextType | undefined>(undefined);

export const HalloweenThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHalloweenActive, setIsHalloweenActive] = useState(false);
  const [headerProfileImage, setHeaderProfileImage] = useState(profileImageDefault);
  const [loading, setLoading] = useState(true);

  // Buscar configuração inicial do banco
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('halloween_mode_enabled, header_profile_image_url')
          .single();

        if (error) throw error;
        
        if (data) {
          setIsHalloweenActive(data.halloween_mode_enabled || false);
          setHeaderProfileImage(data.header_profile_image_url || profileImageDefault);
        }
      } catch (error) {
        console.error('Erro ao buscar configurações:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

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
          if (payload.new) {
            if ('halloween_mode_enabled' in payload.new) {
              setIsHalloweenActive(payload.new.halloween_mode_enabled || false);
            }
            if ('header_profile_image_url' in payload.new) {
              setHeaderProfileImage(payload.new.header_profile_image_url || profileImageDefault);
            }
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

  const updateHeaderImage = async (imageUrl: string) => {
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({ header_profile_image_url: imageUrl })
        .eq('id', (await supabase.from('site_settings').select('id').single()).data?.id);

      if (error) throw error;
      
      // O estado será atualizado via realtime subscription
    } catch (error) {
      console.error('Erro ao atualizar imagem do header:', error);
      throw error;
    }
  };

  return (
    <HalloweenThemeContext.Provider value={{ 
      isHalloweenActive, 
      toggleHalloween, 
      loading, 
      headerProfileImage,
      updateHeaderImage
    }}>
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
