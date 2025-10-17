import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Gift, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase-helper";
import { useTwitchAuth } from "@/hooks/useTwitchAuth";

interface DailyRewardConfig {
  dia: number;
  pontos: number;
}

interface UserDailyLogin {
  dia_atual: number;
  ultimo_login: string;
}

interface DailyRewardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DailyRewardDialog({ open, onOpenChange }: DailyRewardDialogProps) {
  const { user: twitchUser } = useTwitchAuth();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [rewards, setRewards] = useState<DailyRewardConfig[]>([]);
  const [userLogin, setUserLogin] = useState<UserDailyLogin | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (open && twitchUser) {
      loadData();
    }
  }, [open, twitchUser]);

  const loadData = async () => {
    if (!twitchUser) return;

    setLoading(true);
    try {
      // Buscar perfil do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('twitch_username', twitchUser.login)
        .maybeSingle();

      if (!profile) {
        toast.error("Perfil não encontrado");
        return;
      }

      setUserId(profile.id);

      // Buscar configurações de recompensa
      const { data: rewardData, error: rewardError } = await supabase
        .from('daily_reward_config')
        .select('*')
        .order('dia', { ascending: true });

      if (rewardError) throw rewardError;
      setRewards(rewardData || []);

      // Buscar login do usuário
      const { data: loginData } = await supabase
        .from('user_daily_logins')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      setUserLogin(loginData);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar recompensas");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async () => {
    if (!userId) {
      toast.error("Usuário não identificado");
      return;
    }

    setClaiming(true);
    try {
      const token = localStorage.getItem('twitch_token');
      if (!token) {
        toast.error("Token não encontrado");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claim-daily-reward`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ userId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao resgatar recompensa");
        return;
      }

      toast.success(data.message || "Recompensa resgatada com sucesso!");
      loadData(); // Recarregar dados
    } catch (error: any) {
      console.error("Erro ao resgatar:", error);
      toast.error("Erro ao resgatar recompensa");
    } finally {
      setClaiming(false);
    }
  };

  const podeClamar = () => {
    if (!userLogin) return true; // Primeira vez

    const hoje = new Date().toISOString().split('T')[0];
    return userLogin.ultimo_login !== hoje;
  };

  const getDiaAtual = () => {
    return userLogin ? userLogin.dia_atual : 1;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-6 w-6" />
            Recompensa Diária
          </DialogTitle>
          <DialogDescription>
            Faça login todos os dias para ganhar pontos! Logins consecutivos aumentam suas recompensas.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {rewards.map((reward) => {
                const isCurrent = getDiaAtual() === reward.dia;
                const isCompleted = userLogin && userLogin.dia_atual > reward.dia;
                const hoje = new Date().toISOString().split('T')[0];
                const jaResgatouHoje = userLogin && userLogin.ultimo_login === hoje && isCurrent;

                return (
                  <div
                    key={reward.dia}
                    className={`
                      relative p-3 rounded-lg border-2 text-center transition-all
                      ${isCurrent ? 'border-primary bg-primary/10' : 'border-border'}
                      ${isCompleted ? 'bg-muted' : ''}
                    `}
                  >
                    {(isCompleted || jaResgatouHoje) && (
                      <div className="absolute top-1 right-1">
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mb-1">Dia {reward.dia}</div>
                    <div className="font-semibold text-sm">{reward.pontos} pts</div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center gap-2 pt-4">
              <p className="text-sm text-muted-foreground">
                {userLogin 
                  ? `Você está no dia ${userLogin.dia_atual} de logins consecutivos`
                  : "Comece sua sequência de logins hoje!"}
              </p>
              <Button
                onClick={handleClaimReward}
                disabled={!podeClamar() || claiming}
                size="lg"
              >
                {claiming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resgatando...
                  </>
                ) : podeClamar() ? (
                  "Resgatar Recompensa de Hoje"
                ) : (
                  "Já Resgatado Hoje"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
