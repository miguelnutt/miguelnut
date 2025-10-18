import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, Flame, Gift } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase-helper";
import { useTwitchAuth } from "@/hooks/useTwitchAuth";

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
  const [userLogin, setUserLogin] = useState<UserDailyLogin | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [nextReward, setNextReward] = useState<number>(25);

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

      // Buscar login do usuário
      const { data: loginData } = await supabase
        .from('user_daily_logins')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      setUserLogin(loginData);

      // Calcular próxima recompensa
      const proximoDia = loginData ? loginData.dia_atual + 1 : 1;
      
      // Verificar se há recompensa especial
      const { data: specialReward } = await supabase
        .from('daily_reward_special_config')
        .select('pontos')
        .eq('dia_sequencia', proximoDia)
        .maybeSingle();
      
      if (specialReward) {
        setNextReward(specialReward.pontos);
      } else if (proximoDia % 5 === 0) {
        setNextReward(50);
      } else {
        setNextReward(25);
      }
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

    // Pegar data atual no horário de Brasília
    const hoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    
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
          <div className="space-y-6">
            {/* Sequência Atual */}
            <div className="flex flex-col items-center gap-4 p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border-2 border-primary/20">
              <div className="flex items-center gap-3">
                <Flame className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Dias Consecutivos</p>
                  <p className="text-5xl font-bold text-primary">
                    {userLogin ? userLogin.dia_atual : 0}
                  </p>
                </div>
              </div>
              
              {userLogin && userLogin.dia_atual > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Último resgate: {new Date(userLogin.ultimo_login + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>

            {/* Próxima Recompensa */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  <span className="font-medium">Próxima recompensa:</span>
                </div>
                <span className="text-lg font-bold text-primary">{nextReward} pontos</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {!userLogin || userLogin.dia_atual === 0 
                  ? "Comece sua sequência resgatando hoje!"
                  : `Dia ${userLogin.dia_atual + 1} da sequência`}
              </p>
            </div>

            {/* Regras */}
            <div className="p-4 bg-muted/30 rounded-lg border text-sm space-y-2">
              <p className="font-medium">📋 Regras da Sequência:</p>
              <ul className="space-y-1 text-muted-foreground ml-4">
                <li>• Todo dia: +25 pontos</li>
                <li>• Múltiplos de 5: +50 pontos</li>
                <li>• Resgate 1x por dia às 00:00</li>
                <li>• Perder um dia zera a sequência</li>
              </ul>
            </div>

            {/* Botão de Resgate */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button
                onClick={handleClaimReward}
                disabled={!podeClamar() || claiming}
                size="lg"
                className="w-full"
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
