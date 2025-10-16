import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

interface Participante {
  user_id: string;
  nome: string;
  tickets: number;
}

interface RaffleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RaffleDialog({ open, onOpenChange, onSuccess }: RaffleDialogProps) {
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [vencedor, setVencedor] = useState<Participante | null>(null);

  useEffect(() => {
    if (open) {
      fetchParticipantes();
      setVencedor(null);
    }
  }, [open]);

  const fetchParticipantes = async () => {
    try {
      const { data: ticketsData, error } = await supabase
        .from("tickets")
        .select(`
          user_id,
          tickets_atual,
          profiles(nome)
        `)
        .gt("tickets_atual", 0);

      if (error) throw error;

      const participantesList: Participante[] = (ticketsData || []).map((t: any) => ({
        user_id: t.user_id,
        nome: t.profiles?.nome || "Usuário desconhecido",
        tickets: t.tickets_atual
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

      try {
        // Salvar sorteio
        const { error: raffleError } = await supabase
          .from("raffles")
          .insert({
            vencedor_id: vencedorSorteado.user_id,
            nome_vencedor: vencedorSorteado.nome,
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
          <DialogTitle>Realizar Sorteio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
            <div className="text-center p-6 bg-gradient-primary rounded-lg shadow-glow">
              <Trophy className="h-16 w-16 mx-auto mb-4 text-primary-foreground animate-pulse-glow" />
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
              {drawing ? "Sorteando..." : "Sortear Vencedor"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
