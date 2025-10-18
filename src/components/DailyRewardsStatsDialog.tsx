import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase-helper";
import { Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

interface DailyRewardsStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RewardClaim {
  id: string;
  user_id: string;
  nome: string;
  twitch_username: string | null;
  dia: number;
  pontos: number;
  created_at: string;
  posicao: number;
}

interface StatsResponse {
  date: string;
  total: number;
  rewards: RewardClaim[];
}

export function DailyRewardsStatsDialog({ open, onOpenChange }: DailyRewardsStatsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    if (open && !selectedDate) {
      // Data atual em Brasília
      const hoje = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      setSelectedDate(hoje);
    }
  }, [open]);

  useEffect(() => {
    if (open && selectedDate) {
      loadStats(selectedDate);
    }
  }, [open, selectedDate]);

  const loadStats = async (date: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-daily-rewards-stats', {
        body: { date }
      });

      if (error) throw error;
      setStats(data);
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recompensas Diárias Resgatadas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Data (Horário de Brasília)</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Intl.DateTimeFormat('en-CA', {
                  timeZone: 'America/Sao_Paulo',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                }).format(new Date())}
              />
            </div>
            <Button onClick={() => loadStats(selectedDate)} disabled={loading}>
              <Calendar className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : stats ? (
            <>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Data:</p>
                <p className="text-lg font-semibold">
                  {new Date(stats.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
                <p className="text-sm text-muted-foreground mt-2">Total de resgates:</p>
                <p className="text-2xl font-bold text-primary">{stats.total}</p>
              </div>

              {stats.rewards.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Posição</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Twitch</TableHead>
                        <TableHead className="text-center">Dia</TableHead>
                        <TableHead className="text-center">Pontos</TableHead>
                        <TableHead>Horário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.rewards.map((reward) => (
                        <TableRow key={reward.id}>
                          <TableCell className="font-bold">#{reward.posicao}</TableCell>
                          <TableCell>{reward.nome}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {reward.twitch_username || '-'}
                          </TableCell>
                          <TableCell className="text-center">{reward.dia}º</TableCell>
                          <TableCell className="text-center font-semibold">
                            {reward.pontos}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {reward.created_at}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum resgate registrado neste dia
                </div>
              )}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
