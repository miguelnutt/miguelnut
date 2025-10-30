import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  ArrowLeft, 
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase-helper";
import { Session } from "@supabase/supabase-js";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const { isAdmin, loading } = useAdmin(session?.user ?? null);

  // Estados para a aba de logs
  const [logsData, setLogsData] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsType, setLogsType] = useState("all");
  const [logsSearchTerm, setLogsSearchTerm] = useState("");
  const [logsDateFilter, setLogsDateFilter] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirecionar se não for admin
  React.useEffect(() => {
    if (sessionReady && !loading && !isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [sessionReady, isAdmin, loading, navigate]);

  // Carregar logs quando o componente for montado
  useEffect(() => {
    if (isAdmin && sessionReady) {
      loadLogs();
    }
  }, [isAdmin, sessionReady]);

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      // TODO: Implement logs loading logic
      // For now, just set empty array
      setLogsData([]);
    } catch (error: any) {
      console.error("Erro ao carregar logs:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar logs do sistema",
        variant: "destructive",
      });
    } finally {
      setLogsLoading(false);
    }
  };

  const filteredLogs = logsData.filter(log =>
    (logsType === "all" || log.log_type?.toLowerCase().includes(logsType.toLowerCase())) &&
    (logsSearchTerm === "" || 
     log.user_name?.toLowerCase().includes(logsSearchTerm.toLowerCase()) ||
     log.description?.toLowerCase().includes(logsSearchTerm.toLowerCase()) ||
     log.log_type?.toLowerCase().includes(logsSearchTerm.toLowerCase())) &&
    (logsDateFilter === "" || log.created_at?.startsWith(logsDateFilter))
  );

  if (!sessionReady || loading) {
    return <div className="container mx-auto py-8 text-center">Verificando permissões...</div>;
  }
  
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-purple-600" />
          <h1 className="text-3xl font-bold">Logs do Sistema</h1>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o site
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logs do Sistema</CardTitle>
          <CardDescription>Visualize todos os logs importantes do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="log-type">Tipo de Log</Label>
                <select
                  id="log-type"
                  value={logsType}
                  onChange={(e) => setLogsType(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="all">Todos os Logs</option>
                  <option value="rubini_coins">Rubini Coins</option>
                  <option value="daily_rewards">Recompensas Diárias</option>
                  <option value="tibiatermo">TibiaTermo</option>
                  <option value="streamelements">StreamElements</option>
                  <option value="spins">Roleta</option>
                  <option value="raffles">Sorteios</option>
                </select>
              </div>
              <div>
                <Label htmlFor="log-date">Filtrar por Data</Label>
                <Input
                  id="log-date"
                  type="date"
                  value={logsDateFilter}
                  onChange={(e) => setLogsDateFilter(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="log-search">Buscar</Label>
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="log-search"
                    placeholder="Buscar usuário ou descrição..."
                    value={logsSearchTerm}
                    onChange={(e) => setLogsSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Estatísticas rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <div className="text-lg font-bold">{filteredLogs.length}</div>
                <div className="text-sm text-muted-foreground">Total de Logs</div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-lg font-bold">
                  {filteredLogs.filter(log => log.log_type === 'Rubini Coins').length}
                </div>
                <div className="text-sm text-muted-foreground">Rubini Coins</div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-lg font-bold">
                  {filteredLogs.filter(log => log.log_type === 'StreamElements').length}
                </div>
                <div className="text-sm text-muted-foreground">StreamElements</div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-lg font-bold">
                  {filteredLogs.filter(log => log.log_type === 'Recompensa Diária').length}
                </div>
                <div className="text-sm text-muted-foreground">Recompensas</div>
              </div>
            </div>

            {/* Tabela de logs */}
            {logsLoading ? (
              <div className="text-center py-8">Carregando logs...</div>
            ) : (
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {logsSearchTerm || logsDateFilter ? "Nenhum log encontrado com os filtros aplicados" : "Nenhum log encontrado"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.slice(0, 200).map((log, index) => (
                        <TableRow key={`${log.log_type}-${log.id}-${index}`}>
                          <TableCell className="text-sm">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              log.log_type === 'Rubini Coins' ? 'bg-yellow-100 text-yellow-800' :
                              log.log_type === 'Recompensa Diária' ? 'bg-green-100 text-green-800' :
                              log.log_type === 'TibiaTermo' ? 'bg-blue-100 text-blue-800' :
                              log.log_type === 'StreamElements' ? 'bg-purple-100 text-purple-800' :
                              log.log_type === 'Roleta' ? 'bg-orange-100 text-orange-800' :
                              log.log_type === 'Sorteio' ? 'bg-pink-100 text-pink-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {log.log_type}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.user_name || 'Sistema'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.description}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${
                            log.amount > 0 ? 'text-green-600' : 
                            log.amount < 0 ? 'text-red-600' : 
                            'text-gray-600'
                          }`}>
                            {log.amount !== undefined ? (
                              `${log.amount > 0 ? '+' : ''}${log.amount}`
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {filteredLogs.length > 200 && (
              <div className="text-center text-sm text-muted-foreground">
                Mostrando os primeiros 200 logs. Use os filtros para refinar a busca.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;