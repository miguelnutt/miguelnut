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
import { useAuth } from "@/contexts/AuthContext";
import { useAdminMode } from "@/contexts/AdminModeContext";
import confetti from "canvas-confetti";
import rewardSound from "@/assets/achievement-unlocked-waterway-music-1-00-02.mp3";
import { removeAtSymbol, prepareUsernameForSearch } from "@/lib/username-utils";

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
  loggedUser?: any;
  twitchUser?: { login: string; id: string; display_name: string } | null;
}


const spinInputSchema = z.object({
  nomeUsuario: z.string().trim().min(1, "Usuário Twitch é obrigatório").max(100, "Nome muito longo (máximo 100 caracteres)")
});

export function SpinDialog({ open, onOpenChange, wheel, testMode = false, loggedUser, twitchUser }: SpinDialogProps) {
  const { isAdmin } = useAuth();
  const { isAdminMode } = useAdminMode();
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

  // Função para buscar tickets atuais do usuário
  const buscarTicketsAtuais = async (nomeUsuario: string) => {
    setCarregandoTickets(true);
    try {
      // Buscar perfil por twitch_username
      const searchTerm = prepareUsernameForSearch(nomeUsuario);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .ilike('twitch_username', searchTerm)
        .maybeSingle();
      
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
  };

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
      
      console.log("[Roulette] 🎯 Resolvendo identidade para:", nomeParaUsar);
      console.log("[Roulette] 🔍 Usuário logado:", { twitchUser: twitchUser?.login, twitchId: twitchUser?.id });
      
      // Usar a edge function resolve-user-identity para obter o perfil canônico
      // Se o usuário estiver logado, usar o twitch_user_id para garantir que encontre o perfil correto
      const searchTermWithAt = prepareUsernameForSearch(nomeParaUsar);
      const { data: identityData, error: identityError } = await supabase.functions.invoke('resolve-user-identity', {
        body: {
          searchTerm: searchTermWithAt,
          twitch_user_id: twitchUser?.id || null
        }
      });

      if (identityError || !identityData?.canonicalProfile) {
        console.error("[Roulette] ❌ Erro ao resolver identidade:", identityError);
        
        // Para Pontos de Loja, ainda tentar entregar mesmo sem perfil
        if (resultado.tipo === "Pontos de Loja") {
          console.log("[Roulette] 🎯 Tentando entregar Pontos de Loja mesmo sem perfil resolvido");
          
          try {
            const pontosGanhos = parseInt(resultado.valor) || 0;
            
            const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-streamelements-points', {
              body: {
                username: nomeParaUsar,
                points: pontosGanhos,
                tipo_operacao: 'spin_fallback',
                referencia_id: wheel.id,
                user_id: null // Sem user_id pois não foi possível resolver
              }
            });
            
            if (syncError) {
              console.error("❌ Erro ao sincronizar pontos (fallback):", syncError);
              toast.error(`Erro ao entregar ${pontosGanhos} pontos de loja para ${nomeParaUsar}`);
            } else {
              console.log("✅ Pontos de Loja entregues via fallback:", syncData);
              toast.success(`${nomeParaUsar} ganhou +${pontosGanhos} pontos de loja!`);
              
              // Salvar spin sem user_id
              await supabase
                .from("spins")
                .insert({
                  wheel_id: wheel.id,
                  user_id: null,
                  nome_usuario: nomeParaUsar,
                  tipo_recompensa: resultado.tipo,
                  valor: resultado.valor
                });
            }
          } catch (fallbackError: any) {
            console.error("❌ Erro no fallback de Pontos de Loja:", fallbackError);
            toast.error(`Falha ao entregar pontos: ${fallbackError.message}`);
          }
        } 
        // Para Tickets, salvar o registro mesmo sem perfil (para auditoria)
        else if (resultado.tipo === "Tickets") {
          console.log("[Roulette] 🎫 Salvando Tickets mesmo sem perfil resolvido (para auditoria)");
          
          try {
            const ticketsGanhos = parseInt(resultado.valor) || 1;
            
            // Salvar spin sem user_id para auditoria
            await supabase
              .from("spins")
              .insert({
                wheel_id: wheel.id,
                user_id: null,
                nome_usuario: nomeParaUsar,
                tipo_recompensa: resultado.tipo,
                valor: resultado.valor
              });
            
            console.log("✅ Tickets registrados para auditoria (sem perfil)");
            toast.success(`${nomeParaUsar} ganhou +${ticketsGanhos} ticket(s)! (Registrado para quando fizer login)`);
          } catch (fallbackError: any) {
            console.error("❌ Erro ao registrar Tickets:", fallbackError);
            toast.error(`Falha ao registrar tickets: ${fallbackError.message}`);
          }
        }
        // Para Rubini Coins, salvar o registro mesmo sem perfil (para auditoria)
        else if (resultado.tipo === "Rubini Coins") {
          console.log("[Roulette] 💰 Salvando Rubini Coins mesmo sem perfil resolvido (para auditoria)");
          
          try {
            const rubiniGanhos = parseInt(resultado.valor) || 0;
            
            // Salvar spin sem user_id para auditoria
            await supabase
              .from("spins")
              .insert({
                wheel_id: wheel.id,
                user_id: null,
                nome_usuario: nomeParaUsar,
                tipo_recompensa: resultado.tipo,
                valor: resultado.valor
              });
            
            console.log("✅ Rubini Coins registrados para auditoria (sem perfil)");
            toast.success(`${nomeParaUsar} ganhou +${rubiniGanhos} Rubini Coins! (Registrado para quando fizer login)`);
          } catch (fallbackError: any) {
            console.error("❌ Erro ao registrar Rubini Coins:", fallbackError);
            toast.error(`Falha ao registrar Rubini Coins: ${fallbackError.message}`);
          }
        } else {
          toast.error("Erro ao processar usuário - prêmio não pode ser entregue");
        }
        
        setShowResultDialog(false);
        onOpenChange(false);
        setAwaitingConfirmation(false);
        return;
      }

      const userId = identityData.canonicalProfile.id;
      const profileData = identityData.canonicalProfile;
      
      // Log se foi criado um perfil temporário
      if (identityData.canonicalProfile && !identityData.canonicalProfile.twitch_user_id) {
        console.log("[Roulette] 🆕 Perfil temporário criado/usado para:", {
          userId,
          twitch_username: profileData.twitch_username,
          isTemporary: true
        });
      }
      
      console.log("[Roulette] ✅ Perfil canônico resolvido:", {
        userId,
        twitch_username: profileData.twitch_username,
        twitch_user_id: profileData.twitch_user_id,
        hasDuplicates: identityData.hasDuplicates
      });


      // Se for Rubini Coins, usar o nome_personagem do perfil encontrado
      let personagemInfo = null;
      if (resultado.tipo === "Rubini Coins") {
        console.log("🎮 Verificando personagem para Rubini Coins");
        console.log("📋 Dados do perfil:", {
          id: profileData?.id,
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
          console.log("   - Twitch Username:", profileData?.twitch_username);
        }
      }

      // Salvar o spin com tipo padronizado
      const tipoParaSalvar = resultado.tipo;
      console.log("💾 Salvando spin:", {
        tipo: tipoParaSalvar,
        valor: resultado.valor,
        nome_usuario: nomeParaUsar,
        userId
      });
      
      const { data: spinData, error: spinError } = await supabase
        .from("spins")
        .insert({
          wheel_id: wheel.id,
          user_id: userId,
          nome_usuario: nomeParaUsar,
          tipo_recompensa: tipoParaSalvar,
          valor: resultado.valor
        })
        .select()
        .single();

      if (spinError) {
        console.error("❌ Erro ao salvar spin:", spinError);
        throw spinError;
      }
      
      console.log("✅ Spin salvo com sucesso", spinData);

      // Se ganhou ticket, usar serviço unificado
      if (resultado.tipo === "Tickets") {
        const ticketsGanhos = parseInt(resultado.valor) || 1;
        const idempotencyKey = `spin-${spinData?.id}-tickets`;

        try {
          const { data: awardData, error: awardError } = await supabase.functions.invoke('award-reward', {
            body: {
              userId,
              type: 'tickets',
              value: ticketsGanhos,
              source: 'roulette',
              idempotencyKey,
              reason: `Ganhou ${ticketsGanhos} ticket(s) na roleta ${wheel.nome}`
            }
          });

          if (awardError) {
            console.error('Error awarding tickets via award-reward:', awardError);
            throw awardError;
          }

          console.log(`Tickets awarded via unified service:`, awardData);
          
          // Atualizar o saldo de tickets na interface
          await buscarTicketsAtuais(nomeParaUsar);
          
          // Indicar se foi para perfil temporário
          const successMessage = profileData?.twitch_user_id 
            ? `${nomeParaUsar} ganhou +${ticketsGanhos} ticket(s)! (Novo saldo: ${awardData.newBalance})`
            : `${nomeParaUsar} ganhou +${ticketsGanhos} ticket(s)! (Perfil temporário - saldo: ${awardData.newBalance})`;
          
          toast.success(successMessage);
        } catch (error) {
          console.error('Error awarding tickets:', error);
          toast.error('Erro ao conceder tickets');
          throw error;
        }
        
        setShowResultDialog(false);
        onOpenChange(false);
        setAwaitingConfirmation(false);
        return;
      }

      // Se ganhou Pontos de Loja, sincronizar com StreamElements
      console.log("🔍 Verificando tipo de recompensa:", resultado.tipo);
      
      if (resultado.tipo === "Pontos de Loja") {
        const pontosGanhos = parseInt(resultado.valor) || 0;
        
        console.log(`🎯 INICIANDO sincronização de Pontos de Loja:`, {
          pontosGanhos,
          nomeParaUsar,
          tipo: resultado.tipo,
          userId,
          hasTemporaryProfile: !profileData?.twitch_user_id
        });
        
        try {
          const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-streamelements-points', {
            body: {
              username: nomeParaUsar,
              points: pontosGanhos,
              tipo_operacao: profileData?.twitch_user_id ? 'spin' : 'spin_temporary_profile',
              referencia_id: wheel.id,
              user_id: userId
            }
          });
          
          console.log("📡 Resposta da sincronização:", { syncData, syncError });
          
          if (syncError) {
            console.error("❌ Erro ao sincronizar pontos com StreamElements:", syncError);
            toast.error(`Erro ao sincronizar ${pontosGanhos} pontos de loja para ${nomeParaUsar} no StreamElements`);
            
            // Mesmo com erro no StreamElements, salvar o spin para auditoria
            try {
              await supabase
                .from("spins")
                .insert({
                  wheel_id: wheel.id,
                  user_id: userId,
                  nome_usuario: nomeParaUsar,
                  tipo_recompensa: resultado.tipo,
                  valor: resultado.valor
                });
              console.log("📝 Spin salvo para auditoria mesmo com erro no StreamElements");
            } catch (spinSaveError) {
              console.error("❌ Erro ao salvar spin para auditoria:", spinSaveError);
            }
            
            throw syncError;
          } else {
            console.log("✅ StreamElements sync bem-sucedido:", syncData);
            
            // Indicar se foi para perfil temporário
            const successMessage = profileData?.twitch_user_id 
              ? `${nomeParaUsar} ganhou +${pontosGanhos} pontos de loja!`
              : `${nomeParaUsar} ganhou +${pontosGanhos} pontos de loja! (Perfil temporário criado)`;
            
            toast.success(successMessage);
          }
        } catch (seError: any) {
          console.error("❌ Erro ao chamar função de sincronização StreamElements:", seError);
          toast.error(`Falha ao sincronizar pontos com StreamElements: ${seError.message}`);
        }
        
        setShowResultDialog(false);
        onOpenChange(false);
        setAwaitingConfirmation(false);
        return;
      }

      // Se ganhou Rubini Coins, adicionar ao saldo automaticamente COM IDEMPOTÊNCIA
      if (resultado.tipo === "Rubini Coins") {
        const rubiniGanhos = parseInt(resultado.valor) || 0;
        
        // Gerar idempotency_key único e consistente baseado em timestamp truncado
        const timestampTrunc = Math.floor(Date.now() / 1000) * 1000;
        const idempotencyKey = `roulette-${wheel.id}-${userId}-${timestampTrunc}`;
        
        try {
          console.log(`[Roulette] 💰 Creditando ${rubiniGanhos} Rubini Coins`, {
            action: 'roulette.pay.rc',
            userId,
            value: rubiniGanhos,
            idempotencyKey,
            wheelId: wheel.id
          });
          
          const { data, error: rubiniError } = await supabase.functions.invoke('add-rubini-coins', {
            body: {
              userId: userId,
              quantidade: rubiniGanhos,
              motivo: `Ganhou ${rubiniGanhos} Rubini Coins na roleta ${wheel.nome}`,
              idempotencyKey: idempotencyKey,
              origem: 'roulette',
              referenciaId: wheel.id
            }
          });
          
          if (rubiniError) {
            console.error("[Roulette] ❌ Erro ao creditar Rubini Coins:", rubiniError);
            toast.error("Erro ao creditar Rubini Coins. Operação registrada para reprocessamento.");
            throw rubiniError; // Lançar erro para garantir que a operação seja interrompida em caso de falha
          } else if (data?.duplicated) {
            console.log("[Roulette] ⚠️ Operação duplicada detectada");
            toast.info(`${nomeParaUsar} já havia recebido estes ${rubiniGanhos} Rubini Coins`);
          } else {
            console.log("[Roulette] ✅ Rubini Coins creditados", {
              action: 'roulette.pay.rc.confirmed',
              userId,
              value: rubiniGanhos
            });
            
            // Indicar se foi para perfil temporário
            const successMessage = profileData?.twitch_user_id 
              ? `${nomeParaUsar} ganhou +${rubiniGanhos} Rubini Coins!`
              : `${nomeParaUsar} ganhou +${rubiniGanhos} Rubini Coins! (Perfil temporário)`;
            
            toast.success(successMessage);
          }
        } catch (rcError: any) {
          console.error("[Roulette] ❌ Erro inesperado:", rcError);
          toast.error("Falha ao creditar Rubini Coins");
        }
        
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
      const nomeParaExibir = removeAtSymbol(nomeUsuario.trim()) || "Visitante";
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
        await buscarTicketsAtuais(nomeParaExibir);
      }
      
      // Se for Rubini Coins, buscar nome do personagem
      if (sorteada.tipo === "Rubini Coins" && !isModoTeste) {
        try {
          console.log("🎮 Buscando personagem para:", nomeParaExibir);
          
          // Buscar perfil ativo por twitch_username
          const searchTerm = prepareUsernameForSearch(nomeParaExibir);
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, twitch_username, nome_personagem')
            .ilike('twitch_username', searchTerm)
            .eq('is_active', true)
            .maybeSingle();
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

      // Modo real: Rubini Coins serão adicionados apenas quando o admin clicar em "dar prêmio"
    }, duracaoMs + 500);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" aria-describedby="spin-dialog-description">
          <DialogHeader>
            <DialogTitle>
              {isModoTeste ? "🎮 Teste: " : "Girar: "}{wheel?.nome}
            </DialogTitle>
            <p id="spin-dialog-description" className="sr-only">
              Insira o usuário Twitch e gire a roleta para sortear uma recompensa
            </p>
          </DialogHeader>

          <div className="space-y-6">
            {!testMode && isAdmin && isAdminMode && (
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
                <Label htmlFor="usuario">Usuário Twitch</Label>
                <Input
                  id="usuario"
                  value={nomeUsuario}
                  onChange={(e) => setNomeUsuario(e.target.value)}
                  placeholder="@nome_do_usuario"
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
              disabled={spinning || (isAdmin && isAdminMode && !isModoTeste && !nomeUsuario.trim())}
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
        <DialogContent className="max-w-md" aria-describedby="result-dialog-description">
          <DialogHeader>
            <DialogTitle className="sr-only">Resultado do Sorteio</DialogTitle>
            <p id="result-dialog-description" className="sr-only">
              Confirme o pagamento da recompensa sorteada ao usuário
            </p>
          </DialogHeader>
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
