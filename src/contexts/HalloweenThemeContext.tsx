import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-helper';
import profileImageDefault from "@/assets/profile-miguelnut.png";

interface HalloweenThemeContextType {
  isHalloweenActive: boolean;
  toggleHalloween: () => Promise<void>;
  loading: boolean;
  headerProfileImage: string;
  updateHeaderImage: (imageUrl: string) => Promise<void>;
  themeLock: 'light' | 'dark' | null;
  updateThemeLock: (lock: 'light' | 'dark' | null) => Promise<void>;
}

const HalloweenThemeContext = createContext<HalloweenThemeContextType | undefined>(undefined);

export const HalloweenThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHalloweenActive, setIsHalloweenActive] = useState(false);
  const [headerProfileImage, setHeaderProfileImage] = useState(profileImageDefault);
  const [themeLock, setThemeLock] = useState<'light' | 'dark' | null>(null);
  const [loading, setLoading] = useState(true);

  // Buscar configuração inicial do banco
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('halloween_mode_enabled, header_profile_image_url, theme_lock')
          .single();

        if (error) throw error;
        
        if (data) {
          setIsHalloweenActive(data.halloween_mode_enabled || false);
          setThemeLock(data.theme_lock || null);
          // Se a URL for válida e começar com data:image, usar ela, senão usar padrão
          const imageUrl = data.header_profile_image_url;
          if (imageUrl && imageUrl.startsWith('data:image/')) {
            setHeaderProfileImage(imageUrl);
          } else {
            setHeaderProfileImage(profileImageDefault);
          }
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
            if ('theme_lock' in payload.new) {
              setThemeLock(payload.new.theme_lock || null);
            }
            if ('header_profile_image_url' in payload.new) {
              const imageUrl = payload.new.header_profile_image_url;
              if (imageUrl && imageUrl.startsWith('data:image/')) {
                setHeaderProfileImage(imageUrl);
              } else {
                setHeaderProfileImage(profileImageDefault);
              }
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

  const updateThemeLock = async (lock: 'light' | 'dark' | null) => {
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({ theme_lock: lock })
        .eq('id', (await supabase.from('site_settings').select('id').single()).data?.id);

      if (error) throw error;
      
      // O estado será atualizado via realtime subscription
    } catch (error) {
      console.error('Erro ao atualizar bloqueio de tema:', error);
      throw error;
    }
  };

  return (
    <HalloweenThemeContext.Provider value={{ 
      isHalloweenActive, 
      toggleHalloween, 
      loading, 
      headerProfileImage,
      updateHeaderImage,
      themeLock,
      updateThemeLock
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
