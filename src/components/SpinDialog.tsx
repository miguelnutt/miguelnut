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
    } else {
      setIsModoTeste(testMode);
    }
  }, [open, testMode]);

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

    setSpinning(true);
    setResultado(null);

    // Sortear uma recompensa aleatória
    const indexSorteado = Math.floor(Math.random() * wheel.recompensas.length);
    const sorteada = wheel.recompensas[indexSorteado];
    
    // Calcular rotação para que o item sorteado fique sob a seta (no topo)
    const voltas = 8; // Número de voltas completas
    const grausPorSecao = 360 / wheel.recompensas.length;
    
    // Ângulo necessário para colocar o item sorteado no topo (onde está a seta)
    // Precisamos girar para que o centro do segmento sorteado fique no topo
    const anguloDoSegmento = indexSorteado * grausPorSecao + (grausPorSecao / 2);
    
    // Rotação total: voltas completas + ajuste para o segmento sorteado
    // Subtraímos o ângulo do segmento porque a roleta gira no sentido horário
    const novaRotacao = (voltas * 360) + (360 - anguloDoSegmento);
    
    setRotation(novaRotacao);

    // Aguardar animação
    setTimeout(async () => {
      setResultado(sorteada);
      const nomeParaExibir = nomeUsuario.trim() || "Visitante";
      setNomeVencedor(nomeParaExibir);
      setSpinning(false);

      // Se for modo teste, apenas mostrar resultado sem salvar
      if (isModoTeste) {
        toast.success(`🎮 TESTE: ${nomeParaExibir} ganhou ${sorteada.valor} ${sorteada.tipo}!`, {
          description: "Modo simulação - nada foi salvo"
        });
        return;
      }

      try {
        // Usar a função que busca ou cria o perfil automaticamente
        const { data: userId, error: profileError } = await supabase
          .rpc("get_or_create_profile_by_name", { p_nome: nomeUsuario.trim() });

        if (profileError) {
          console.error("Error getting/creating profile:", profileError);
          toast.error("Erro ao processar usuário");
          return;
        }

        // Salvar o spin
        const { error: spinError } = await supabase
          .from("spins")
          .insert({
            wheel_id: wheel.id,
            user_id: userId,
            nome_usuario: nomeUsuario.trim(),
            tipo_recompensa: sorteada.tipo,
            valor: sorteada.valor
          });

        if (spinError) throw spinError;

        // Se ganhou ticket, atualizar (NÃO sincroniza com StreamElements)
        if (sorteada.tipo === "Tickets" && userId) {
          const ticketsGanhos = parseInt(sorteada.valor) || 1;

          // Buscar tickets atuais
          const { data: ticketsData } = await supabase
            .from("tickets")
            .select("tickets_atual")
            .eq("user_id", userId)
            .maybeSingle();

          const ticketsAtuais = ticketsData?.tickets_atual || 0;

          // Upsert tickets
          const { error: ticketsError } = await supabase
            .from("tickets")
            .upsert({
              user_id: userId,
              tickets_atual: ticketsAtuais + ticketsGanhos
            });

          if (ticketsError) throw ticketsError;

          // Salvar no ledger
          await supabase
            .from("ticket_ledger")
            .insert({
              user_id: userId,
              variacao: ticketsGanhos,
              motivo: `Ganhou ${ticketsGanhos} ticket(s) na roleta ${wheel.nome}`
            });
        }

        // Se ganhou Pontos de Loja, sincronizar com StreamElements
        if (sorteada.tipo === "Pontos de Loja") {
          const pontosGanhos = parseInt(sorteada.valor) || 0;
          if (pontosGanhos > 0) {
            try {
              await supabase.functions.invoke('sync-streamelements-points', {
                body: {
                  username: nomeUsuario.trim(),
                  points: pontosGanhos
                }
              });
              console.log(`StreamElements sync: ${nomeUsuario.trim()} ganhou ${pontosGanhos} pontos de loja`);
            } catch (seError: any) {
              console.error("StreamElements sync error:", seError);
              // Não bloquear a operação se StreamElements falhar
            }
          }
        }

        // Se ganhou Rubini Coins, não faz nada (pago fora do site)

        toast.success(`${nomeUsuario} ganhou: ${sorteada.valor} ${sorteada.tipo}!`);
      } catch (error: any) {
        console.error("Error saving spin:", error);
        toast.error("Erro ao salvar resultado: " + error.message);
      }
    }, 4000);
  };

  return (
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

          <div>
            <Label htmlFor="usuario">Nome do Usuário {isModoTeste && "(Opcional)"}</Label>
            <Input
              id="usuario"
              value={nomeUsuario}
              onChange={(e) => setNomeUsuario(e.target.value)}
              placeholder={isModoTeste ? "Nome para exibir (opcional)" : "Digite o nome do usuário"}
              disabled={spinning}
            />
          </div>

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

          {resultado && (
            <div className="text-center p-4 bg-gradient-card rounded-lg shadow-card animate-pulse-glow">
              <h3 className="text-2xl font-bold mb-2">🎉 Resultado! 🎉</h3>
              <p className="text-xl">
                <span className="font-bold">{nomeVencedor}</span> ganhou:
              </p>
              <p className="text-3xl font-bold mt-2" style={{ color: resultado.cor }}>
                {resultado.valor} {resultado.tipo}
              </p>
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
  );
}
