import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  RefreshCw, 
  Ticket, 
  TrendingUp, 
  Users, 
  Zap 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TicketMetrics {
  totalTicketsAwarded: number;
  totalSpins: number;
  uniqueUsers: number;
  averageTicketsPerSpin: number;
  topUsers: Array<{
    username: string;
    tickets_awarded: number;
  }>;
  recentActivity: Array<{
    username: string;
    tickets_awarded: number;
    created_at: string;
  }>;
  errorRate: number;
  inconsistentBalances: number;
  totalBalanceDiscrepancy: number;
}

interface SystemMetrics {
  databaseHealth: 'healthy' | 'error';
  lastReconciliation: string | null;
  activeWheels: number;
  totalUsers: number;
}

interface MonitoringData {
  ticketMetrics: TicketMetrics;
  systemMetrics: SystemMetrics;
  timeRange: string;
  generatedAt: string;
}

const MonitoringDashboard: React.FC = () => {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(true);
  const { toast } = useToast();

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const { data: response, error } = await supabase.functions.invoke('monitoring-metrics', {
        body: { timeRange, includeDetails }
      });

      if (error) throw error;

      setData(response);
    } catch (error) {
      console.error('Error fetching monitoring metrics:', error);
      toast({
        title: "Erro ao carregar métricas",
        description: "Não foi possível carregar as métricas de monitoramento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [timeRange, includeDetails]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, timeRange, includeDetails]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getHealthBadge = (health: string) => {
    return health === 'healthy' ? (
      <Badge variant="default" className="bg-green-500">
        <CheckCircle className="w-3 h-3 mr-1" />
        Saudável
      </Badge>
    ) : (
      <Badge variant="destructive">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Erro
      </Badge>
    );
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2">Carregando métricas...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
        <p>Não foi possível carregar as métricas de monitoramento.</p>
        <Button onClick={fetchMetrics} className="mt-4">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard de Monitoramento</h2>
          <p className="text-muted-foreground">
            Métricas em tempo real do sistema de tickets
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 hora</SelectItem>
              <SelectItem value="24h">24 horas</SelectItem>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`w-4 h-4 mr-2 ${autoRefresh ? 'text-green-500' : 'text-gray-500'}`} />
            Auto-refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Saúde do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{getHealthBadge(data.systemMetrics.databaseHealth)}</div>
              <p className="text-sm text-muted-foreground">Banco de Dados</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatNumber(data.systemMetrics.activeWheels)}</div>
              <p className="text-sm text-muted-foreground">Roletas Ativas</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatNumber(data.systemMetrics.totalUsers)}</div>
              <p className="text-sm text-muted-foreground">Usuários Totais</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {data.systemMetrics.lastReconciliation ? (
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(data.systemMetrics.lastReconciliation)}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Nunca</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Última Reconciliação</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.ticketMetrics.totalTicketsAwarded)}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange === '24h' ? 'nas últimas 24h' : `nos últimos ${timeRange}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Giros</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.ticketMetrics.totalSpins)}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange === '24h' ? 'nas últimas 24h' : `nos últimos ${timeRange}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Únicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.ticketMetrics.uniqueUsers)}</div>
            <p className="text-xs text-muted-foreground">
              usuários ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Giro</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.ticketMetrics.averageTicketsPerSpin.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              tickets por giro
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Taxa de Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.ticketMetrics.errorRate}%</div>
            <p className="text-xs text-muted-foreground">dos giros resultaram em erro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Saldos Inconsistentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatNumber(data.ticketMetrics.inconsistentBalances)}
            </div>
            <p className="text-xs text-muted-foreground">usuários com saldos inconsistentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Discrepância Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatNumber(data.ticketMetrics.totalBalanceDiscrepancy)}
            </div>
            <p className="text-xs text-muted-foreground">tickets de diferença total</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Users and Recent Activity */}
      {includeDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Usuários</CardTitle>
              <CardDescription>Usuários com mais tickets ganhos no período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.ticketMetrics.topUsers.slice(0, 5).map((user, index) => (
                  <div key={user.username} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Badge variant="outline" className="w-6 h-6 p-0 mr-2">
                        {index + 1}
                      </Badge>
                      <span className="font-medium">{user.username}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(user.tickets_awarded)} tickets
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
              <CardDescription>Últimos prêmios concedidos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.ticketMetrics.recentActivity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{activity.username}</span>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(activity.created_at)}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      +{formatNumber(activity.tickets_awarded)} tickets
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        Última atualização: {formatDate(data.generatedAt)}
      </div>
    </div>
  );
};

export default MonitoringDashboard;