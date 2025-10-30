import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Download, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RewardClaim {
  id: string;
  user_id: string;
  twitch_username: string | null;
  dia: number;
  pontos: number;
  created_at: string;
  posicao: number;
}

export function DailyRewardTodaySection() {
  const [loading, setLoading] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [todayDate, setTodayDate] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [showListDialog, setShowListDialog] = useState(false);
  const [rewards, setRewards] = useState<RewardClaim[]>([]);

  useEffect(() => {
    const hoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    
    setTodayDate(hoje);
    setSelectedDate(hoje);
    loadTodayCount(hoje);
  }, []);

  const loadTodayCount = async (date: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-daily-rewards-stats', {
        body: { date }
      });

      if (error) throw error;
      setTodayCount(data.total || 0);
    } catch (error: any) {
      console.error('Erro ao carregar contador:', error);
      toast.error('Erro ao carregar contador do dia');
    } finally {
      setLoading(false);
    }
  };

  const loadRewardsList = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-daily-rewards-stats', {
        body: { date: selectedDate }
      });

      if (error) throw error;
      setRewards(data.rewards || []);
      setShowListDialog(true);
    } catch (error: any) {
      console.error('Erro ao carregar lista:', error);
      toast.error('Erro ao carregar lista de resgates');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const filteredRewards = searchUser
      ? rewards.filter(r => 
    
          (r.twitch_username && r.twitch_username.toLowerCase().includes(searchUser.toLowerCase()))
        )
      : rewards;

    const csvContent = [
      ['Posição', 'Twitch', 'Dia', 'Pontos', 'Horário'],
      ...filteredRewards.map(r => [
          r.posicao,
          r.twitch_username || 'N/A',
          r.dia,
          r.pontos,
          new Date(r.created_at).toLocaleString('pt-BR')
        ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `resgates_${selectedDate}.csv`;
    link.click();
    toast.success('CSV exportado com sucesso!');
  };

  const filteredRewards = searchUser
    ? rewards.filter(r => 

        (r.twitch_username && r.twitch_username.toLowerCase().includes(searchUser.toLowerCase()))
      )
    : rewards;

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recompensa Diária (hoje)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Data de hoje (Brasília):</p>
            <p className="text-lg font-semibold">
              {new Date(todayDate + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
            
            <p className="text-sm text-muted-foreground mt-3 mb-1">Usuários que resgataram hoje:</p>
            <p className="text-3xl font-bold text-primary">
              {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : todayCount}
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={loadRewardsList} disabled={loading} className="flex-1">
              <Eye className="h-4 w-4 mr-2" />
              Ver Lista
            </Button>
            <Button 
              onClick={() => loadTodayCount(todayDate)} 
              disabled={loading}
              variant="outline"
            >
              <Loader2 className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resgates do Dia</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={todayDate}
                className="flex-1"
              />
              <Button onClick={() => loadRewardsList()} disabled={loading}>
                <Calendar className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>

            <Input
              placeholder="Buscar por usuário..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
            />

            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Total: {filteredRewards.length} resgate(s)
              </p>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>

            {filteredRewards.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Posição</TableHead>
      
                      <TableHead>Twitch</TableHead>
                      <TableHead className="text-center">Dia</TableHead>
                      <TableHead className="text-center">Pontos</TableHead>
                      <TableHead>Horário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRewards.map((reward) => (
                      <TableRow key={reward.id}>
                        <TableCell className="font-bold">#{reward.posicao}</TableCell>
  
                        <TableCell className="text-muted-foreground">
                          {reward.twitch_username || '-'}
                        </TableCell>
                        <TableCell className="text-center">{reward.dia}º</TableCell>
                        <TableCell className="text-center font-semibold text-primary">
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
                Nenhum resgate encontrado
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
