import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import { CanvasWheel } from "./CanvasWheel";
import { z } from "zod";
import { User } from "@supabase/supabase-js";
import { useAdmin } from "@/hooks/useAdmin";
import confetti from "canvas-confetti";
import rewardSound from "@/assets/achievement-unlocked-waterway-music-1-00-02.mp3";

interface Recompensa {
  tipo: "Pontos de Loja" | "Tickets" | "Rubini Coins";
  valor: string;
  cor: string;
}

interface SpinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wheel: {
    id: string;
    nome: string;
    recompensas: Recompensa[];
    duracao_spin: number;
  } | null;
  testMode?: boolean;
}


const spinInputSchema = z.object({
  nomeUsuario: z.string().trim().min(1, "Nome do usuário é obrigatório").max(100, "Nome muito longo (máximo 100 caracteres)")
});

export function SpinDialog({ open, onOpenChange, wheel, testMode = false }: SpinDialogProps) {
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useAdmin(user);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [resultado, setResultado] = useState<Recompensa | null>(null);
  const [rotation, setRotation] = useState(0);
  const [nomeVencedor, setNomeVencedor] = useState("");
  const [isModoTeste, setIsModoTeste] = useState(testMode);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const rewardAudioRef = useRef<HTMLAudioElement | null>(null);
  const [nomePersonagem, setNomePersonagem] = useState<string | null>(null);
  const [pontosAtuais, setPontosAtuais] = useState<number | null>(null);
  const [carregandoPontos, setCarregandoPontos] = useState(false);
  const [ticketsAtuais, setTicketsAtuais] = useState<number | null>(null);
  const [carregandoTickets, setCarregandoTickets] = useState(false);

  // Inicializar áudio de recompensa
  useEffect(() => {
    rewardAudioRef.current = new Audio(rewardSound);
    rewardAudioRef.current.volume = 0.5;
    return () => {
      if (rewardAudioRef.current) {
        rewardAudioRef.current.pause();
        rewardAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setNomeUsuario("");
      setResultado(null);
      setRotation(0);
      setNomeVencedor("");
      setIsModoTeste(testMode);
      setShowResultDialog(false);
      setAwaitingConfirmation(false);
      setNomePersonagem(null);
      setPontosAtuais(null);
      setCarregandoPontos(false);
      setTicketsAtuais(null);
      setCarregandoTickets(false);
    } else {
      setIsModoTeste(testMode);
    }
  }, [open, testMode]);

  const launchConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleConfirmPrize = async () => {
    if (!resultado || !wheel) return;

    setAwaitingConfirmation(true);

    try {
      const nomeParaUsar = nomeVencedor || "Visitante";
      
      // SEMPRE buscar por twitch_username primeiro (case-insensitive)
      console.log("Buscando perfil para:", nomeParaUsar);
      
      // Tentar buscar por twitch_username primeiro
      const { data: profileByTwitch } = await supabase
        .from('profiles')
        .select('id, nome, twitch_username, nome_personagem')
        .ilike('twitch_username', nomeParaUsar)
        .maybeSingle();
      
      // Se não encontrou por twitch_username, buscar por nome
      const { data: profileByName } = profileByTwitch ? { data: null } : await supabase
        .from('profiles')
        .select('id, nome, twitch_username, nome_personagem')
        .ilike('nome', nomeParaUsar)
        .maybeSingle();
      
      let profileData = profileByTwitch || profileByName;
      console.log("Perfil encontrado:", profileData);

      let userId: string;

      if (profileData) {
        // Perfil encontrado
        userId = profileData.id;
        console.log("Usando perfil existente:", userId);
      } else {
        // Criar novo perfil
        console.log("Criando novo perfil para:", nomeParaUsar);
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({ 
            nome: nomeParaUsar,
            twitch_username: nomeParaUsar // Assumir que é username da Twitch
          })
          .select('id, nome, twitch_username, nome_personagem')
          .single();

        if (createError) {
          console.error("Erro ao criar perfil:", createError);
          toast.error("Erro ao processar usuário");
          setAwaitingConfirmation(false);
          return;
        }

        userId = newProfile.id;
        profileData = newProfile; // ✅ IMPORTANTE: Atualizar profileData com o novo perfil
        console.log("Novo perfil criado:", profileData);
      }

      // Se for Rubini Coins, usar o nome_personagem do perfil encontrado
      let personagemInfo = null;
      if (resultado.tipo === "Rubini Coins") {
        console.log("🎮 Verificando personagem para Rubini Coins");
        console.log("📋 Dados do perfil:", {
          id: profileData?.id,
          nome: profileData?.nome,
          twitch_username: profileData?.twitch_username,
          nome_personagem: profileData?.nome_personagem
        });
        
        if (profileData?.nome_personagem) {
          setNomePersonagem(profileData.nome_personagem);
          personagemInfo = profileData.nome_personagem;
          console.log("✅ Nome do personagem encontrado:", profileData.nome_personagem);
        } else {
          setNomePersonagem("NÃO CADASTRADO");
          console.log("⚠️ Personagem NÃO CADASTRADO");
          console.log("   - User ID:", userId);
          console.log("   - Nome:", profileData?.nome);
          console.log("   - Twitch Username:", profileData?.twitch_username);
        }
      }

      // Salvar o spin com tipo padronizado
      const tipoParaSalvar = resultado.tipo;
      const { error: spinError } = await supabase
        .from("spins")
        .insert({
          wheel_id: wheel.id,
          user_id: userId,
          nome_usuario: nomeParaUsar,
          tipo_recompensa: tipoParaSalvar,
          valor: resultado.valor
        });

      if (spinError) throw spinError;

      // Se ganhou ticket, atualizar
      if (resultado.tipo === "Tickets" && userId) {
        const ticketsGanhos = parseInt(resultado.valor) || 1;

        const { data: ticketsData } = await supabase
          .from("tickets")
          .select("tickets_atual")
          .eq("user_id", userId)
          .maybeSingle();

        const ticketsAtuais = ticketsData?.tickets_atual || 0;
        const novoTotal = ticketsAtuais + ticketsGanhos;

        const { error: ticketsError } = await supabase
          .from("tickets")
          .upsert({
            user_id: userId,
            tickets_atual: novoTotal
          });

        if (ticketsError) throw ticketsError;

        await supabase
          .from("ticket_ledger")
          .insert({
            user_id: userId,
            variacao: ticketsGanhos,
            motivo: `Ganhou ${ticketsGanhos} ticket(s) na roleta ${wheel.nome}`
          });
        
        // Mostrar toast com total atualizado
        toast.success(`${nomeParaUsar} ganhou +${ticketsGanhos} ticket(s)! (Agora possui ${novoTotal} tickets)`);
        setShowResultDialog(false);
        onOpenChange(false);
        setAwaitingConfirmation(false);
        return;
      }

      toast.success(`Prêmio entregue: ${resultado.valor} ${resultado.tipo} para ${nomeParaUsar}!`);
      setShowResultDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error confirming prize:", error);
      toast.error("Erro ao confirmar prêmio: " + error.message);
    } finally {
      setAwaitingConfirmation(false);
    }
  };

  const handleCancelPrize = () => {
    toast.info("Premiação cancelada");
    setShowResultDialog(false);
    setResultado(null);
  };

  const spin = async () => {
    // Validate input only if not in test mode
    if (!isModoTeste) {
      const validation = spinInputSchema.safeParse({ nomeUsuario });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }
    }

    if (!wheel || wheel.recompensas.length === 0) {
      toast.error("Esta roleta não tem recompensas configuradas");
      return;
    }

    // Resetar rotação para 0 antes de começar novo spin
    setRotation(0);
    setResultado(null);
    
    // Pequeno delay para garantir que o reset seja aplicado
    await new Promise(resolve => setTimeout(resolve, 50));
    
    setSpinning(true);

    // Sortear uma recompensa aleatória
    const indexSorteado = Math.floor(Math.random() * wheel.recompensas.length);
    const sorteada = wheel.recompensas[indexSorteado];
    
    // Calcular rotação com posição aleatória dentro da fatia
    const voltas = 8; // Número de voltas completas
    const grausPorSecao = 360 / wheel.recompensas.length;
    
    // Adicionar aleatoriedade dentro da fatia (não sempre no meio)
    // Varia entre 20% e 80% da fatia para não ficar nas bordas
    const variacaoAleatoria = (Math.random() * 0.6 + 0.2) * grausPorSecao;
    const anguloDoSegmento = indexSorteado * grausPorSecao + variacaoAleatoria;
    
    // Rotação total: voltas completas + ajuste para o segmento sorteado
    const novaRotacao = (voltas * 360) + (360 - anguloDoSegmento);
    
    setRotation(novaRotacao);

    // Aguardar animação (duração configurada + 0.5s de suspense)
    const duracaoMs = (wheel?.duracao_spin || 4) * 1000;
    setTimeout(async () => {
      const nomeParaExibir = nomeUsuario.trim() || "Visitante";
      setNomeVencedor(nomeParaExibir);
      setResultado(sorteada);
      setSpinning(false);
      
      // Se for Pontos de Loja, buscar pontos atuais do usuário
      if (sorteada.tipo === "Pontos de Loja" && !isModoTeste) {
        setCarregandoPontos(true);
        try {
          const { data, error } = await supabase.functions.invoke('get-streamelements-points', {
            body: { username: nomeParaExibir }
          });
          
          if (!error && data?.points !== undefined) {
            setPontosAtuais(data.points);
          } else {
            setPontosAtuais(null);
          }
        } catch (error) {
          console.error("Erro ao buscar pontos:", error);
          setPontosAtuais(null);
        } finally {
          setCarregandoPontos(false);
        }
      }
      
      // Se for Tickets, buscar tickets atuais do usuário
      if (sorteada.tipo === "Tickets" && !isModoTeste) {
        setCarregandoTickets(true);
        try {
          // Buscar perfil por twitch_username ou nome
          const { data: profileByTwitch } = await supabase
            .from('profiles')
            .select('id')
            .ilike('twitch_username', nomeParaExibir)
            .maybeSingle();
          
          const { data: profileByName } = profileByTwitch ? { data: null } : await supabase
            .from('profiles')
            .select('id')
            .ilike('nome', nomeParaExibir)
            .maybeSingle();
          
          const profileData = profileByTwitch || profileByName;
          
          if (profileData?.id) {
            const { data: ticketsData } = await supabase
              .from('tickets')
              .select('tickets_atual')
              .eq('user_id', profileData.id)
              .maybeSingle();
            
            setTicketsAtuais(ticketsData?.tickets_atual || 0);
          } else {
            setTicketsAtuais(0); // Novo usuário
          }
        } catch (error) {
          console.error("Erro ao buscar tickets:", error);
          setTicketsAtuais(null);
        } finally {
          setCarregandoTickets(false);
        }
      }
      
      // Se for Rubini Coins, buscar nome do personagem
      if (sorteada.tipo === "Rubini Coins" && !isModoTeste) {
        try {
          console.log("🎮 Buscando personagem para:", nomeParaExibir);
          
          // Buscar perfil por twitch_username primeiro
          const { data: profileByTwitch } = await supabase
            .from('profiles')
            .select('id, nome, twitch_username, nome_personagem')
            .ilike('twitch_username', nomeParaExibir)
            .maybeSingle();
          
          // Se não encontrou por twitch_username, buscar por nome
          const { data: profileByName } = profileByTwitch ? { data: null } : await supabase
            .from('profiles')
            .select('id, nome, twitch_username, nome_personagem')
            .ilike('nome', nomeParaExibir)
            .maybeSingle();
          
          const profileData = profileByTwitch || profileByName;
          console.log("📋 Perfil encontrado:", profileData);
          
          if (profileData?.nome_personagem) {
            setNomePersonagem(profileData.nome_personagem);
            console.log("✅ Personagem:", profileData.nome_personagem);
          } else {
            setNomePersonagem("NÃO CADASTRADO");
            console.log("⚠️ Personagem não cadastrado");
          }
        } catch (error) {
          console.error("Erro ao buscar personagem:", error);
          setNomePersonagem("NÃO CADASTRADO");
        }
      }
      
      // Pequeno delay antes de mostrar o resultado para criar suspense
      setTimeout(() => {
        setShowResultDialog(true);
        launchConfetti();
        // Tocar som de recompensa
        if (rewardAudioRef.current) {
          rewardAudioRef.current.currentTime = 0;
          rewardAudioRef.current.play().catch(() => {});
        }
      }, 500);

      // Se for modo teste, não precisa salvar nada
      if (isModoTeste) {
        return;
      }

      // Modo real: adicionar Rubini Coins automaticamente
      if (sorteada.tipo === "Rubini Coins") {
        try {
          await supabase.functions.invoke('add-rubini-coins', {
            body: {
              userId: profileData?.id || null,
              twitchUsername: profileData?.id ? null : nomeParaExibir,
              quantidade: parseInt(sorteada.valor),
              motivo: `Roleta: ${wheel.nome}`
            }
          });
        } catch (error) {
          console.error('Erro ao adicionar Rubini Coins:', error);
        }
      }
    }, duracaoMs + 500);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isModoTeste ? "🎮 Teste: " : "Girar: "}{wheel?.nome}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {!testMode && isAdmin && (
              <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                <Checkbox
                  id="modoTeste"
                  checked={isModoTeste}
                  onCheckedChange={(checked) => setIsModoTeste(checked as boolean)}
                  disabled={spinning}
                />
                <Label
                  htmlFor="modoTeste"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Modo Teste (não salva no histórico nem distribui prêmios)
                </Label>
              </div>
            )}

            {isModoTeste && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                  🎮 Modo Simulação Ativo - Nenhum dado será salvo
                </p>
              </div>
            )}

            {!isModoTeste && (
              <div>
                <Label htmlFor="usuario">Nome do Usuário</Label>
                <Input
                  id="usuario"
                  value={nomeUsuario}
                  onChange={(e) => setNomeUsuario(e.target.value)}
                  placeholder="Digite o nome do usuário"
                  disabled={spinning}
                />
              </div>
            )}

            {wheel && (
              <div className="flex justify-center py-4">
                <CanvasWheel
                  recompensas={wheel.recompensas}
                  rotation={rotation}
                  spinning={spinning}
                  labelFontSize={28}
                  duracaoSpin={wheel.duracao_spin || 4}
                />
              </div>
            )}

            <Button
              onClick={spin}
              disabled={spinning || (isAdmin && !isModoTeste && !nomeUsuario.trim())}
              className="w-full bg-gradient-primary shadow-glow"
              size="lg"
            >
              {spinning ? "Girando..." : isModoTeste ? "🎮 Testar Roleta" : "Girar Roleta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Resultado */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-md">
          <div className="text-center space-y-6 py-6">
            <div className="text-6xl animate-bounce">🎉</div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent">
                {isModoTeste ? "🎮 Teste!" : "Parabéns!"}
              </h2>
              <p className="text-xl font-semibold text-foreground">
                {nomeVencedor}
              </p>
            </div>

            {resultado && (
              <div className="p-6 bg-gradient-card rounded-lg shadow-glow space-y-4">
                <div>
                  <p className="text-lg text-muted-foreground mb-2">Ganhou:</p>
                  <p className="text-4xl font-bold text-foreground">
                    {resultado.valor} {resultado.tipo}
                  </p>
                </div>
                
                {/* Mostrar pontos atuais e futuros para Pontos de Loja */}
                {resultado.tipo === "Pontos de Loja" && !isModoTeste && (
                  <div className="pt-4 border-t border-border space-y-2">
                    {carregandoPontos ? (
                      <p className="text-sm text-muted-foreground">Carregando pontos...</p>
                    ) : pontosAtuais !== null ? (
                      <>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">Pontos Atuais:</p>
                          <p className="text-lg font-semibold">{pontosAtuais.toLocaleString()}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">Após Prêmio:</p>
                          <p className="text-lg font-bold text-primary">
                            {(pontosAtuais + parseInt(resultado.valor)).toLocaleString()}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Não foi possível carregar os pontos do usuário
                      </p>
                    )}
                  </div>
                )}
                
                {/* Mostrar tickets atuais e futuros para Tickets */}
                {resultado.tipo === "Tickets" && !isModoTeste && (
                  <div className="pt-4 border-t border-border space-y-2">
                    {carregandoTickets ? (
                      <p className="text-sm text-muted-foreground">Carregando tickets...</p>
                    ) : ticketsAtuais !== null ? (
                      <>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">Tickets Atuais:</p>
                          <p className="text-lg font-semibold">{ticketsAtuais}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">Após Prêmio:</p>
                          <p className="text-lg font-bold text-primary">
                            {ticketsAtuais + parseInt(resultado.valor)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Não foi possível carregar os tickets do usuário
                      </p>
                    )}
                  </div>
                )}
                
                {resultado.tipo === "Rubini Coins" && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">Personagem:</p>
                    {nomePersonagem && nomePersonagem !== "NÃO CADASTRADO" ? (
                      <p className="text-xl font-semibold text-primary">
                        {nomePersonagem}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                          ⚠️ Usuário ainda não cadastrou o nome do personagem
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Peça para o usuário acessar as Configurações da Conta e cadastrar
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {isModoTeste ? (
              <Button
                onClick={() => {
                  setShowResultDialog(false);
                  setResultado(null);
                  setRotation(0);
                  setNomeVencedor("");
                }}
                className="w-full bg-gradient-primary"
                size="lg"
              >
                OK
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button
                  onClick={handleCancelPrize}
                  variant="outline"
                  disabled={awaitingConfirmation}
                  className="flex-1"
                  size="lg"
                >
                  Cancelar Prêmio
                </Button>
                <Button
                  onClick={handleConfirmPrize}
                  disabled={awaitingConfirmation}
                  className="flex-1 bg-gradient-primary"
                  size="lg"
                >
                  {awaitingConfirmation ? "Processando..." : "Dar Prêmio"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
