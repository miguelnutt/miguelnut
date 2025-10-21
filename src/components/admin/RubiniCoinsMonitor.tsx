import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, CheckCircle, XCircle, Download, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface RCLog {
  id: string;
  user_id: string;
  variacao: number;
  motivo: string;
  origem: string | null;
  status: string | null;
  created_at: string;
  error_message: string | null;
  idempotency_key: string | null;
  profiles?: {
    nome: string;
    twitch_username: string;
  };
}

export function RubiniCoinsMonitor() {
  const [logs, setLogs] = useState<RCLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<RCLog[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    confirmados: 0,
    falhas: 0,
  });
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [sourceFilter, setSourceFilter] = useState<string>("todos");
  const [usernameFilter, setUsernameFilter] = useState<string>("");

  useEffect(() => {
    carregarDados();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(carregarDados, 30000);
    return () => clearInterval(interval);
  }, []);

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...logs];

    if (statusFilter === "confirmado") {
      filtered = filtered.filter(l => l.status === 'confirmado');
    } else if (statusFilter === "falha") {
      filtered = filtered.filter(l => l.status === 'falhou' || l.status === 'failed');
    }

    if (sourceFilter !== "todos") {
      filtered = filtered.filter(l => l.origem === sourceFilter);
    }

    if (usernameFilter.trim()) {
      filtered = filtered.filter(l => 
        l.profiles?.twitch_username?.toLowerCase().includes(usernameFilter.toLowerCase()) ||
        l.profiles?.nome?.toLowerCase().includes(usernameFilter.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [logs, statusFilter, sourceFilter, usernameFilter]);

  const carregarDados = async () => {
    try {
      // Buscar logs das últimas 24h
      const dataLimite = new Date();
      dataLimite.setHours(dataLimite.getHours() - 24);

      const { data, error } = await supabase
        .from('rubini_coins_history')
        .select(`
          *,
          profiles:user_id (nome, twitch_username)
        `)
        .gte('created_at', dataLimite.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLogs(data || []);

      // Calcular estatísticas
      const total = data?.length || 0;
      const confirmados = data?.filter(l => l.status === 'confirmado').length || 0;
      const falhas = data?.filter(l => l.status === 'falhou' || l.status === 'failed').length || 0;

      setStats({ total, confirmados, falhas });
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = () => {
    const headers = ['Data/Hora', 'Usuário', 'Variação', 'Origem', 'Status', 'Motivo', 'Erro'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
      log.profiles?.twitch_username || 'N/A',
      log.variacao,
      log.origem || 'N/A',
      log.status || 'N/A',
      log.motivo,
      log.error_message || '-'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rubini_coins_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Confirmados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.confirmados}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Falhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.falhas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Ações e Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Monitor Rubini Coins</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={carregarDados}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                onClick={exportarCSV}
                disabled={filteredLogs.length === 0}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="confirmado">Confirmados</SelectItem>
                  <SelectItem value="falha">Falhas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Origem</label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="roulette">Roleta</SelectItem>
                  <SelectItem value="raffle">Sorteio</SelectItem>
                  <SelectItem value="consolidacao">Consolidação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Usuário</label>
              <Input
                placeholder="Buscar por username..."
                value={usernameFilter}
                onChange={(e) => setUsernameFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Contador de resultados filtrados */}
          {(statusFilter !== "todos" || sourceFilter !== "todos" || usernameFilter) && (
            <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Mostrando {filteredLogs.length} de {logs.length} eventos
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {logs.length === 0 ? 'Nenhum evento registrado nas últimas 24h' : 'Nenhum evento corresponde aos filtros aplicados'}
              </div>
            ) : (
              filteredLogs.map(log => {
                const isSuccess = log.status === 'confirmado';
                const isPositive = log.variacao > 0;

                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border ${
                      isSuccess
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium">
                            {log.profiles?.twitch_username || 'N/A'}
                          </span>
                          <Badge variant={isSuccess ? "default" : "destructive"}>
                            {isSuccess ? 'Confirmado' : 'Falha'}
                          </Badge>
                          {log.origem && (
                            <Badge variant="outline">
                              {log.origem}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')} · 
                          <span className={`font-semibold ml-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '+' : ''}{log.variacao} RC
                          </span>
                          <span className="ml-2 text-xs">{log.motivo}</span>
                        </div>
                        {log.error_message && (
                          <div className="text-xs text-red-500 mt-1">
                            Erro: {log.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}