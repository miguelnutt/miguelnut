import { Award, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-helper";
import { useNavigate } from "react-router-dom";
import { normalizeUsernameWithFallback } from "@/lib/utils";

interface RewardItem {
  id: string;
  nome_usuario: string;
  tipo_recompensa: string;
  valor: string;
  created_at: string;
  type: 'spin' | 'raffle';
  nome?: string;
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
        .limit(10);

      const { data: raffles } = await supabase
        .from("raffles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      // Buscar perfis dos usuários dos spins
      const spinUserIds = (spins || []).map(spin => spin.user_id).filter(Boolean);
      let spinProfilesData = [];
      
      if (spinUserIds.length > 0) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", spinUserIds);
          
          if (error) {
            console.error("Error fetching spin profiles:", error);
          } else {
            spinProfilesData = data || [];
          }
        } catch (err) {
          console.error("Error in spin profiles query:", err);
        }
      }
      
      const spinProfilesMap = spinProfilesData.reduce((acc: Record<string, { id: string; nome: string }>, profile) => {
        if (profile && profile.id) {
          acc[profile.id] = profile;
        }
        return acc;
      }, {});

      // Buscar perfis dos vencedores dos sorteios
      const raffleUserIds = (raffles || []).map(raffle => raffle.vencedor_id).filter(Boolean);
      let raffleProfilesData = [];
      
      if (raffleUserIds.length > 0) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", raffleUserIds);
          
          if (error) {
            console.error("Error fetching raffle profiles:", error);
          } else {
            raffleProfilesData = data || [];
          }
        } catch (err) {
          console.error("Error in raffle profiles query:", err);
        }
      }
      
      const raffleProfilesMap = raffleProfilesData.reduce((acc: Record<string, { id: string; nome: string }>, profile) => {
        if (profile && profile.id) {
          acc[profile.id] = profile;
        }
        return acc;
      }, {});

      const combined = [
        ...(spins || []).map(s => ({ 
          ...s, 
          type: 'spin' as const,
          nome: s.user_id && spinProfilesMap[s.user_id] ? spinProfilesMap[s.user_id].nome : null
        })),
        ...(raffles || []).map(r => ({ 
          ...r, 
          type: 'raffle' as const,
          nome_usuario: r.nome_vencedor || '',
          tipo_recompensa: r.tipo_premio || '',
          valor: r.valor_premio?.toString() || '0',
          nome: r.vencedor_id && raffleProfilesMap[r.vencedor_id] ? raffleProfilesMap[r.vencedor_id].nome : null
        }))
      ].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 10);

      setRewards(combined);
    } catch (error) {
      console.error("Error loading rewards:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border-b-4 border-b-primary rounded-lg p-3 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Últimas Recompensas</span>
          </div>
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border-b-4 border-b-primary rounded-lg overflow-hidden shadow-card">
      <div className="flex items-center gap-3 p-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Últimas Recompensas:</span>
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          {rewards.length === 0 ? (
            <span className="text-sm text-muted-foreground">Nenhuma recompensa ainda</span>
          ) : (
            <div className="scrolling-container">
              <div className="scrolling-content">
                {/* Primeiro conjunto de recompensas */}
                {rewards.map((reward) => (
                  <div key={`original-${reward.id}`} className="reward-item flex items-center gap-1.5 px-4">
                    {reward.type === 'spin' ? (
                      <Award className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <Trophy className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium whitespace-nowrap">{normalizeUsernameWithFallback(reward.nome_usuario, reward.nome)}</span>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      ({reward.tipo_recompensa}: {reward.valor})
                    </span>
                  </div>
                ))}
                {/* Duplicar para loop contínuo */}
                {rewards.map((reward) => (
                  <div key={`duplicate-${reward.id}`} className="reward-item flex items-center gap-1.5 px-4">
                    {reward.type === 'spin' ? (
                      <Award className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <Trophy className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium whitespace-nowrap">{normalizeUsernameWithFallback(reward.nome_usuario, reward.nome)}</span>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      ({reward.tipo_recompensa}: {reward.valor})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-primary hover:text-primary/80 font-medium flex-shrink-0 underline transition-colors"
        >
          Ver Dashboard
        </button>
      </div>

      <style>{`
        .scrolling-container {
          overflow: hidden;
          white-space: nowrap;
          mask-image: linear-gradient(
            to right,
            transparent,
            black 10%,
            black 90%,
            transparent
          );
          -webkit-mask-image: linear-gradient(
            to right,
            transparent,
            black 10%,
            black 90%,
            transparent
          );
        }

        .scrolling-content {
          display: inline-flex;
          animation: scroll 30s linear infinite;
          will-change: transform;
        }

        .scrolling-content:hover {
          animation-play-state: paused;
        }

        .reward-item {
          display: inline-flex;
          align-items: center;
        }

        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}