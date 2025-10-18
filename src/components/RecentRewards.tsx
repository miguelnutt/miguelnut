import { Award, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-helper";
import { useNavigate } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useRef } from "react";

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
  const plugin = useRef(
    Autoplay({ delay: 3000, stopOnInteraction: false, stopOnMouseEnter: true })
  );

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
    <div className="bg-card border-b-4 border-b-primary rounded-lg p-3 shadow-card">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Últimas Recompensas:</span>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {rewards.length === 0 ? (
            <span className="text-sm text-muted-foreground">Nenhuma recompensa ainda</span>
          ) : (
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              plugins={[plugin.current]}
              className="w-full"
              onMouseEnter={plugin.current.stop}
              onMouseLeave={plugin.current.reset}
            >
              <CarouselContent>
                {rewards.map((reward) => (
                  <CarouselItem key={reward.id} className="basis-auto">
                    <div className="flex items-center gap-1.5 pr-4">
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
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          )}
        </div>
        
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-primary hover:text-primary/80 font-medium flex-shrink-0 underline"
        >
          Ver Dashboard
        </button>
      </div>
    </div>
  );
}
