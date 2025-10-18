import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, Loader2, RefreshCw, History } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";

interface MaintenanceLog {
  acao: string;
  executado_em: string;
}

export function MaintenanceSection() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<Record<string, string>>({});

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_maintenance_log')
        .select('acao, executado_em')
        .order('executado_em', { ascending: false });

      if (error) throw error;

      const logMap: Record<string, string> = {};
      data?.forEach((log: MaintenanceLog) => {
        if (!logMap[log.acao]) {
          logMap[log.acao] = new Date(log.executado_em).toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo'
          });
        }
      });

      setLogs(logMap);
    } catch (error: any) {
      console.error('Erro ao carregar logs:', error);
    }
  };

  const reprocessHistory = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('reprocess-history-timezone');
      
      if (error) throw error;
      
      toast.success('Histórico reprocessado com sucesso!');
      loadLogs();
    } catch (error: any) {
      console.error('Erro ao reprocessar histórico:', error);
      toast.error('Erro ao reprocessar histórico');
    } finally {
      setLoading(false);
    }
  };

  const recalculateToday = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('get-daily-rewards-stats', {
        body: { 
          date: new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(new Date())
        }
      });
      
      if (error) throw error;
      
      toast.success('Contador atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao recalcular contador:', error);
      toast.error('Erro ao recalcular contador');
    } finally {
      setLoading(false);
    }
  };

  const recalculateRanking = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('recalculate-streak-ranking');
      
      if (error) throw error;
      
      toast.success('Ranking recalculado com sucesso!');
      loadLogs();
    } catch (error: any) {
      console.error('Erro ao recalcular ranking:', error);
      toast.error('Erro ao recalcular ranking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Manutenção e Auditoria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <Button 
              onClick={reprocessHistory} 
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <History className="h-4 w-4 mr-2" />}
              Reprocessar Histórico para Brasília
            </Button>
            {logs.reprocess_history_timezone && (
              <p className="text-xs text-muted-foreground mt-1">
                Última execução: {logs.reprocess_history_timezone}
              </p>
            )}
          </div>

          <div>
            <Button 
              onClick={recalculateToday} 
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Recalcular Contador de Hoje
            </Button>
          </div>

          <div>
            <Button 
              onClick={recalculateRanking} 
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Recalcular Ranking de Sequência
            </Button>
            {logs.recalculate_streak_ranking && (
              <p className="text-xs text-muted-foreground mt-1">
                Última execução: {logs.recalculate_streak_ranking}
              </p>
            )}
          </div>
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
          <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">⚠️ Atenção:</p>
          <p className="text-muted-foreground">
            Reprocessar histórico ajusta registros antigos para horário de Brasília sem criar duplicidades (1 resgate por usuário por dia).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
