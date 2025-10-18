import { Award, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-helper";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface RewardItem {
  id: string;
  nome_usuario: string;
  tipo_recompensa: string;
  valor: string;
  created_at: string;
  type: 'spin' | 'raffle';
}

export function RecentRewards() {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
        .limit(5);

      const { data: raffles } = await supabase
        .from("raffles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

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

  if (loading) {
    return (
      <div className="bg-card border rounded-lg p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-semibold">Últimas Recompensas</span>
          </div>
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-4 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-semibold">Últimas Recompensas:</span>
        </div>
        
        <div className="flex items-center gap-3 flex-1 overflow-x-auto">
          {rewards.length === 0 ? (
            <span className="text-sm text-muted-foreground">Nenhuma recompensa ainda</span>
          ) : (
            rewards.map((reward, index) => (
              <div key={reward.id} className="flex items-center gap-2 flex-shrink-0">
                {index > 0 && <span className="text-muted-foreground">•</span>}
                <div className="flex items-center gap-1.5">
                  {reward.type === 'spin' ? (
                    <Award className="h-4 w-4 text-primary" />
                  ) : (
                    <Trophy className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-sm font-medium">{reward.nome_usuario}</span>
                  <span className="text-sm text-muted-foreground">
                    ({reward.tipo_recompensa}: {reward.valor})
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <Button 
          onClick={() => navigate('/dashboard')}
          className="flex-shrink-0"
          size="sm"
        >
          Ir para o Dashboard
        </Button>
      </div>
    </div>
  );
}
