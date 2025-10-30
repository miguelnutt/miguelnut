import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-helper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AuditEvent {
  id: string;
  created_at: string;
  user_id: string | null;
  variacao: number;
  motivo: string;
  idempotency_key: string | null;
  status: 'pendente' | 'confirmado' | 'falhou';
  origem: string | null;
  error_message: string | null;
  retries: number;
  referencia_id: string | null;
  profiles?: {
    twitch_username: string;
  };
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'confirmado':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'pendente':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'falhou':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    confirmado: "default",
    pendente: "secondary",
    falhou: "destructive"
  };
  
  return (
    <Badge variant={variants[status] || "outline"} className="flex items-center gap-1">
      {getStatusIcon(status)}
      {status === 'confirmado' ? 'Confirmado' : status === 'pendente' ? 'Pendente' : 'Falhou'}
    </Badge>
  );
};

const getOrigemLabel = (origem: string | null) => {
  const labels: Record<string, string> = {
    roulette: 'Roleta',
    tibiatermo: 'TibiaTermo',
    daily_reward: 'Recompensa Diária',
    admin: 'Admin',
    legacy: 'Legado'
  };
  return labels[origem || ''] || origem || '-';
};

export function RubiniCoinsAudit() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [origemFilter, setOrigemFilter] = useState<string>('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchEvents();
    
    // Realtime subscription
    const channel = supabase
      .channel('rubini_coins_audit')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rubini_coins_history'
      }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('rubini_coins_history')
        .select(`
          *,
          profiles:user_id (
            twitch_username
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      // Aplicar filtros
      if (statusFilter && statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }
      
      if (origemFilter && origemFilter !== 'todos') {
        query = query.eq('origem', origemFilter);
      }
      
      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }
      
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];
      
      // Filtro de busca por username
      if (searchTerm) {
        filteredData = filteredData.filter(event => {
          const profile = event.profiles as any;
          const twitch = profile?.twitch_username?.toLowerCase() || '';
          const search = searchTerm.toLowerCase();
          return twitch.includes(search);
        });
      }

      setEvents(filteredData as AuditEvent[]);
    } catch (error: any) {
      console.error('[RubiniCoinsAudit] Erro ao buscar eventos:', error);
      toast.error('Erro ao carregar auditoria');
    } finally {
      setLoading(false);
    }
  };

  const handleReprocess = async (eventId: string) => {
    try {
      setReprocessing(eventId);
      
      const { data, error } = await supabase.functions.invoke('reconcile-rubini-coins', {
        body: { historyId: eventId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Evento reprocessado com sucesso!');
        fetchEvents();
      } else {
        toast.error(data.error || 'Falha ao reprocessar');
      }
    } catch (error: any) {
      console.error('[RubiniCoinsAudit] Erro ao reprocessar:', error);
      toast.error('Erro ao reprocessar evento');
    } finally {
      setReprocessing(null);
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ['Data/Hora', 'Usuário', 'Origem', 'Valor', 'Status', 'Motivo', 'Erro', 'Tentativas'].join(','),
      ...events.map(event => {
        const profile = event.profiles as any;
        const username = profile?.twitch_username || 'Desconhecido';
        const dataHora = format(new Date(event.created_at), 'dd/MM/yyyy HH:mm:ss');
        
        return [
          dataHora,
          username,
          getOrigemLabel(event.origem),
          event.variacao,
          event.status,
          `"${event.motivo || ''}"`,
          `"${event.error_message || ''}"`,
          event.retries || 0
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rubini-coins-audit-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('CSV exportado com sucesso!');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Auditoria de Rubini Coins</CardTitle>
            <CardDescription>
              Acompanhe todas as transações de Rubini Coins com status detalhado
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchEvents}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={events.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Buscar Usuário</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="falhou">Falhou</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={origemFilter} onValueChange={setOrigemFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="roulette">Roleta</SelectItem>
                <SelectItem value="tibiatermo">TibiaTermo</SelectItem>
                <SelectItem value="daily_reward">Recompensa Diária</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="legacy">Legado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Data Início</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Data Fim</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={fetchEvents} className="w-full md:w-auto">
          Aplicar Filtros
        </Button>

        {/* Tabela de eventos */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Tentativas</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Carregando...</p>
                  </TableCell>
                </TableRow>
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum evento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => {
                  const profile = event.profiles as any;
                  const username = profile?.twitch_username || 'Desconhecido';
                  
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="text-sm">
                        {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell className="font-medium">{username}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getOrigemLabel(event.origem)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={event.variacao > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {event.variacao > 0 ? '+' : ''}{event.variacao} RC
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(event.status)}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {event.error_message ? (
                          <span className="text-destructive">{event.error_message}</span>
                        ) : (
                          event.motivo
                        )}
                      </TableCell>
                      <TableCell className="text-center">{event.retries || 0}</TableCell>
                      <TableCell>
                        {(event.status === 'pendente' || event.status === 'falhou') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReprocess(event.id)}
                            disabled={reprocessing === event.id}
                          >
                            {reprocessing === event.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Reprocessar
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}