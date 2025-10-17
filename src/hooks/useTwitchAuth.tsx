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
      const token = localStorage.getItem('twitch_token');
      
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-auth-me`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const data = await response.json();

      if (data.success && data.user) {
        setUser(data.user);
      } else {
        localStorage.removeItem('twitch_token');
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      localStorage.removeItem('twitch_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('twitch_token');
      setUser(null);
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-auth-logout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return { user, loading, logout, refreshAuth: checkAuth };
}
