import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface StreamElementsLog {
  id: string;
  created_at: string;
  username: string;
  points_added: number;
  success: boolean;
  error_message: string | null;
  saldo_antes: number | null;
  saldo_depois: number | null;
  saldo_verificado: boolean;
  tipo_operacao: string;
  verificado_em: string | null;
  tentativas_verificacao: number | null;
  requer_reprocessamento: boolean;
  reprocessado_em: string | null;
}

interface StreamElementsLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StreamElementsLogsDialog({ open, onOpenChange }: StreamElementsLogsDialogProps) {
  const [logs, setLogs] = useState<StreamElementsLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("streamelements_sync_logs")
        .select("*")
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar logs:", error);
      toast.error("Erro ao buscar logs: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open, selectedDate]);

  const getStatusIcon = (log: StreamElementsLog) => {
    if (!log.success) {
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    if (log.saldo_verificado) {
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    }
    return <AlertCircle className="h-5 w-5 text-warning" />;
  };

  const getStatusBadge = (log: StreamElementsLog) => {
    if (!log.success) {
      return <Badge variant="destructive">Erro</Badge>;
    }
    if (log.saldo_verificado) {
      return <Badge className="bg-success text-success-foreground">Verificado ✓</Badge>;
    }
    return <Badge variant="secondary">Não Verificado</Badge>;
  };

  const stats = {
    total: logs.length,
    sucesso: logs.filter(l => l.success).length,
    erro: logs.filter(l => !l.success).length,
    verificados: logs.filter(l => l.saldo_verificado).length,
    naoVerificados: logs.filter(l => l.success && !l.saldo_verificado).length,
    requerReprocessamento: logs.filter(l => l.requer_reprocessamento && !l.reprocessado_em).length,
    totalPontos: logs.filter(l => l.success).reduce((sum, l) => sum + l.points_added, 0)
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📊 Log Diário StreamElements
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtro de Data */}
          <div className="flex items-center gap-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border rounded-md"
            />
            <Button onClick={fetchLogs} disabled={loading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="p-4 border rounded-lg bg-success/10">
              <div className="text-sm text-muted-foreground">Sucesso</div>
              <div className="text-2xl font-bold text-success">{stats.sucesso}</div>
            </div>
            <div className="p-4 border rounded-lg bg-destructive/10">
              <div className="text-sm text-muted-foreground">Erro</div>
              <div className="text-2xl font-bold text-destructive">{stats.erro}</div>
            </div>
            <div className="p-4 border rounded-lg bg-primary/10">
              <div className="text-sm text-muted-foreground">Verificados</div>
              <div className="text-2xl font-bold text-primary">{stats.verificados}</div>
            </div>
            <div className="p-4 border rounded-lg bg-warning/10">
              <div className="text-sm text-muted-foreground">Não Verificados</div>
              <div className="text-2xl font-bold text-warning">{stats.naoVerificados}</div>
            </div>
            <div className="p-4 border rounded-lg bg-orange-500/10">
              <div className="text-sm text-muted-foreground">Pendentes</div>
              <div className="text-2xl font-bold text-orange-600">{stats.requerReprocessamento}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Total Pontos</div>
              <div className="text-2xl font-bold">{stats.totalPontos}</div>
            </div>
          </div>

          {/* Tabela de Logs */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Pontos</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Saldo Antes</TableHead>
                  <TableHead>Saldo Depois</TableHead>
                  <TableHead>Verificação</TableHead>
                  <TableHead>Ações/Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-8 w-8" />
                        <p className="font-medium">Nenhum log encontrado para esta data</p>
                        <p className="text-sm">
                          O sistema de logs foi implementado recentemente e só registra operações feitas após sua ativação.
                        </p>
                        <p className="text-xs">
                          Tente selecionar a data de hoje ou verifique se houve operações de pontos nesta data.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className={!log.success ? "bg-destructive/5" : ""}>
                      <TableCell>{getStatusIcon(log)}</TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(log.created_at), "HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-medium">{log.username}</TableCell>
                      <TableCell className="text-right font-bold">
                        +{log.points_added}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.tipo_operacao}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {log.saldo_antes !== null ? log.saldo_antes : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {log.saldo_depois !== null ? log.saldo_depois : "-"}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(log)}
                        {log.tentativas_verificacao && log.tentativas_verificacao > 1 && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {log.tentativas_verificacao} tentativas
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs">
                        {log.requer_reprocessamento && !log.reprocessado_em && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mb-2 w-full"
                            onClick={async () => {
                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                const { error } = await supabase.functions.invoke('reprocess-streamelements-failed', {
                                  body: { log_id: log.id, admin_user_id: user?.id }
                                });
                                
                                if (error) throw error;
                                
                                toast.success("Log reprocessado com sucesso!");
                                fetchLogs();
                              } catch (error: any) {
                                toast.error("Erro ao reprocessar: " + error.message);
                              }
                            }}
                          >
                            🔄 Reprocessar
                          </Button>
                        )}
                        {log.reprocessado_em && (
                          <Badge variant="secondary" className="mb-2">
                            ✓ Reprocessado
                          </Badge>
                        )}
                        <div className="text-muted-foreground truncate">
                          {log.error_message || "-"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Legenda */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Verificado: Saldo conferido e correto
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              Não Verificado: Enviado mas não conferido
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Erro: Falha ao enviar
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}