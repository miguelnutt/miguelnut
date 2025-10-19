import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase-helper";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp, 
  Coins,
  Gamepad2,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Stats {
  twitchLogin: { status: string; lastCheck: string };
  streamElements: { sent: number; confirmed: number; pending: number; failed: number };
  dailyRewards: { collected: number; failed: number };
  resgates: { pending: number; processing: number; delivered: number; rejected: number };
  tibiaTermo: { participants: number; hitRate: number };
}

export function OverviewSection() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // StreamElements stats
      const { data: seData } = await supabase
        .from('streamelements_sync_logs')
        .select('status')
        .gte('created_at', today);
      
      const seStats = {
        sent: seData?.length || 0,
        confirmed: seData?.filter(s => s.status === 'confirmed').length || 0,
        pending: seData?.filter(s => s.status === 'pending').length || 0,
        failed: seData?.filter(s => s.status === 'failed').length || 0,
      };

      // Daily rewards stats
      const { data: drData } = await supabase
        .from('daily_rewards_history')
        .select('success')
        .gte('claimed_at', today);
      
      const drStats = {
        collected: drData?.filter(d => d.success).length || 0,
        failed: drData?.filter(d => !d.success).length || 0,
      };

      // Resgates stats
      const { data: resgatesData } = await supabase
        .from('rubini_coins_resgates')
        .select('status');
      
      const resgatesStats = {
        pending: resgatesData?.filter(r => r.status === 'pendente').length || 0,
        processing: resgatesData?.filter(r => r.status === 'processando').length || 0,
        delivered: resgatesData?.filter(r => r.status === 'entregue').length || 0,
        rejected: resgatesData?.filter(r => r.status === 'recusado').length || 0,
      };

      // TibiaTermo stats
      const { data: ttData } = await supabase
        .from('tibiatermo_user_games')
        .select('guesses_count, won')
        .gte('created_at', today);
      
      const ttStats = {
        participants: ttData?.length || 0,
        hitRate: ttData?.length ? (ttData.filter(t => t.won).length / ttData.length) * 100 : 0,
      };

      setStats({
        twitchLogin: { status: 'OK', lastCheck: new Date().toLocaleString('pt-BR') },
        streamElements: seStats,
        dailyRewards: drStats,
        resgates: resgatesStats,
        tibiaTermo: ttStats,
      });

      // Generate alerts
      const newAlerts: string[] = [];
      if (seStats.failed > 10) newAlerts.push(`${seStats.failed} falhas no StreamElements hoje`);
      if (resgatesStats.pending > 5) newAlerts.push(`${resgatesStats.pending} resgates pendentes`);
      setAlerts(newAlerts);

    } catch (error) {
      console.error('Erro ao carregar stats:', error);
      toast({ title: "Erro ao carregar estatísticas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReconciliarSE = async () => {
    try {
      toast({ title: "Reconciliando StreamElements..." });
      await supabase.functions.invoke('reconciliar-streamelements');
      toast({ title: "Reconciliação concluída!" });
      loadStats();
    } catch (error) {
      toast({ title: "Erro na reconciliação", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Erro ao carregar estatísticas</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {alerts.map((alert, i) => (
              <div key={i}>{alert}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button onClick={handleReconciliarSE} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Reconciliar SE agora
        </Button>
        <Button onClick={loadStats} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar dados
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Twitch Login */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Login Twitch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.twitchLogin.status}</p>
            <p className="text-xs text-muted-foreground">Última verificação: {stats.twitchLogin.lastCheck}</p>
          </CardContent>
        </Card>

        {/* StreamElements - Confirmados */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              SE: Confirmados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.streamElements.confirmed}</p>
            <p className="text-xs text-muted-foreground">de {stats.streamElements.sent} enviados hoje</p>
          </CardContent>
        </Card>

        {/* StreamElements - Pendentes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              SE: Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.streamElements.pending}</p>
            <p className="text-xs text-muted-foreground">aguardando confirmação</p>
          </CardContent>
        </Card>

        {/* StreamElements - Falhos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              SE: Falhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{stats.streamElements.failed}</p>
            <p className="text-xs text-muted-foreground">erros hoje</p>
          </CardContent>
        </Card>

        {/* Daily Rewards */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Diária (Hoje)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.dailyRewards.collected}</p>
            <p className="text-xs text-muted-foreground">{stats.dailyRewards.failed} falhas</p>
          </CardContent>
        </Card>

        {/* Resgates - Pendentes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Coins className="h-4 w-4 text-yellow-500" />
              Resgates Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.resgates.pending}</p>
            <p className="text-xs text-muted-foreground">
              {stats.resgates.processing} processando | {stats.resgates.delivered} entregues
            </p>
          </CardContent>
        </Card>

        {/* TibiaTermo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-purple-500" />
              TibiaTermo (Hoje)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.tibiaTermo.participants}</p>
            <p className="text-xs text-muted-foreground">
              Taxa de acerto: {stats.tibiaTermo.hitRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
