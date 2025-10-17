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
      console.log('🔍 Checking Twitch auth...');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-auth-me`,
        {
          method: 'POST',
          credentials: 'include', // IMPORTANTE: Envia cookies
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const data = await response.json();
      console.log('📦 Auth response:', data);

      if (data.success && data.user) {
        console.log('✅ User authenticated:', data.user.display_name);
        setUser(data.user);
      } else {
        console.log('❌ Not authenticated');
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
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-auth-logout`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return { user, loading, logout, refreshAuth: checkAuth };
}
