import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { z } from "zod";
import confetti from "canvas-confetti";
import rewardSound from "@/assets/achievement-unlocked-waterway-music-1-00-02.mp3";

interface Participante {
  user_id: string;
  nome: string;
  tickets: number;
  nome_personagem?: string;
}

interface RaffleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type TipoPremio = "Pontos de Loja" | "Rubini Coins";

const raffleSchema = z.object({
  observacoes: z.string().trim().max(1000, "Observações muito longas (máximo 1000 caracteres)").optional()
});

export function RaffleDialog({ open, onOpenChange, onSuccess }: RaffleDialogProps) {
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [participantesSelecionados, setParticipantesSelecionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [vencedor, setVencedor] = useState<Participante | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [isModoTeste, setIsModoTeste] = useState(false);
  const [tipoPremio, setTipoPremio] = useState<TipoPremio>("Rubini Coins");
  const [valorPremio, setValorPremio] = useState<number>(25);
  const [pontosAtuaisVencedor, setPontosAtuaisVencedor] = useState<number | null>(null);
  const [carregandoPontos, setCarregandoPontos] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const rewardAudioRef = useRef<HTMLAudioElement | null>(null);

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
    if (open) {
      fetchParticipantes();
      setVencedor(null);
      setIsModoTeste(false);
      setTipoPremio("Rubini Coins");
      setValorPremio(25);
      setShowResultDialog(false);
      setAwaitingConfirmation(false);
      setPontosAtuaisVencedor(null);
    }
  }, [open]);

  const fetchParticipantes = async () => {
    try {
      console.log("Buscando participantes do sorteio...");
      const { data: ticketsData, error } = await supabase
        .from("tickets")
        .select(`
          user_id,
          tickets_atual,
          profiles(nome, nome_personagem, twitch_username)
        `)
        .gt("tickets_atual", 0);

      if (error) throw error;

      console.log("Dados brutos dos tickets:", ticketsData);

      const participantesList: Participante[] = (ticketsData || []).map((t: any) => {
        console.log("Processando participante:", {
          user_id: t.user_id,
          nome: t.profiles?.nome,
          nome_personagem: t.profiles?.nome_personagem,
          tickets: t.tickets_atual
        });
        return {
          user_id: t.user_id,
          nome: t.profiles?.nome || "Usuário desconhecido",
          tickets: t.tickets_atual,
          nome_personagem: t.profiles?.nome_personagem || undefined
        };
      });

      console.log("Lista final de participantes:", participantesList);
      setParticipantes(participantesList);
      // Inicialmente todos estão selecionados
      setParticipantesSelecionados(new Set(participantesList.map(p => p.user_id)));
    } catch (error: any) {
      console.error("Error fetching participants:", error);
      toast.error("Erro ao carregar participantes");
    }
  };

  const calcularProbabilidade = (tickets: number, total: number) => {
    return ((tickets / total) * 100).toFixed(1);
  };

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

  const toggleParticipante = (userId: string) => {
    setParticipantesSelecionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleTodos = () => {
    if (participantesSelecionados.size === participantes.length) {
      setParticipantesSelecionados(new Set());
    } else {
      setParticipantesSelecionados(new Set(participantes.map(p => p.user_id)));
    }
  };

  const realizarSorteio = async () => {
    const participantesAtivos = participantes.filter(p => participantesSelecionados.has(p.user_id));
    
    if (participantesAtivos.length === 0) {
      toast.error("Selecione pelo menos um participante");
      return;
    }

    // Validate observacoes if needed
    const validation = raffleSchema.safeParse({ observacoes: observacoes || undefined });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setDrawing(true);

    // Calcular total de tickets apenas dos participantes ativos
    const totalTickets = participantesAtivos.reduce((sum, p) => sum + p.tickets, 0);

    // Sortear um número aleatório
    let sorteio = Math.floor(Math.random() * totalTickets);

    // Determinar vencedor baseado nos tickets (apenas dos ativos)
    let vencedorSorteado: Participante | null = null;
    for (const participante of participantesAtivos) {
      sorteio -= participante.tickets;
      if (sorteio < 0) {
        vencedorSorteado = participante;
        break;
      }
    }

    if (!vencedorSorteado) {
      vencedorSorteado = participantesAtivos[0];
    }

    // Animação de sorteio
    setTimeout(async () => {
      setVencedor(vencedorSorteado);
      setDrawing(false);

      // Se for Pontos de Loja, buscar pontos atuais do vencedor
      if (tipoPremio === "Pontos de Loja" && !isModoTeste) {
        setCarregandoPontos(true);
        try {
          const { data, error } = await supabase.functions.invoke('get-streamelements-points', {
            body: { username: vencedorSorteado.nome }
          });
          
          if (!error && data?.points !== undefined) {
            setPontosAtuaisVencedor(data.points);
          } else {
            setPontosAtuaisVencedor(null);
          }
        } catch (error) {
          console.error("Erro ao buscar pontos:", error);
          setPontosAtuaisVencedor(null);
        } finally {
          setCarregandoPontos(false);
        }
      }

      // Mostrar dialog de resultado
      setTimeout(() => {
        setShowResultDialog(true);
        launchConfetti();
        // Tocar som de recompensa
        if (rewardAudioRef.current) {
          rewardAudioRef.current.currentTime = 0;
          rewardAudioRef.current.play().catch(() => {});
        }
      }, 500);
    }, 3000);
  };

  const handleConfirmPrize = async () => {
    if (!vencedor) return;

    setAwaitingConfirmation(true);

    try {
      // Se for modo teste, apenas fechar
      if (isModoTeste) {
        toast.success(`🎮 TESTE: ${vencedor.nome} ganhou o sorteio!`, {
          description: "Modo simulação - tickets não foram zerados e nada foi salvo"
        });
        setShowResultDialog(false);
        onOpenChange(false);
        return;
      }

      // Salvar sorteio com prêmio
      const { data: raffleData, error: raffleError } = await supabase
        .from("raffles")
        .insert({
          vencedor_id: vencedor.user_id,
          nome_vencedor: vencedor.nome,
          tipo_premio: tipoPremio,
          valor_premio: valorPremio,
          participantes: participantes.map(p => ({
            user_id: p.user_id,
            nome: p.nome,
            tickets: p.tickets
          }))
        })
        .select()
        .single();

      if (raffleError) throw raffleError;

      // Se for Pontos de Loja, sincronizar com StreamElements
      if (tipoPremio === "Pontos de Loja" && raffleData) {
        try {
          await supabase.functions.invoke('sync-streamelements-points', {
            body: {
              username: vencedor.nome,
              points: valorPremio,
              tipo_operacao: 'raffle',
              referencia_id: raffleData.id,
              user_id: vencedor.user_id
            }
          });
          console.log(`StreamElements sync com logs: ${vencedor.nome} ganhou ${valorPremio} pontos de loja`);
        } catch (seError: any) {
          console.error("StreamElements sync error:", seError);
          toast.error("Erro ao sincronizar pontos com StreamElements");
        }
      }

      // Se for Rubini Coins, adicionar ao saldo automaticamente
      if (tipoPremio === "Rubini Coins") {
        try {
          // Adicionar Rubini Coins ao saldo
          const { error: rubiniError } = await supabase.functions.invoke('add-rubini-coins', {
            body: {
              userId: vencedor.user_id,
              quantidade: valorPremio,
              motivo: `Ganhou sorteio - Prêmio: ${valorPremio} Rubini Coins`
            }
          });
          
          if (rubiniError) {
            console.error("Erro ao adicionar Rubini Coins:", rubiniError);
            toast.warning("Rubini Coins não foram adicionados automaticamente");
          } else {
            console.log(`Rubini Coins adicionados: ${vencedor.nome} ganhou ${valorPremio} RC`);
          }
        } catch (rcError: any) {
          console.error("Erro ao adicionar Rubini Coins:", rcError);
        }
      }

      // Zerar tickets do vencedor
      const { error: ticketsError } = await supabase
        .from("tickets")
        .update({ tickets_atual: 0 })
        .eq("user_id", vencedor.user_id);

      if (ticketsError) throw ticketsError;

      // Salvar no ledger
      await supabase
        .from("ticket_ledger")
        .insert({
          user_id: vencedor.user_id,
          variacao: -vencedor.tickets,
          motivo: "Ganhou sorteio - tickets zerados"
        });

      toast.success(`Prêmio entregue: ${valorPremio} ${tipoPremio} para ${vencedor.nome}!`);
      setShowResultDialog(false);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error confirming prize:", error);
      toast.error("Erro ao confirmar prêmio: " + error.message);
    } finally {
      setAwaitingConfirmation(false);
    }
  };

  const handleCancelPrize = () => {
    toast.info("Sorteio cancelado");
    setShowResultDialog(false);
    setVencedor(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isModoTeste ? "🎮 Teste: " : ""}Realizar Sorteio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="modoTesteSorteio"
              checked={isModoTeste}
              onCheckedChange={(checked) => setIsModoTeste(checked as boolean)}
              disabled={drawing}
            />
            <Label
              htmlFor="modoTesteSorteio"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Modo Teste (não zera tickets e não salva no histórico)
            </Label>
          </div>

          {isModoTeste && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                🎮 Modo Simulação Ativo - Tickets não serão zerados e nada será salvo
              </p>
            </div>
          )}

          {/* Seleção de Prêmio */}
          <div className="space-y-3 p-4 bg-gradient-card rounded-lg">
            <h3 className="font-semibold text-sm">Prêmio do Sorteio</h3>
            <div className="grid gap-3">
              <div>
                <Label htmlFor="tipoPremio" className="text-sm">Tipo de Prêmio</Label>
                <select
                  id="tipoPremio"
                  value={tipoPremio}
                  onChange={(e) => {
                    const newTipo = e.target.value as TipoPremio;
                    setTipoPremio(newTipo);
                    // Se mudou para Rubini Coins, ajustar para múltiplo de 25
                    if (newTipo === "Rubini Coins") {
                      const rounded = Math.round(valorPremio / 25) * 25 || 25;
                      setValorPremio(rounded);
                    }
                  }}
                  disabled={drawing}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="Pontos de Loja">Pontos de Loja</option>
                  <option value="Rubini Coins">Rubini Coins</option>
                </select>
              </div>
              <div>
                <Label htmlFor="valorPremio" className="text-sm">
                  Valor {tipoPremio === "Rubini Coins" && "(múltiplos de 25)"}
                </Label>
                <Input
                  id="valorPremio"
                  type="number"
                  min={tipoPremio === "Rubini Coins" ? 25 : 1}
                  step={tipoPremio === "Rubini Coins" ? 25 : 1}
                  value={valorPremio}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    if (tipoPremio === "Rubini Coins") {
                      const rounded = Math.round(value / 25) * 25 || 25;
                      setValorPremio(rounded);
                    } else {
                      setValorPremio(value);
                    }
                  }}
                  disabled={drawing}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {tipoPremio === "Rubini Coins"
                    ? "Somente múltiplos de 25 são permitidos" 
                    : "Digite a quantidade de pontos"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">
                Participantes ({participantes.filter(p => participantesSelecionados.has(p.user_id)).length}/{participantes.length})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTodos}
                disabled={drawing}
              >
                {participantesSelecionados.size === participantes.length ? "Desmarcar Todos" : "Marcar Todos"}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {participantes.map((p) => {
                const participantesAtivos = participantes.filter(p => participantesSelecionados.has(p.user_id));
                const totalTickets = participantesAtivos.reduce((sum, item) => sum + item.tickets, 0);
                const probabilidade = participantesSelecionados.has(p.user_id) 
                  ? calcularProbabilidade(p.tickets, totalTickets) 
                  : "0.0";
                const isSelected = participantesSelecionados.has(p.user_id);
                
                return (
                  <div
                    key={p.user_id}
                    className={`p-3 bg-gradient-card rounded-lg space-y-2 transition-opacity ${!isSelected ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleParticipante(p.user_id)}
                        disabled={drawing}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">{p.nome}</span>
                          <span className="text-sm font-semibold text-primary">
                            {probabilidade}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-full rounded-full transition-all"
                              style={{ width: isSelected ? `${probabilidade}%` : '0%' }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground min-w-[80px] text-right">
                            {p.tickets} {p.tickets === 1 ? "ticket" : "tickets"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {drawing && (
            <div className="text-center py-8">
              <div className="animate-spin-wheel text-6xl mb-4">🎰</div>
              <p className="text-lg font-semibold">Sorteando...</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={drawing}
          >
            Fechar
          </Button>
          <Button
            onClick={realizarSorteio}
            disabled={drawing || participantes.filter(p => participantesSelecionados.has(p.user_id)).length === 0}
            className="bg-gradient-primary"
          >
            {drawing ? "Sorteando..." : isModoTeste ? "🎮 Testar Sorteio" : "Sortear Vencedor"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Dialog de Resultado */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-md">
          <div className="text-center space-y-6 py-6">
            <div className="text-6xl animate-bounce">🎉</div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent">
                {isModoTeste ? "🎮 Teste!" : "Vencedor!"}
              </h2>
              <p className="text-xl font-semibold text-foreground">
                {vencedor?.nome}
              </p>
              <p className="text-sm text-muted-foreground">
                Tinha {vencedor?.tickets} {vencedor?.tickets === 1 ? "ticket" : "tickets"}
              </p>
            </div>

            {vencedor && (
              <div className="p-6 bg-gradient-card rounded-lg shadow-glow space-y-4">
                <div>
                  <p className="text-lg text-muted-foreground mb-2">Ganhou:</p>
                  <p className="text-4xl font-bold text-foreground">
                    {valorPremio} {tipoPremio}
                  </p>
                </div>
                
                {/* Mostrar pontos atuais e futuros para Pontos de Loja */}
                {tipoPremio === "Pontos de Loja" && !isModoTeste && (
                  <div className="pt-4 border-t border-border space-y-2">
                    {carregandoPontos ? (
                      <p className="text-sm text-muted-foreground">Carregando pontos...</p>
                    ) : pontosAtuaisVencedor !== null ? (
                      <>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">Pontos Atuais:</p>
                          <p className="text-lg font-semibold">{pontosAtuaisVencedor.toLocaleString()}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">Após Prêmio:</p>
                          <p className="text-lg font-bold text-primary">
                            {(pontosAtuaisVencedor + valorPremio).toLocaleString()}
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
                
                {tipoPremio === "Rubini Coins" && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">Personagem:</p>
                    {vencedor.nome_personagem ? (
                      <p className="text-xl font-semibold text-primary">
                        {vencedor.nome_personagem}
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
                  setVencedor(null);
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
    </Dialog>
  );
}
