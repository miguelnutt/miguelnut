import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, LogOut, Ghost } from 'lucide-react';
import { useTwitchAuth, TwitchUser } from '@/hooks/useTwitchAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useHalloweenTheme } from '@/contexts/HalloweenThemeContext';

interface UserBadgeProps {
  user: TwitchUser;
  onLogout: () => void;
}

export function UserBadge({ user, onLogout }: UserBadgeProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin } = useAuth();
  const { isHalloweenActive, toggleHalloween } = useHalloweenTheme();

  const fetchBalance = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('twitch_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loyalty-balance`,
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

      if (data.success) {
        setBalance(data.balance);
      } else {
        throw new Error(data.error || 'Failed to fetch balance');
      }
    } catch (err: any) {
      console.error('Balance fetch error:', err);
      setError(err.message);
      setBalance(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBalance();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [fetchBalance]);

  const handleRefresh = () => {
    fetchBalance();
    toast.success('Saldo atualizado!');
  };

  if (loading && balance === null) {
    return (
      <div className="flex items-center gap-3 bg-background/50 backdrop-blur-sm rounded-full px-4 py-2 border border-border">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2 w-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm rounded-full px-3 py-1.5 border border-border">
      <img
        src={user.profile_image_url}
        alt={user.display_name}
        className="h-8 w-8 rounded-full ring-2 ring-primary/20"
      />
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-foreground truncate">
          {user.display_name}
        </span>
        {error ? (
          <span className="text-[10px] text-destructive">
            Saldo indisponível
          </span>
        ) : (
          <span className="text-[10px] text-primary font-medium">
            {balance?.toLocaleString() || '0'} pontos
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full hover:bg-orange-500/20"
            onClick={() => {
              toggleHalloween();
              toast.success(isHalloweenActive ? 'Tema Halloween DESATIVADO' : 'Tema Halloween ATIVO');
            }}
            title={isHalloweenActive ? 'Desativar Tema Halloween' : 'Ativar Tema Halloween'}
          >
            <Ghost className={`h-3 w-3 ${isHalloweenActive ? 'text-orange-500' : ''}`} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full hover:bg-primary/10"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Atualizar saldo"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
          onClick={onLogout}
          title="Sair"
        >
          <LogOut className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function UserBadgeLoading() {
  return (
    <div className="flex items-center gap-3 bg-background/50 backdrop-blur-sm rounded-full px-4 py-2 border border-border">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-2 w-16" />
      </div>
    </div>
  );
}
