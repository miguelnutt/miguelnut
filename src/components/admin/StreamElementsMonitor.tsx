import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface StreamElementsLog {
  id: string;
  username: string;
  points_added: number;
  success: boolean;
  saldo_antes: number | null;
  saldo_depois: number | null;
  saldo_verificado: boolean;
  tipo_operacao: string;
  referencia_id: string | null;
  created_at: string;
  error_message: string | null;
  tentativas_verificacao: number;
  requer_reprocessamento: boolean;
}

export function StreamElementsMonitor() {
  const [logs, setLogs] = useState<StreamElementsLog[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    sucessos: 0,
    falhas: 0,
    pendentes: 0
  });
  const [loading, setLoading] = useState(true);
  const [reconciliando, setReconciliando] = useState(false);

  useEffect(() => {
    carregarDados();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(carregarDados, 30000);
    return () => clearInterval(interval);
  }, []);

  const carregarDados = async () => {
    try {
      // Buscar logs das últimas 24h
      const dataLimite = new Date();
      dataLimite.setHours(dataLimite.getHours() - 24);

      const { data, error } = await supabase
        .from('streamelements_sync_logs')
        .select('*')
        .gte('created_at', dataLimite.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLogs(data || []);

      // Calcular estatísticas
      const total = data?.length || 0;
      const sucessos = data?.filter(l => l.success && l.saldo_verificado).length || 0;
      const falhas = data?.filter(l => !l.success || !l.saldo_verificado).length || 0;
      const pendentes = data?.filter(l => l.requer_reprocessamento).length || 0;

      setStats({ total, sucessos, falhas, pendentes });
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  };

  const reconciliar = async () => {
    setReconciliando(true);
    try {
      const { data, error } = await supabase.functions.invoke('reconciliar-streamelements');
      
      if (error) throw error;

      toast.success(
        `Reconciliação concluída: ${data.sucessos} sucessos, ${data.falhas} falhas`
      );
      
      await carregarDados();
    } catch (error: any) {
      console.error('Erro na reconciliação:', error);
      toast.error('Erro ao reconciliar: ' + error.message);
    } finally {
      setReconciliando(false);
    }
  };

  const exportarCSV = () => {
    const headers = ['Data/Hora', 'Usuário', 'Pontos', 'Operação', 'Status', 'Saldo Antes', 'Saldo Depois', 'Tentativas', 'Erro'];
    const rows = logs.map(log => [
      format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
      log.username,
      log.points_added,
      log.tipo_operacao,
      log.success && log.saldo_verificado ? 'Sucesso' : 'Falha',
      log.saldo_antes || '-',
      log.saldo_depois || '-',
      log.tentativas_verificacao,
      log.error_message || '-'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `streamelements_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              Sucessos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.sucessos}</div>
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendentes}</div>
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Monitor StreamElements</CardTitle>
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
                disabled={logs.length === 0}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
              <Button
                onClick={reconciliar}
                disabled={reconciliando || stats.pendentes === 0}
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${reconciliando ? 'animate-spin' : ''}`} />
                Reconciliar ({stats.pendentes})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stats.pendentes > 10 && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span className="text-sm">
                <strong>Alerta:</strong> {stats.pendentes} eventos pendentes de sincronização. 
                Recomenda-se executar a reconciliação.
              </span>
            </div>
          )}

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {logs.map(log => (
              <div
                key={log.id}
                className={`p-3 rounded-lg border ${
                  log.success && log.saldo_verificado
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-red-500/5 border-red-500/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{log.username}</span>
                      <Badge variant={log.success && log.saldo_verificado ? "default" : "destructive"}>
                        {log.success && log.saldo_verificado ? 'Confirmado' : 'Falha'}
                      </Badge>
                      <Badge variant="outline">{log.tipo_operacao}</Badge>
                      {log.requer_reprocessamento && (
                        <Badge variant="outline" className="bg-yellow-500/10">
                          Reprocessar
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')} · 
                      +{log.points_added} pontos · 
                      {log.saldo_antes !== null && ` ${log.saldo_antes} → ${log.saldo_depois}`}
                      {log.tentativas_verificacao > 1 && ` · ${log.tentativas_verificacao} tentativas`}
                    </div>
                    {log.error_message && (
                      <div className="text-xs text-red-500 mt-1">
                        Erro: {log.error_message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
