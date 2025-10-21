import { useEffect, useState, useRef } from "react";
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
import { useAuth } from "@/contexts/AuthContext";

interface UserDailyLogin {
  dia_atual: number;
  ultimo_login: string;
}

interface DailyRewardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DailyRewardDialog({ open, onOpenChange }: DailyRewardDialogProps) {
  const { user: twitchUser, loading: twitchLoading } = useTwitchAuth();
  const { authReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [userLogin, setUserLogin] = useState<UserDailyLogin | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [twitchUsername, setTwitchUsername] = useState<string | null>(null);
  const [nextReward, setNextReward] = useState<number>(25);
  const [streakPerdida, setStreakPerdida] = useState(false);
  const [diasPerdidos, setDiasPerdidos] = useState(0);
  const [custoRestauracao, setCustoRestauracao] = useState(0);
  const [pontosDisponiveis, setPontosDisponiveis] = useState<number | null>(null);
  const [pontosLoading, setPontosLoading] = useState(false);
  const [pontosError, setPontosError] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [permitirRestauracao, setPermitirRestauracao] = useState(true);

  // Único useEffect - recarregar sempre que abrir E quando auth estiver pronto
  useEffect(() => {
    // Limpar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Guard: só executar quando auth estiver pronto e dialog aberto
    if (!open || !authReady || twitchLoading) {
      console.log('[DailyReward] Aguardando condições: open=%s authReady=%s twitchLoading=%s', open, authReady, twitchLoading);
      return;
    }
    
    // Debounce de 500ms
    debounceTimerRef.current = setTimeout(() => {
      console.log('[DailyReward] Dialog aberto e auth carregado, carregando dados...');
      loadData();
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [open, authReady, twitchLoading]);

  const loadData = async () => {
    // Single-flight: evitar chamadas concorrentes
    if (loadingRef.current) {
      console.log('[DailyReward] loadData já em execução, ignorando chamada duplicada');
      return;
    }

    console.log('[DailyReward] ========== CARREGANDO DADOS ==========');
    
    loadingRef.current = true;
    setLoading(true);
    try {
      let profileId: string | null = null;
      let username: string | null = null;

      // Tentar usar twitch user primeiro
      if (twitchUser?.login) {
        console.log('[DailyReward] Usando Twitch User:', twitchUser.login);
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('twitch_username', twitchUser.login)
          .maybeSingle();

        if (profile) {
          profileId = profile.id;
          username = twitchUser.login;
        }
      }

      // Se não encontrou, tentar pela sessão
      if (!profileId) {
        console.log('[DailyReward] Twitch user não disponível, buscando pela sessão...');
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          toast.error("Você precisa estar logado");
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, twitch_username')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!profile) {
          toast.error("Perfil não encontrado");
          return;
        }

        profileId = profile.id;
        username = profile.twitch_username || null;
      }

      console.log('[DailyReward] ✓ Perfil encontrado - ID:', profileId, 'Username:', username);
      setUserId(profileId);
      setTwitchUsername(username);

      // Buscar dados de login via edge function (bypassa RLS)
      console.log('[DailyReward] Buscando dados de login via edge function para user_id:', profileId);
      
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
          body: JSON.stringify({ userId: profileId }),
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
        
        // Carregar configuração de restauração
        const { data: config } = await supabase
          .from('daily_reward_default_config')
          .select('custo_restauracao_por_dia, permitir_restauracao')
          .limit(1)
          .maybeSingle();

        const custoBasePorDia = config?.custo_restauracao_por_dia || 200;
        const permitirRestaur = config?.permitir_restauracao ?? true;
        setPermitirRestauracao(permitirRestaur);
        
        // Calcular dias perdidos corretamente (timezone Brasília)
        const hoje = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date());
        
        const ultimoLogin = loginData.ultimo_login;
        
        // Calcular diferença em dias
        const hojeDate = new Date(hoje + 'T00:00:00');
        const ultimoLoginDate = new Date(ultimoLogin + 'T00:00:00');
        const diffTime = hojeDate.getTime() - ultimoLoginDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        console.log('[DailyReward] Cálculo de perda - Hoje:', hoje, 'Último:', ultimoLogin, 'Diff:', diffDays);
        
        // Só perdeu se diffDays > 1 (mais de 1 dia sem resgatar) E já tinha streak
        if (diffDays > 1 && loginData.dia_atual > 0) {
          const diasPerdidos = diffDays - 1; // Quantos dias inteiros perdidos
          const custo = diasPerdidos * custoBasePorDia;
          
          setStreakPerdida(true);
          setDiasPerdidos(diasPerdidos);
          setCustoRestauracao(custo);
          
          // Buscar pontos disponíveis (se tiver username e restauração permitida)
          if (username && permitirRestaur) {
            setPontosLoading(true);
            setPontosError(false);
            
            try {
              const { data: pontosData, error: pontosError } = await supabase.functions.invoke('get-streamelements-points', {
                body: { username }
              });
            
              if (pontosError) throw pontosError;
              
              setPontosDisponiveis(pontosData?.points ?? 0);
            } catch (err) {
              console.error('[DailyReward] Erro ao buscar pontos:', err);
              // Retry uma vez
              try {
                const { data: retryData, error: retryError } = await supabase.functions.invoke('get-streamelements-points', {
                  body: { username }
                });
                
                if (!retryError) {
                  setPontosDisponiveis(retryData?.points ?? 0);
                } else {
                  setPontosError(true);
                }
              } catch {
                setPontosError(true);
              }
            } finally {
              setPontosLoading(false);
            }
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
      loadingRef.current = false;
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
    if (!userId) {
      toast.error("Usuário não identificado");
      return;
    }

    if (pontosDisponiveis !== null && pontosDisponiveis < custoRestauracao) {
      toast.error(`Você precisa de ${custoRestauracao} pontos (tem ${pontosDisponiveis})`);
      return;
    }

    setRestaurando(true);
    try {
      const token = localStorage.getItem('twitch_token');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-daily-streak`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            userId,
            diasPerdidos,
            custoTotal: custoRestauracao,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao restaurar sequência");
        return;
      }

      toast.success(data.message || "Sequência restaurada com sucesso!");
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
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle id="daily-reward-title" className="flex items-center gap-2">
            <Gift className="h-6 w-6" />
            Recompensa Diária
          </DialogTitle>
          <DialogDescription id="daily-reward-desc">
            Faça login todos os dias para ganhar pontos! Logins consecutivos aumentam suas recompensas.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 px-1">
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
              <div className="p-3 bg-destructive/10 border-2 border-destructive/30 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-destructive mb-1">Sequência Perdida!</p>
                    <p className="text-sm text-muted-foreground">
                      Você ficou {diasPerdidos} {diasPerdidos === 1 ? 'dia' : 'dias'} sem resgatar e perdeu sua sequência de {userLogin?.dia_atual} dias.
                    </p>
                    
                    {permitirRestauracao ? (
                      <>
                        <p className="text-sm text-muted-foreground mt-2">
                          <strong>Custo:</strong> {custoRestauracao} pontos ({diasPerdidos} × {custoRestauracao / diasPerdidos})
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <strong>Disponível:</strong>{' '}
                          {pontosLoading ? (
                            <span className="inline-flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Carregando...
                            </span>
                          ) : pontosError ? (
                            <span className="text-amber-600">Indisponível ⚠️</span>
                          ) : (
                            <span>{pontosDisponiveis ?? 0} pontos</span>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        A restauração de sequência está temporariamente desativada.
                      </p>
                    )}
                  </div>
                </div>
                
                {permitirRestauracao && (
                  <Button
                    onClick={handleRestaurarSequencia}
                    disabled={
                      restaurando || 
                      pontosLoading || 
                      pontosError || 
                      (pontosDisponiveis !== null && pontosDisponiveis < custoRestauracao)
                    }
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    {restaurando ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Restaurando...
                      </>
                    ) : pontosLoading ? (
                      'Carregando saldo...'
                    ) : pontosError ? (
                      'Erro ao verificar saldo'
                    ) : pontosDisponiveis !== null && pontosDisponiveis < custoRestauracao ? (
                      `Insuficiente (faltam ${custoRestauracao - pontosDisponiveis})`
                    ) : (
                      `Restaurar por ${custoRestauracao} Pontos`
                    )}
                  </Button>
                )}
                
                <p className="text-xs text-center text-muted-foreground">
                  Ou continue sem restaurar e comece uma nova sequência
                </p>
              </div>
            )}

            {/* Regras */}
            <div className="p-3 bg-muted/30 rounded-lg border text-sm space-y-1">
              <p className="font-medium">📋 Como Funciona:</p>
              <ul className="space-y-0.5 text-muted-foreground ml-4 text-xs">
                <li>• Resgate 1x por dia</li>
                <li>• Virada à meia-noite (horário de Brasília)</li>
                <li>• Perder um dia zera a sequência</li>
              </ul>
            </div>
          </div>
        )}

        {/* Rodapé sticky com CTA */}
        {!loading && (
          <div className="sticky bottom-0 bg-background border-t pt-3 pb-1 flex-shrink-0">
            <Button
              onClick={handleClaimReward}
              disabled={!podeClamar() || claiming}
              size="lg"
              className="w-full disabled:opacity-50"
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
            
            {!podeClamar() && (
              <p className="text-xs text-muted-foreground text-center mt-1">
                Você já resgatou hoje
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}