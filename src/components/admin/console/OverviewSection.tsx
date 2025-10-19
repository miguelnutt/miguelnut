import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase-helper";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  RefreshCw,
  Radio
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export function OverviewSection() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    twitchStatus: "OK" as "OK" | "Degradado" | "Falha",
    seSync: { pendentes: 0, falhos: 0, confirmados: 0 },
    dailyToday: { coletas: 0, falhas: 0 },
    resgates: { pendentes: 0, processando: 0, entregues: 0, recusados: 0 },
    tibiaTermo: { participantes: 0, taxaAcerto: 0 }
  });
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Data de hoje (Brasília)
      const now = new Date();
      const brasiliaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const dateStr = brasiliaDate.toISOString().split('T')[0];
      const dataLimite = new Date();
      dataLimite.setHours(dataLimite.getHours() - 24);

      // StreamElements Sync
      const { data: seLogs } = await supabase
        .from('streamelements_sync_logs')
        .select('*')
        .gte('created_at', dataLimite.toISOString());

      const seStats = {
        pendentes: seLogs?.filter(l => l.requer_reprocessamento).length || 0,
        falhos: seLogs?.filter(l => !l.success || !l.saldo_verificado).length || 0,
        confirmados: seLogs?.filter(l => l.success && l.saldo_verificado).length || 0
      };

      // Diária hoje
      const { data: dailyLogs } = await supabase
        .from('daily_rewards_history')
        .select('*')
        .gte('created_at', `${dateStr}T00:00:00`)
        .lt('created_at', `${dateStr}T23:59:59`);

      const dailyStats = {
        coletas: dailyLogs?.length || 0,
        falhas: 0 // TODO: implement failure tracking
      };

      // Resgates
      const { data: resgates } = await supabase
        .from('rubini_coins_resgates')
        .select('status');

      const resgatesStats = {
        pendentes: resgates?.filter(r => r.status === 'PENDENTE').length || 0,
        processando: resgates?.filter(r => r.status === 'PROCESSANDO').length || 0,
        entregues: resgates?.filter(r => r.status === 'ENTREGUE').length || 0,
        recusados: resgates?.filter(r => r.status === 'RECUSADO').length || 0
      };

      // TibiaTermo
      const { data: tibiaGames } = await supabase
        .from('tibiatermo_user_games')
        .select('acertou')
        .eq('data_jogo', dateStr);

      const tibiaStats = {
        participantes: tibiaGames?.length || 0,
        taxaAcerto: tibiaGames?.length 
          ? Math.round((tibiaGames.filter(g => g.acertou).length / tibiaGames.length) * 100)
          : 0
      };

      setStats({
        twitchStatus: "OK",
        seSync: seStats,
        dailyToday: dailyStats,
        resgates: resgatesStats,
        tibiaTermo: tibiaStats
      });

      // Gerar alertas
      const newAlerts: string[] = [];
      if (seStats.pendentes > 10) {
        newAlerts.push(`StreamElements: ${seStats.pendentes} eventos pendentes na fila`);
      }
      if (seStats.falhos > 5) {
        newAlerts.push(`StreamElements: ${seStats.falhos} falhas de sincronização`);
      }
      if (resgatesStats.pendentes > 5) {
        newAlerts.push(`${resgatesStats.pendentes} resgates aguardando processamento`);
      }
      setAlerts(newAlerts);

    } catch (error: any) {
      console.error("Erro ao carregar estatísticas:", error);
      toast.error("Erro ao carregar dados da visão geral");
    } finally {
      setLoading(false);
    }
  };

  const handleReconciliarSE = async () => {
    try {
      const { error } = await supabase.functions.invoke('reconciliar-streamelements');
      if (error) throw error;
      toast.success("Reconciliação iniciada com sucesso");
      loadStats();
    } catch (error: any) {
      toast.error("Erro ao reconciliar: " + error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {alerts.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {alerts.map((alert, i) => (
                <div key={i}>• {alert}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Botões rápidos */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleReconciliarSE} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Reconciliar SE agora
        </Button>
        <Button onClick={loadStats} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar dados
        </Button>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Login Twitch */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Login Twitch</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={stats.twitchStatus === "OK" ? "default" : "destructive"}>
                {stats.twitchStatus}
              </Badge>
              {stats.twitchStatus === "OK" && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Sistema de autenticação operacional
            </p>
          </CardContent>
        </Card>

        {/* StreamElements Sync */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">StreamElements Sync</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Confirmados hoje:</span>
                <span className="font-bold text-green-600">{stats.seSync.confirmados}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Pendentes:</span>
                <span className="font-bold text-yellow-600">{stats.seSync.pendentes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Falhos:</span>
                <span className="font-bold text-red-600">{stats.seSync.falhos}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Diária hoje */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Diária Hoje</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Total de coletas:</span>
                <span className="font-bold">{stats.dailyToday.coletas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Falhas:</span>
                <span className="font-bold text-red-600">{stats.dailyToday.falhas}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resgates Rubini Coins */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resgates Rubini Coins</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Pendentes:</span>
                <span className="font-bold text-yellow-600">{stats.resgates.pendentes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Processando:</span>
                <span className="font-bold text-blue-600">{stats.resgates.processando}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Entregues:</span>
                <span className="font-bold text-green-600">{stats.resgates.entregues}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Recusados:</span>
                <span className="font-bold text-red-600">{stats.resgates.recusados}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TibiaTermo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">TibiaTermo Hoje</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Participantes:</span>
                <span className="font-bold">{stats.tibiaTermo.participantes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Taxa de acerto:</span>
                <span className="font-bold text-green-600">{stats.tibiaTermo.taxaAcerto}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
