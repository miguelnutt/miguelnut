import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase-helper";
import { Loader2, Flame, Trophy } from "lucide-react";
import { toast } from "sonner";

interface StreakRanking {
  posicao: number;
  user_id: string;
  nome: string;
  twitch_username: string | null;
  dias_consecutivos: number;
  ultimo_resgate: string;
}

export function StreakRanking() {
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState<StreakRanking[]>([]);

  useEffect(() => {
    loadRankings();
  }, []);

  const loadRankings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-streak-ranking');

      if (error) throw error;
      setRankings(data.rankings || []);
    } catch (error: any) {
      console.error('Erro ao carregar ranking:', error);
      toast.error('Erro ao carregar ranking de sequências');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-primary" />
          Maiores Sequências Ativas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : rankings.length > 0 ? (
          <div className="space-y-3">
            {rankings.map((rank) => (
              <div
                key={rank.user_id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border hover:bg-muted/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full font-bold
                    ${rank.posicao === 1 ? 'bg-yellow-500/20 text-yellow-500' : ''}
                    ${rank.posicao === 2 ? 'bg-slate-400/20 text-slate-400' : ''}
                    ${rank.posicao === 3 ? 'bg-orange-600/20 text-orange-600' : ''}
                    ${rank.posicao > 3 ? 'bg-muted text-muted-foreground' : ''}
                  `}>
                    {rank.posicao === 1 && <Trophy className="h-4 w-4" />}
                    {rank.posicao !== 1 && `${rank.posicao}º`}
                  </div>
                  <div>
                    <p className="font-medium">{rank.nome}</p>
                    {rank.twitch_username && (
                      <p className="text-xs text-muted-foreground">@{rank.twitch_username}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary flex items-center gap-1">
                    <Flame className="h-5 w-5" />
                    {rank.dias_consecutivos}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Último: {rank.ultimo_resgate}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma sequência ativa ainda
          </div>
        )}
      </CardContent>
    </Card>
  );
}
