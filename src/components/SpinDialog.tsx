import { useState, useEffect } from "react";
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
      
      // Usar a função que busca ou cria o perfil automaticamente
      const { data: userId, error: profileError } = await supabase
        .rpc("get_or_create_profile_by_name", { p_nome: nomeParaUsar });

      if (profileError) {
        console.error("Error getting/creating profile:", profileError);
        toast.error("Erro ao processar usuário");
        setAwaitingConfirmation(false);
        return;
      }

      // Salvar o spin
      const { error: spinError } = await supabase
        .from("spins")
        .insert({
          wheel_id: wheel.id,
          user_id: userId,
          nome_usuario: nomeParaUsar,
          tipo_recompensa: resultado.tipo,
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

        const { error: ticketsError } = await supabase
          .from("tickets")
          .upsert({
            user_id: userId,
            tickets_atual: ticketsAtuais + ticketsGanhos
          });

        if (ticketsError) throw ticketsError;

        await supabase
          .from("ticket_ledger")
          .insert({
            user_id: userId,
            variacao: ticketsGanhos,
            motivo: `Ganhou ${ticketsGanhos} ticket(s) na roleta ${wheel.nome}`
          });
      }

      // Se ganhou Pontos de Loja, sincronizar com StreamElements
      if (resultado.tipo === "Pontos de Loja") {
        const pontosGanhos = parseInt(resultado.valor) || 0;
        if (pontosGanhos > 0) {
          try {
            await supabase.functions.invoke('sync-streamelements-points', {
              body: {
                username: nomeParaUsar,
                points: pontosGanhos
              }
            });
            console.log(`StreamElements sync: ${nomeParaUsar} ganhou ${pontosGanhos} pontos de loja`);
          } catch (seError: any) {
            console.error("StreamElements sync error:", seError);
          }
        }
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

    // Aguardar animação (4.5s para dar tempo do suspense)
    setTimeout(async () => {
      const nomeParaExibir = nomeUsuario.trim() || "Visitante";
      setNomeVencedor(nomeParaExibir);
      setResultado(sorteada);
      setSpinning(false);
      
      // Pequeno delay antes de mostrar o resultado para criar suspense
      setTimeout(() => {
        setShowResultDialog(true);
        launchConfetti();
      }, 500);

      // Se for modo teste, não precisa salvar nada
      if (isModoTeste) {
        // Apenas mostra o resultado, sem ações de salvar
        return;
      }
    }, 4500);
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
              <div className="p-6 bg-gradient-card rounded-lg shadow-glow">
                <p className="text-lg text-muted-foreground mb-2">Ganhou:</p>
                <p className="text-4xl font-bold" style={{ color: resultado.cor }}>
                  {resultado.valor} {resultado.tipo}
                </p>
              </div>
            )}

            {isModoTeste ? (
              <Button
                onClick={() => {
                  setShowResultDialog(false);
                  setResultado(null);
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
