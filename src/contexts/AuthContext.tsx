import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-helper';
import { useTwitchAuth, TwitchUser } from '@/hooks/useTwitchAuth';

type AuthStatus = 'loading' | 'ready' | 'error';

interface AuthState {
  status: AuthStatus;
  sessionUserId: string | null;
  sessionUser: User | null;
  twitchUser: TwitchUser | null;
  isAdmin: boolean;
  lastCheckedAt: number;
}

interface AuthContextValue extends AuthState {
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    sessionUserId: null,
    sessionUser: null,
    twitchUser: null,
    isAdmin: false,
    lastCheckedAt: Date.now(),
  });

  const { user: twitchUser, loading: twitchLoading, logout: twitchLogout } = useTwitchAuth();

  // Função atômica de hidratação da sessão
  const hydrateSession = async () => {
    console.log('[AuthContext] Iniciando hydrate...');
    
    try {
      // 1. Buscar sessão do Supabase (admin via email)
      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser();
      
      if (sessionError) {
        console.error('[AuthContext] Erro ao buscar sessão:', sessionError);
        setState(prev => ({ ...prev, status: 'ready', sessionUserId: null, sessionUser: null, isAdmin: false }));
        return;
      }

      const sessionUserId = sessionUser?.id || null;
      console.log('[AuthContext] Session user ID:', sessionUserId);

      // 2. Buscar role de admin (apenas se houver sessionUser)
      let isAdmin = false;
      if (sessionUserId) {
        try {
          const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', sessionUserId)
            .eq('role', 'admin')
            .maybeSingle();

          if (roleError) {
            console.error('[AuthContext] Erro ao verificar role:', roleError);
          } else {
            isAdmin = !!roleData;
            console.log('[AuthContext] isAdmin:', isAdmin);
          }
        } catch (e) {
          console.error('[AuthContext] Exceção ao verificar admin:', e);
        }
      }

      // 3. Aguardar twitchUser se ainda estiver carregando
      // (Será atualizado pelo useEffect que observa twitchUser)
      
      setState({
        status: 'ready',
        sessionUserId,
        sessionUser,
        twitchUser: twitchUser || null,
        isAdmin,
        lastCheckedAt: Date.now(),
      });

      console.log('[AuthContext] Hydrate completo:', { sessionUserId, isAdmin, twitchUser: twitchUser?.login });
    } catch (error) {
      console.error('[AuthContext] Erro fatal no hydrate:', error);
      setState(prev => ({ ...prev, status: 'error', lastCheckedAt: Date.now() }));
    }
  };

  // Atualizar twitchUser quando ele mudar (sem resetar o resto)
  useEffect(() => {
    if (state.status === 'ready' && !twitchLoading) {
      setState(prev => ({
        ...prev,
        twitchUser: twitchUser || null,
      }));
    }
  }, [twitchUser, twitchLoading, state.status]);

  // Hydrate inicial
  useEffect(() => {
    hydrateSession();

    // Listener de mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Auth state mudou:', event);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Re-hydrate apenas em eventos significativos
        hydrateSession();
      } else if (event === 'SIGNED_OUT') {
        setState({
          status: 'ready',
          sessionUserId: null,
          sessionUser: null,
          twitchUser: null,
          isAdmin: false,
          lastCheckedAt: Date.now(),
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshAuth = async () => {
    setState(prev => ({ ...prev, status: 'loading' }));
    await hydrateSession();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    if (twitchUser) {
      await twitchLogout();
    }
    setState({
      status: 'ready',
      sessionUserId: null,
      sessionUser: null,
      twitchUser: null,
      isAdmin: false,
      lastCheckedAt: Date.now(),
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, refreshAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
