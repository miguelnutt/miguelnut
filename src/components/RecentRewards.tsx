import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-helper";

interface RewardItem {
  id: string;
  nome_usuario: string;
  tipo_recompensa: string;
  valor: string;
  created_at: string;
  type: 'spin' | 'raffle';
  tipo_premio?: string;
  valor_premio?: number;
  nome_vencedor?: string;
}

export function RecentRewards() {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRewards();

    const channel = supabase
      .channel('recent_rewards_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'spins' }, loadRewards)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raffles' }, loadRewards)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadRewards = async () => {
    try {
      const { data: spins } = await supabase
        .from("spins")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: raffles } = await supabase
        .from("raffles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      const combined = [
        ...(spins || []).map(s => ({ ...s, type: 'spin' as const })),
        ...(raffles || []).map(r => ({ 
          ...r, 
          type: 'raffle' as const,
          nome_usuario: r.nome_vencedor,
          tipo_recompensa: r.tipo_premio,
          valor: r.valor_premio?.toString() || '0'
        }))
      ].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 5);

      setRewards(combined);
    } catch (error) {
      console.error("Error loading rewards:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Agora mesmo';
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-primary" />
          Últimas Recompensas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nenhuma recompensa ainda
          </div>
        ) : (
          <div className="space-y-3">
            {rewards.map((reward) => (
              <div 
                key={reward.id} 
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {reward.type === 'spin' ? (
                      <Award className="h-5 w-5 text-primary" />
                    ) : (
                      <Trophy className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {reward.nome_usuario}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reward.tipo_recompensa} • {reward.valor}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                  {formatTime(reward.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
