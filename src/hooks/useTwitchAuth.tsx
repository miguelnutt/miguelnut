import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TwitchUser {
  twitch_user_id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  email?: string;
}

export function useTwitchAuth() {
  const [user, setUser] = useState<TwitchUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('twitch-auth-me', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;

      if (data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.functions.invoke('twitch-auth-logout');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return { user, loading, logout, refreshAuth: checkAuth };
}
