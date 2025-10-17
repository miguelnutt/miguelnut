import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { z } from "zod";

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
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [vencedor, setVencedor] = useState<Participante | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [isModoTeste, setIsModoTeste] = useState(false);
  const [tipoPremio, setTipoPremio] = useState<TipoPremio>("Rubini Coins");
  const [valorPremio, setValorPremio] = useState<number>(25);

  useEffect(() => {
    if (open) {
      fetchParticipantes();
      setVencedor(null);
      setIsModoTeste(false);
      setTipoPremio("Rubini Coins");
      setValorPremio(25);
    }
  }, [open]);

  const fetchParticipantes = async () => {
    try {
      const { data: ticketsData, error } = await supabase
        .from("tickets")
        .select(`
          user_id,
          tickets_atual,
          profiles(nome, nome_personagem)
        `)
        .gt("tickets_atual", 0);

      if (error) throw error;

      const participantesList: Participante[] = (ticketsData || []).map((t: any) => ({
        user_id: t.user_id,
        nome: t.profiles?.nome || "Usuário desconhecido",
        tickets: t.tickets_atual,
        nome_personagem: t.profiles?.nome_personagem || undefined
      }));

      setParticipantes(participantesList);
    } catch (error: any) {
      console.error("Error fetching participants:", error);
      toast.error("Erro ao carregar participantes");
    }
  };

  const calcularProbabilidade = (tickets: number, total: number) => {
    return ((tickets / total) * 100).toFixed(1);
  };

  const realizarSorteio = async () => {
    if (participantes.length === 0) {
      toast.error("Não há participantes com tickets");
      return;
    }

    // Validate observacoes if needed
    const validation = raffleSchema.safeParse({ observacoes: observacoes || undefined });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setDrawing(true);

    // Calcular total de tickets
    const totalTickets = participantes.reduce((sum, p) => sum + p.tickets, 0);

    // Sortear um número aleatório
    let sorteio = Math.floor(Math.random() * totalTickets);

    // Determinar vencedor baseado nos tickets
    let vencedorSorteado: Participante | null = null;
    for (const participante of participantes) {
      sorteio -= participante.tickets;
      if (sorteio < 0) {
        vencedorSorteado = participante;
        break;
      }
    }

    if (!vencedorSorteado) {
      vencedorSorteado = participantes[0];
    }

    // Animação de sorteio
    setTimeout(async () => {
      setVencedor(vencedorSorteado);
      setDrawing(false);

      // Se for modo teste, apenas mostrar resultado sem salvar
      if (isModoTeste) {
        toast.success(`🎮 TESTE: ${vencedorSorteado.nome} ganhou o sorteio!`, {
          description: "Modo simulação - tickets não foram zerados e nada foi salvo"
        });
        return;
      }

      try {
        // Salvar sorteio com prêmio
        const { error: raffleError } = await supabase
          .from("raffles")
          .insert({
            vencedor_id: vencedorSorteado.user_id,
            nome_vencedor: vencedorSorteado.nome,
            tipo_premio: tipoPremio,
            valor_premio: valorPremio,
            participantes: participantes.map(p => ({
              user_id: p.user_id,
              nome: p.nome,
              tickets: p.tickets
            }))
          });

        if (raffleError) throw raffleError;

        // Zerar tickets do vencedor
        const { error: ticketsError } = await supabase
          .from("tickets")
          .update({ tickets_atual: 0 })
          .eq("user_id", vencedorSorteado.user_id);

        if (ticketsError) throw ticketsError;

        // Salvar no ledger
        await supabase
          .from("ticket_ledger")
          .insert({
            user_id: vencedorSorteado.user_id,
            variacao: -vencedorSorteado.tickets,
            motivo: "Ganhou sorteio - tickets zerados"
          });

        toast.success(`${vencedorSorteado.nome} ganhou o sorteio!`);
        onSuccess();
      } catch (error: any) {
        console.error("Error saving raffle:", error);
        toast.error("Erro ao salvar sorteio: " + error.message);
      }
    }, 3000);
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
            <h3 className="font-semibold mb-2">
              Participantes ({participantes.length})
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {participantes.map((p) => {
                const totalTickets = participantes.reduce((sum, item) => sum + item.tickets, 0);
                const probabilidade = calcularProbabilidade(p.tickets, totalTickets);
                
                return (
                  <div
                    key={p.user_id}
                    className="p-3 bg-gradient-card rounded-lg space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{p.nome}</span>
                      <span className="text-sm font-semibold text-primary">
                        {probabilidade}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${probabilidade}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground min-w-[80px] text-right">
                        {p.tickets} {p.tickets === 1 ? "ticket" : "tickets"}
                      </span>
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

          {vencedor && (
            <div className="text-center p-6 bg-gradient-primary rounded-lg shadow-glow space-y-4">
              <Trophy className="h-16 w-16 mx-auto text-primary-foreground animate-pulse-glow" />
              <div>
                <h3 className="text-2xl font-bold text-primary-foreground mb-2">
                  🎉 Vencedor! 🎉
                </h3>
                <p className="text-xl font-semibold text-primary-foreground">
                  {vencedor.nome}
                </p>
                <p className="text-sm text-primary-foreground/80 mt-2">
                  Tinha {vencedor.tickets} {vencedor.tickets === 1 ? "ticket" : "tickets"}
                </p>
              </div>
              <div className="pt-4 border-t border-primary-foreground/20">
                <p className="text-sm text-primary-foreground/80 mb-1">Prêmio:</p>
                <p className="text-2xl font-bold text-primary-foreground">
                  {valorPremio} {tipoPremio}
                </p>
                {tipoPremio === "Rubini Coins" && (
                  <div className="mt-3">
                    <p className="text-xs text-primary-foreground/70">Personagem:</p>
                    {vencedor.nome_personagem ? (
                      <p className="text-lg font-semibold text-primary-foreground">
                        {vencedor.nome_personagem}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-yellow-300">
                          ⚠️ Usuário ainda não cadastrou o nome do personagem
                        </p>
                        <p className="text-xs text-primary-foreground/60">
                          Peça para acessar Configurações da Conta
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
          {!vencedor && (
            <Button
              onClick={realizarSorteio}
              disabled={drawing || participantes.length === 0}
              className="bg-gradient-primary"
            >
              {drawing ? "Sorteando..." : isModoTeste ? "🎮 Testar Sorteio" : "Sortear Vencedor"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
