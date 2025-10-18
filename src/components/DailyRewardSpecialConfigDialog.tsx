import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase-helper";
import { Loader2, Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

interface DailyRewardSpecialConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SpecialReward {
  id: string;
  dia_sequencia: number;
  pontos: number;
}

export function DailyRewardSpecialConfigDialog({ open, onOpenChange }: DailyRewardSpecialConfigDialogProps) {
  const [loading, setLoading] = useState(false);
  const [rewards, setRewards] = useState<SpecialReward[]>([]);
  const [diaSequencia, setDiaSequencia] = useState("");
  const [pontos, setPontos] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) {
      loadRewards();
    }
  }, [open]);

  const loadRewards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_reward_special_config')
        .select('*')
        .order('dia_sequencia', { ascending: true });

      if (error) throw error;
      setRewards(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar recompensas especiais:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const dia = parseInt(diaSequencia);
    const pts = parseInt(pontos);

    if (!dia || dia < 1) {
      toast.error('Dia da sequência deve ser maior que 0');
      return;
    }

    if (!pts || pts < 1) {
      toast.error('Pontos devem ser maior que 0');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('daily_reward_special_config')
        .upsert({
          dia_sequencia: dia,
          pontos: pts
        }, {
          onConflict: 'dia_sequencia'
        });

      if (error) throw error;

      toast.success('Recompensa especial configurada!');
      setDiaSequencia("");
      setPontos("");
      loadRewards();
    } catch (error: any) {
      console.error('Erro ao adicionar recompensa:', error);
      toast.error('Erro ao configurar recompensa especial');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('daily_reward_special_config')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Recompensa especial removida');
      loadRewards();
    } catch (error: any) {
      console.error('Erro ao remover recompensa:', error);
      toast.error('Erro ao remover configuração');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Recompensas Especiais da Sequência
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informação sobre regras padrão */}
          <div className="p-4 bg-muted/50 rounded-lg border text-sm">
            <p className="font-medium mb-2">📋 Regras Padrão:</p>
            <ul className="space-y-1 text-muted-foreground ml-4">
              <li>• Todos os dias: 25 pontos</li>
              <li>• Múltiplos de 5 (5, 10, 15...): 50 pontos</li>
              <li>• Configure dias específicos abaixo para sobrescrever as regras padrão</li>
            </ul>
          </div>

          {/* Formulário de adição */}
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="dia">Dia da Sequência</Label>
              <Input
                id="dia"
                type="number"
                min="1"
                value={diaSequencia}
                onChange={(e) => setDiaSequencia(e.target.value)}
                placeholder="Ex: 7"
              />
            </div>
            <div>
              <Label htmlFor="pontos">Pontos</Label>
              <Input
                id="pontos"
                type="number"
                min="1"
                value={pontos}
                onChange={(e) => setPontos(e.target.value)}
                placeholder="Ex: 100"
              />
            </div>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </>
              )}
            </Button>
          </div>

          {/* Lista de recompensas especiais */}
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : rewards.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia da Sequência</TableHead>
                    <TableHead>Pontos</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((reward) => (
                    <TableRow key={reward.id}>
                      <TableCell className="font-medium">Dia {reward.dia_sequencia}</TableCell>
                      <TableCell className="text-primary font-semibold">{reward.pontos} pontos</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(reward.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma recompensa especial configurada
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
