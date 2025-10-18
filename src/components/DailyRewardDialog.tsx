import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, Flame, Gift, AlertTriangle } from "lucide-react";
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
  const [streakPerdida, setStreakPerdida] = useState(false);
  const [diasPerdidos, setDiasPerdidos] = useState(0);
  const [custoRestauracao, setCustoRestauracao] = useState(0);
  const [pontosDisponiveis, setPontosDisponiveis] = useState(0);
  const [restaurando, setRestaurando] = useState(false);

  // Único useEffect - recarregar sempre que abrir
  useEffect(() => {
    if (open && twitchUser) {
      console.log('[DailyReward] Dialog aberto, carregando dados...');
      loadData();
    }
  }, [open, twitchUser]);

  const loadData = async () => {
    if (!twitchUser) {
      console.log('[DailyReward] Usuário Twitch não encontrado');
      return;
    }

    console.log('[DailyReward] ========== CARREGANDO DADOS ==========');
    console.log('[DailyReward] Twitch User:', twitchUser.login);
    
    setLoading(true);
    try {
      console.log('[DailyReward] Buscando perfil para:', twitchUser.login);
      
      // Buscar perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('twitch_username', twitchUser.login)
        .maybeSingle();

      if (profileError) {
        console.error('[DailyReward] Erro ao buscar perfil:', profileError);
        toast.error("Erro ao buscar perfil");
        return;
      }

      if (!profile) {
        console.error('[DailyReward] Perfil não encontrado para:', twitchUser.login);
        toast.error("Perfil não encontrado");
        return;
      }

      console.log('[DailyReward] ✓ Perfil encontrado - ID:', profile.id);
      setUserId(profile.id);

      // Buscar dados de login via edge function (bypassa RLS)
      console.log('[DailyReward] Buscando dados de login via edge function para user_id:', profile.id);
      
      const token = localStorage.getItem('twitch_token');
      const statusResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-daily-login-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ userId: profile.id }),
        }
      );

      const statusData = await statusResponse.json();
      console.log('[DailyReward] Resposta da edge function:', statusData);

      if (!statusResponse.ok) {
        console.error('[DailyReward] ❌ Erro ao buscar status:', statusData);
        toast.error("Erro ao buscar dados de login");
        return;
      }

      const loginData = statusData.loginData;

      if (loginData) {
        console.log('[DailyReward] ✓ Registro encontrado:');
        console.log('  - dia_atual:', loginData.dia_atual);
        console.log('  - ultimo_login:', loginData.ultimo_login);
        
        // Verificar se perdeu a sequência
        const hoje = new Date();
        const ultimoLogin = new Date(loginData.ultimo_login);
        const diffTime = Math.abs(hoje.getTime() - ultimoLogin.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1 && loginData.dia_atual > 0) {
          // Perdeu a sequência
          const diasPerdidos = diffDays - 1; // Quantos dias ficou sem entrar
          const custo = diasPerdidos * 200;
          
          setStreakPerdida(true);
          setDiasPerdidos(diasPerdidos);
          setCustoRestauracao(custo);
          
          // Buscar pontos disponíveis do usuário
          const pontosResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-streamelements-points`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({ username: twitchUser.login }),
            }
          );
          
          if (pontosResponse.ok) {
            const pontosData = await pontosResponse.json();
            setPontosDisponiveis(pontosData.points || 0);
          }
        } else {
          setStreakPerdida(false);
        }
      } else {
        console.log('[DailyReward] ⚠️  Nenhum registro encontrado - primeira vez do usuário');
        setStreakPerdida(false);
      }
      
      setUserLogin(loginData);

      // Calcular próxima recompensa
      const diaAtualValido = loginData?.dia_atual || 0;
      const proximoDia = diaAtualValido === 0 ? 1 : diaAtualValido + 1;
      
      console.log('[DailyReward] Dia atual:', diaAtualValido, 'Próximo dia:', proximoDia);
      
      // Verificar se há recompensa especial
      const { data: specialReward } = await supabase
        .from('daily_reward_special_config')
        .select('pontos')
        .eq('dia_sequencia', proximoDia)
        .maybeSingle();
      
      if (specialReward) {
        console.log('[DailyReward] Recompensa especial encontrada:', specialReward.pontos);
        setNextReward(specialReward.pontos);
      } else if (proximoDia % 5 === 0) {
        console.log('[DailyReward] Múltiplo de 5, recompensa: 50');
        setNextReward(50);
      } else {
        console.log('[DailyReward] Recompensa padrão: 25');
        setNextReward(25);
      }
    } catch (error: any) {
      console.error("[DailyReward] Erro ao carregar dados:", error);
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

    if (!podeClamar()) {
      console.log('[DailyReward] Tentativa de resgate quando já resgatado hoje');
      toast.error("Você já resgatou a recompensa de hoje");
      return;
    }

    console.log('[DailyReward] Iniciando resgate para userId:', userId);
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
      console.log('[DailyReward] Resposta da edge function:', data);

      // CRÍTICO: Atualizar streak mesmo quando retorna erro (já resgatado)
      if (data.diaAtual !== undefined) {
        const hoje = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date());

        console.log('[DailyReward] Atualizando estado local - dia_atual:', data.diaAtual, 'ultimo_login:', hoje);
        
        setUserLogin({
          dia_atual: data.diaAtual,
          ultimo_login: hoje
        });
      }

      if (!response.ok) {
        toast.error(data.error || "Erro ao resgatar recompensa");
        return;
      }

      toast.success(data.message || "Recompensa resgatada com sucesso!");
      
    } catch (error: any) {
      console.error("[DailyReward] Erro ao resgatar:", error);
      toast.error("Erro ao resgatar recompensa");
    } finally {
      setClaiming(false);
    }
  };

  const handleRestaurarSequencia = async () => {
    if (!userId || !twitchUser) {
      toast.error("Usuário não identificado");
      return;
    }

    if (pontosDisponiveis < custoRestauracao) {
      toast.error(`Você precisa de ${custoRestauracao} pontos para restaurar (você tem ${pontosDisponiveis})`);
      return;
    }

    setRestaurando(true);
    try {
      const token = localStorage.getItem('twitch_token');
      
      // Descontar pontos
      const pontosResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-streamelements-points`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            username: twitchUser.login,
            amount: -custoRestauracao,
            reason: `Restauração de sequência (${diasPerdidos} dias perdidos)`
          }),
        }
      );

      if (!pontosResponse.ok) {
        toast.error("Erro ao descontar pontos");
        return;
      }

      // Atualizar ultimo_login para ontem (para poder resgatar hoje)
      const hoje = new Date();
      const ontem = new Date(hoje);
      ontem.setDate(ontem.getDate() - 1);
      const ontemStr = ontem.toISOString().split('T')[0];

      const { error } = await supabase
        .from('user_daily_logins')
        .update({ ultimo_login: ontemStr })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(`Sequência restaurada! ${custoRestauracao} pontos descontados.`);
      setStreakPerdida(false);
      loadData(); // Recarregar dados
    } catch (error: any) {
      console.error("Erro ao restaurar sequência:", error);
      toast.error("Erro ao restaurar sequência");
    } finally {
      setRestaurando(false);
    }
  };

  const podeClamar = () => {
    if (!userLogin) {
      console.log('[DailyReward] Pode clamar: primeira vez');
      return true;
    }

    const hoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    
    const podeResgatar = userLogin.ultimo_login !== hoje;
    console.log('[DailyReward] Pode clamar:', podeResgatar, '| último_login:', userLogin.ultimo_login, '| hoje:', hoje);
    
    return podeResgatar;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
                    {userLogin?.dia_atual || 0}
                  </p>
                </div>
              </div>
              
              {userLogin && userLogin.dia_atual > 0 && userLogin.ultimo_login && (
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

            {/* Alerta de Sequência Perdida */}
            {streakPerdida && (
              <div className="p-4 bg-destructive/10 border-2 border-destructive/30 rounded-lg space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-destructive mb-1">Sequência Perdida!</p>
                    <p className="text-sm text-muted-foreground">
                      Você ficou {diasPerdidos} {diasPerdidos === 1 ? 'dia' : 'dias'} sem resgatar e perdeu sua sequência de {userLogin?.dia_atual} dias.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      <strong>Custo da restauração:</strong> {custoRestauracao} pontos ({diasPerdidos} dias × 200 pontos)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Seus pontos disponíveis:</strong> {pontosDisponiveis} pontos
                    </p>
                  </div>
                </div>
                
                <Button
                  onClick={handleRestaurarSequencia}
                  disabled={restaurando || pontosDisponiveis < custoRestauracao}
                  variant="destructive"
                  className="w-full"
                >
                  {restaurando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Restaurando...
                    </>
                  ) : pontosDisponiveis < custoRestauracao ? (
                    `Pontos Insuficientes (Faltam ${custoRestauracao - pontosDisponiveis})`
                  ) : (
                    `Restaurar Sequência por ${custoRestauracao} Pontos`
                  )}
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  Ou continue sem restaurar e comece uma nova sequência
                </p>
              </div>
            )}

            {/* Regras */}
            <div className="p-4 bg-muted/30 rounded-lg border text-sm space-y-2">
              <p className="font-medium">📋 Como Funciona:</p>
              <ul className="space-y-1 text-muted-foreground ml-4">
                <li>• Resgate 1x por dia</li>
                <li>• Virada à meia-noite (horário de Brasília)</li>
                <li>• Perder um dia zera a sequência</li>
              </ul>
            </div>

            {/* Botão de Resgate */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button
                onClick={handleClaimReward}
                disabled={!podeClamar() || claiming}
                size="lg"
                className="w-full disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground"
                variant={!podeClamar() && !claiming ? "outline" : "default"}
              >
                {claiming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resgatando...
                  </>
                ) : podeClamar() ? (
                  "Resgatar Recompensa de Hoje"
                ) : (
                  "✓ Já Resgatado Hoje"
                )}
              </Button>
              {!podeClamar() && !claiming && (
                <p className="text-xs text-muted-foreground">
                  Volte amanhã para continuar sua sequência!
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}