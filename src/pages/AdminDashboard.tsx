import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Shield, 
  Users, 
  Coins, 
  BarChart, 
  Settings, 
  FileText, 
  ArrowLeft, 
  Search, 
  Edit, 
  Eye,
  Calendar,
  Star,
  Gift,
  MessageSquare,
  Zap,
  Activity,
  UserPlus,
  Database,
  Server,
  Wrench,
  Palette,
  Megaphone,
  Trophy,
  Shuffle,
  History,
  Gamepad2,
  Ticket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase-helper";
import { Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  nome: string;
  twitch_username: string | null;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

interface UserBalance {
  rubini_coins: number;
  tickets: number;
}

interface UserHistory {
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { isAdmin, loading } = useAdmin(session?.user ?? null);

  // Estados para a aba de usuários
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [userHistory, setUserHistory] = useState<UserHistory[]>([]);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [editBalanceOpen, setEditBalanceOpen] = useState(false);
  const [newRubiniCoins, setNewRubiniCoins] = useState("");
  const [newTickets, setNewTickets] = useState("");

  // Estados para a aba de economia
  const [economyData, setEconomyData] = useState({
    totalRubiniCoins: 0,
    totalUsers: 0,
    averageBalance: 0
  });
  const [userBalances, setUserBalances] = useState<Array<{
    id: string;
    nome: string;
    twitch_username: string | null;
    rubini_coins: number;
    tickets: number;
  }>>([]);
  const [economyLoading, setEconomyLoading] = useState(false);
  const [economySearchTerm, setEconomySearchTerm] = useState("");
  const [selectedEconomyUser, setSelectedEconomyUser] = useState<any>(null);
  const [economyEditOpen, setEconomyEditOpen] = useState(false);
  const [newEconomyRubiniCoins, setNewEconomyRubiniCoins] = useState("");
  const [newEconomyTickets, setNewEconomyTickets] = useState("");

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

  // Carregar usuários quando a aba for selecionada
  useEffect(() => {
    if (activeTab === "users" && users.length === 0) {
      loadUsers();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          nome,
          twitch_username,
          created_at,
          updated_at,
          user_daily_logins!inner(ultimo_login)
        `)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const usersWithLastLogin = data?.map(user => ({
        ...user,
        last_login: user.user_daily_logins?.[0]?.ultimo_login || user.created_at
      })) || [];

      setUsers(usersWithLastLogin);
    } catch (error: any) {
      console.error("Erro ao carregar usuários:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários",
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const loadUserDetails = async (user: UserProfile) => {
    setUserDetailsLoading(true);
    setSelectedUser(user);
    
    try {
      // Carregar saldos
      const [rubiniCoinsResult, ticketsResult] = await Promise.all([
        supabase
          .from('rubini_coins_balance')
          .select('saldo')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('tickets')
          .select('tickets_atual')
          .eq('user_id', user.id)
          .single()
      ]);

      setUserBalance({
        rubini_coins: rubiniCoinsResult.data?.saldo || 0,
        tickets: ticketsResult.data?.tickets_atual || 0
      });

      // Carregar histórico (últimas 50 transações)
      const { data: historyData, error: historyError } = await supabase
        .from('rubini_coins_history')
        .select('tipo_operacao, valor, descricao, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (historyError) throw historyError;

      const formattedHistory = historyData?.map(item => ({
        type: item.tipo_operacao,
        amount: item.valor,
        description: item.descricao || '',
        created_at: item.created_at
      })) || [];

      setUserHistory(formattedHistory);

    } catch (error: any) {
      console.error("Erro ao carregar detalhes do usuário:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes do usuário",
        variant: "destructive",
      });
    } finally {
      setUserDetailsLoading(false);
    }
  };

  const updateUserBalance = async () => {
    if (!selectedUser || !userBalance) return;

    try {
      const rubiniCoinsValue = parseInt(newRubiniCoins) || userBalance.rubini_coins;
      const ticketsValue = parseInt(newTickets) || userBalance.tickets;

      // Atualizar Rubini Coins
      const { error: rcError } = await supabase
        .from('rubini_coins_balance')
        .upsert({
          user_id: selectedUser.id,
          saldo: rubiniCoinsValue
        });

      if (rcError) throw rcError;

      // Atualizar Tickets
      const { error: ticketsError } = await supabase
        .from('tickets')
        .upsert({
          user_id: selectedUser.id,
          tickets_atual: ticketsValue
        });

      if (ticketsError) throw ticketsError;

      // Registrar no histórico
      if (rubiniCoinsValue !== userBalance.rubini_coins) {
        await supabase
          .from('rubini_coins_history')
          .insert({
            user_id: selectedUser.id,
            tipo_operacao: 'admin_adjustment',
            valor: rubiniCoinsValue - userBalance.rubini_coins,
            saldo_anterior: userBalance.rubini_coins,
            saldo_atual: rubiniCoinsValue,
            descricao: 'Ajuste manual pelo administrador'
          });
      }

      setUserBalance({
        rubini_coins: rubiniCoinsValue,
        tickets: ticketsValue
      });

      setEditBalanceOpen(false);
      setNewRubiniCoins("");
      setNewTickets("");

      toast({
        title: "Sucesso",
        description: "Saldo atualizado com sucesso",
      });

    } catch (error: any) {
      console.error("Erro ao atualizar saldo:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar saldo do usuário",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.twitch_username && user.twitch_username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Carregar economia quando a aba for selecionada
  useEffect(() => {
    if (activeTab === "economy") {
      loadEconomyData();
    }
  }, [activeTab]);

  // Carregar logs quando a aba for selecionada
  useEffect(() => {
    if (activeTab === "logs") {
      loadLogs();
    }
  }, [activeTab, logsType, logsDateFilter]);

  const loadEconomyData = async () => {
    setEconomyLoading(true);
    try {
      // Carregar dados de economia
      const { data: balancesData, error: balancesError } = await supabase
        .from('rubini_coins_balance')
        .select(`
          user_id,
          saldo,
          profiles!inner(nome, twitch_username)
        `);

      if (balancesError) throw balancesError;

      // Carregar tickets
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('user_id, tickets_atual');

      if (ticketsError) throw ticketsError;

      // Combinar dados
      const ticketsMap = new Map(ticketsData?.map(t => [t.user_id, t.tickets_atual]) || []);
      
      const userBalancesData = balancesData?.map(item => ({
        id: item.user_id,
        nome: item.profiles.nome,
        twitch_username: item.profiles.twitch_username,
        rubini_coins: item.saldo || 0,
        tickets: ticketsMap.get(item.user_id) || 0
      })) || [];

      // Calcular estatísticas
      const totalRubiniCoins = userBalancesData.reduce((sum, user) => sum + user.rubini_coins, 0);
      const totalUsers = userBalancesData.length;
      const averageBalance = totalUsers > 0 ? Math.round(totalRubiniCoins / totalUsers) : 0;

      setUserBalances(userBalancesData.sort((a, b) => b.rubini_coins - a.rubini_coins));
      setEconomyData({
        totalRubiniCoins,
        totalUsers,
        averageBalance
      });

    } catch (error: any) {
      console.error("Erro ao carregar dados da economia:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da economia",
        variant: "destructive",
      });
    } finally {
      setEconomyLoading(false);
    }
  };

  const updateEconomyUserBalance = async () => {
    if (!selectedEconomyUser) return;

    try {
      const rubiniCoinsValue = parseInt(newEconomyRubiniCoins) || selectedEconomyUser.rubini_coins;
      const ticketsValue = parseInt(newEconomyTickets) || selectedEconomyUser.tickets;

      // Atualizar Rubini Coins
      const { error: rcError } = await supabase
        .from('rubini_coins_balance')
        .upsert({
          user_id: selectedEconomyUser.id,
          saldo: rubiniCoinsValue
        });

      if (rcError) throw rcError;

      // Atualizar Tickets
      const { error: ticketsError } = await supabase
        .from('tickets')
        .upsert({
          user_id: selectedEconomyUser.id,
          tickets_atual: ticketsValue
        });

      if (ticketsError) throw ticketsError;

      // Registrar no histórico
      if (rubiniCoinsValue !== selectedEconomyUser.rubini_coins) {
        await supabase
          .from('rubini_coins_history')
          .insert({
            user_id: selectedEconomyUser.id,
            tipo_operacao: 'admin_adjustment',
            valor: rubiniCoinsValue - selectedEconomyUser.rubini_coins,
            saldo_anterior: selectedEconomyUser.rubini_coins,
            saldo_atual: rubiniCoinsValue,
            descricao: 'Ajuste manual pelo administrador (aba Economia)'
          });
      }

      // Atualizar estado local
      setUserBalances(prev => prev.map(user => 
        user.id === selectedEconomyUser.id 
          ? { ...user, rubini_coins: rubiniCoinsValue, tickets: ticketsValue }
          : user
      ));

      // Recalcular estatísticas
      const updatedBalances = userBalances.map(user => 
        user.id === selectedEconomyUser.id 
          ? { ...user, rubini_coins: rubiniCoinsValue, tickets: ticketsValue }
          : user
      );
      
      const totalRubiniCoins = updatedBalances.reduce((sum, user) => sum + user.rubini_coins, 0);
      const totalUsers = updatedBalances.length;
      const averageBalance = totalUsers > 0 ? Math.round(totalRubiniCoins / totalUsers) : 0;

      setEconomyData({
        totalRubiniCoins,
        totalUsers,
        averageBalance
      });

      setEconomyEditOpen(false);
      setNewEconomyRubiniCoins("");
      setNewEconomyTickets("");
      setSelectedEconomyUser(null);

      toast({
        title: "Sucesso",
        description: "Saldo atualizado com sucesso",
      });

    } catch (error: any) {
      console.error("Erro ao atualizar saldo:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar saldo do usuário",
        variant: "destructive",
      });
    }
  };

  const filteredEconomyUsers = userBalances.filter(user =>
    user.nome?.toLowerCase().includes(economySearchTerm.toLowerCase()) ||
    user.twitch_username?.toLowerCase().includes(economySearchTerm.toLowerCase())
  );

  const filteredLogs = logsData.filter(log =>
    log.user_name?.toLowerCase().includes(logsSearchTerm.toLowerCase()) ||
    log.description?.toLowerCase().includes(logsSearchTerm.toLowerCase()) ||
    log.log_type?.toLowerCase().includes(logsSearchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
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

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 mb-8">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            <span>Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="economy" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            <span>Economia</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Logs</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Configurações</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Status do Sistema</CardTitle>
                <CardDescription>Visão geral do status atual</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span>StreamElements:</span>
                  <span className="text-green-500 font-medium">Conectado</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span>Twitch API:</span>
                  <span className="text-green-500 font-medium">Conectado</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span>Banco de Dados:</span>
                  <span className="text-green-500 font-medium">Online</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estatísticas</CardTitle>
                <CardDescription>Números importantes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span>Usuários Ativos:</span>
                  <span className="font-medium">--</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span>Rubini Coins em Circulação:</span>
                  <span className="font-medium">--</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span>Recompensas Diárias Hoje:</span>
                  <span className="font-medium">--</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
                <CardDescription>Operações comuns</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setActiveTab("users")}>
                  <Users className="mr-2 h-4 w-4" />
                  Gerenciar Usuários
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setActiveTab("economy")}>
                  <Coins className="mr-2 h-4 w-4" />
                  Gerenciar Rubini Coins
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setActiveTab("logs")}>
                  <FileText className="mr-2 h-4 w-4" />
                  Ver Logs do Sistema
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabela de usuários */}
            <Card>
              <CardHeader>
                <CardTitle>Todos os Usuários</CardTitle>
                <CardDescription>Lista de usuários cadastrados no sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou username..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  
                  {usersLoading ? (
                    <div className="text-center py-8">Carregando usuários...</div>
                  ) : (
                    <div className="border rounded-lg max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Username Twitch</TableHead>
                            <TableHead>Último Acesso</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.nome}</TableCell>
                              <TableCell>{user.twitch_username || "N/A"}</TableCell>
                              <TableCell>
                                {new Date(user.last_login || user.created_at).toLocaleDateString('pt-BR')}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => loadUserDetails(user)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Detalhes do usuário selecionado */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhes do Usuário</CardTitle>
                <CardDescription>
                  {selectedUser ? `Informações de ${selectedUser.nome}` : "Selecione um usuário para ver os detalhes"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userDetailsLoading ? (
                  <div className="text-center py-8">Carregando detalhes...</div>
                ) : selectedUser && userBalance ? (
                  <div className="space-y-4">
                    {/* Saldos */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{userBalance.rubini_coins}</div>
                        <div className="text-sm text-muted-foreground">Rubini Coins</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{userBalance.tickets}</div>
                        <div className="text-sm text-muted-foreground">Tickets</div>
                      </div>
                    </div>

                    {/* Botão para editar saldo */}
                    <Dialog open={editBalanceOpen} onOpenChange={setEditBalanceOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" variant="outline">
                          <Edit className="mr-2 h-4 w-4" />
                          Editar Saldo
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Saldo - {selectedUser.nome}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="rubini-coins">Rubini Coins</Label>
                            <Input
                              id="rubini-coins"
                              type="number"
                              placeholder={userBalance.rubini_coins.toString()}
                              value={newRubiniCoins}
                              onChange={(e) => setNewRubiniCoins(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="tickets">Tickets</Label>
                            <Input
                              id="tickets"
                              type="number"
                              placeholder={userBalance.tickets.toString()}
                              value={newTickets}
                              onChange={(e) => setNewTickets(e.target.value)}
                            />
                          </div>
                          <Button onClick={updateUserBalance} className="w-full">
                            Atualizar Saldo
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Histórico */}
                    <div>
                      <h4 className="font-semibold mb-2">Histórico Recente</h4>
                      <div className="border rounded-lg max-h-48 overflow-y-auto">
                        {userHistory.length > 0 ? (
                          <div className="divide-y">
                            {userHistory.map((item, index) => (
                              <div key={index} className="p-3 text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{item.type}</span>
                                  <span className={`font-bold ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.amount >= 0 ? '+' : ''}{item.amount}
                                  </span>
                                </div>
                                <div className="text-muted-foreground">{item.description}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(item.created_at).toLocaleString('pt-BR')}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-muted-foreground">
                            Nenhum histórico encontrado
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Clique em um usuário na tabela ao lado para ver os detalhes
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="economy" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Total de Rubini Coins</CardTitle>
                <CardDescription>Em circulação no sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">
                  {economyData.totalRubiniCoins.toLocaleString('pt-BR')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usuários Ativos</CardTitle>
                <CardDescription>Com saldo registrado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {economyData.totalUsers}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Saldo Médio</CardTitle>
                <CardDescription>Por usuário</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {economyData.averageBalance.toLocaleString('pt-BR')}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Saldos dos Usuários</CardTitle>
              <CardDescription>Lista completa de usuários e seus saldos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuário..."
                    value={economySearchTerm}
                    onChange={(e) => setEconomySearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>

                {economyLoading ? (
                  <div className="text-center py-8">Carregando dados da economia...</div>
                ) : (
                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Username Twitch</TableHead>
                          <TableHead className="text-right">Rubini Coins</TableHead>
                          <TableHead className="text-right">Tickets</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEconomyUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.nome}</TableCell>
                            <TableCell>{user.twitch_username || "N/A"}</TableCell>
                            <TableCell className="text-right font-bold text-yellow-600">
                              {user.rubini_coins.toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-right font-bold text-blue-600">
                              {user.tickets.toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEconomyUser(user);
                                  setNewEconomyRubiniCoins(user.rubini_coins.toString());
                                  setNewEconomyTickets(user.tickets.toString());
                                  setEconomyEditOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dialog para editar saldo na aba economia */}
          <Dialog open={economyEditOpen} onOpenChange={setEconomyEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Editar Saldo - {selectedEconomyUser?.nome}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="economy-rubini-coins">Rubini Coins</Label>
                  <Input
                    id="economy-rubini-coins"
                    type="number"
                    value={newEconomyRubiniCoins}
                    onChange={(e) => setNewEconomyRubiniCoins(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="economy-tickets">Tickets</Label>
                  <Input
                    id="economy-tickets"
                    type="number"
                    value={newEconomyTickets}
                    onChange={(e) => setNewEconomyTickets(e.target.value)}
                  />
                </div>
                <Button onClick={updateEconomyUserBalance} className="w-full">
                  Atualizar Saldo
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Sistema</CardTitle>
              <CardDescription>Acesse todas as configurações e funcionalidades administrativas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Configurações de Jogos */}
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Gamepad2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <h3 className="font-semibold">Jogos</h3>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/tibiatermo")}
                      className="w-full justify-start"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      TibiaTermo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/wheels")}
                      className="w-full justify-start"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Roleta
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/games")}
                      className="w-full justify-start"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Outros Jogos
                    </Button>
                  </div>
                </Card>

                {/* Configurações de Recompensas */}
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Gift className="h-5 w-5 text-green-600" />
                    </div>
                    <h3 className="font-semibold">Recompensas</h3>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Recompensas Diárias
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Recompensas Especiais
                    </Button>
                  </div>
                </Card>

                {/* Configurações de Economia */}
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Coins className="h-5 w-5 text-yellow-600" />
                    </div>
                    <h3 className="font-semibold">Economia</h3>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <Coins className="h-4 w-4 mr-2" />
                      Rubini Coins
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/tickets")}
                      className="w-full justify-start"
                    >
                      <Ticket className="h-4 w-4 mr-2" />
                      Tickets
                    </Button>
                  </div>
                </Card>

                {/* Configurações de Chat */}
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-purple-600" />
                    </div>
                    <h3 className="font-semibold">Chat</h3>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Moderação
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configurações Gerais
                    </Button>
                  </div>
                </Card>

                {/* Configurações de StreamElements */}
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Zap className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h3 className="font-semibold">StreamElements</h3>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      Sincronização
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Logs
                    </Button>
                  </div>
                </Card>

                {/* Configurações de Usuários */}
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Users className="h-5 w-5 text-orange-600" />
                    </div>
                    <h3 className="font-semibold">Usuários</h3>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Gerenciar Usuários
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Consolidação de Perfis
                    </Button>
                  </div>
                </Card>

                {/* Configurações de Sistema */}
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Server className="h-5 w-5 text-red-600" />
                    </div>
                    <h3 className="font-semibold">Sistema</h3>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Manutenção
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <BarChart className="h-4 w-4 mr-2" />
                      Estatísticas
                    </Button>
                  </div>
                </Card>

                {/* Configurações de Interface */}
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-teal-100 rounded-lg">
                      <Palette className="h-5 w-5 text-teal-600" />
                    </div>
                    <h3 className="font-semibold">Interface</h3>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <Megaphone className="h-4 w-4 mr-2" />
                      Banner Promocional
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <Trophy className="h-4 w-4 mr-2" />
                      Rankings
                    </Button>
                  </div>
                </Card>

                {/* Configurações de Sorteios */}
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-pink-100 rounded-lg">
                      <Gift className="h-5 w-5 text-pink-600" />
                    </div>
                    <h3 className="font-semibold">Sorteios</h3>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/site-settings")}
                      className="w-full justify-start"
                    >
                      <Shuffle className="h-4 w-4 mr-2" />
                      Configurar Sorteios
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/history")}
                      className="w-full justify-start"
                    >
                      <History className="h-4 w-4 mr-2" />
                      Histórico
                    </Button>
                  </div>
                </Card>

              </div>

              {/* Seção de Acesso Rápido */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Acesso Rápido</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/site-settings")}
                    className="h-auto p-4 flex flex-col items-center gap-2"
                  >
                    <Settings className="h-6 w-6" />
                    <span className="text-sm">Configurações Gerais</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("users")}
                    className="h-auto p-4 flex flex-col items-center gap-2"
                  >
                    <Users className="h-6 w-6" />
                    <span className="text-sm">Gerenciar Usuários</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("economy")}
                    className="h-auto p-4 flex flex-col items-center gap-2"
                  >
                    <Coins className="h-6 w-6" />
                    <span className="text-sm">Economia</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("logs")}
                    className="h-auto p-4 flex flex-col items-center gap-2"
                  >
                    <FileText className="h-6 w-6" />
                    <span className="text-sm">Ver Logs</span>
                  </Button>
                </div>
              </div>

              {/* Informações do Sistema */}
              <div className="mt-8 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Informações do Sistema</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Versão:</span>
                    <div className="font-medium">v2.0.0</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ambiente:</span>
                    <div className="font-medium">Produção</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Última Atualização:</span>
                    <div className="font-medium">{new Date().toLocaleDateString('pt-BR')}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="font-medium text-green-600">Online</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Details Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <div className="font-medium">{selectedUser.nome}</div>
                </div>
                <div>
                  <Label>Username Twitch</Label>
                  <div className="font-medium">{selectedUser.twitch_username || "N/A"}</div>
                </div>
                <div>
                  <Label>Data de Cadastro</Label>
                  <div className="font-medium">
                    {new Date(selectedUser.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div>
                  <Label>Último Login</Label>
                  <div className="font-medium">
                    {selectedUser.last_login 
                      ? new Date(selectedUser.last_login).toLocaleDateString('pt-BR')
                      : "N/A"
                    }
                  </div>
                </div>
              </div>

              {userBalance && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <Label>Rubini Coins</Label>
                    <div className="text-2xl font-bold text-yellow-600">{userBalance.rubini_coins}</div>
                  </div>
                  <div>
                    <Label>Tickets</Label>
                    <div className="text-2xl font-bold text-blue-600">{userBalance.tickets}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => setEditBalanceOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Saldo
                </Button>
              </div>

              {userHistory.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Histórico Recente</h4>
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userHistory.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.type}</TableCell>
                            <TableCell>{item.amount}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>
                              {new Date(item.created_at).toLocaleDateString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Balance Dialog */}
      <Dialog open={editBalanceOpen} onOpenChange={setEditBalanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Saldo do Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rubini-coins">Rubini Coins</Label>
              <Input
                id="rubini-coins"
                type="number"
                value={newRubiniCoins}
                onChange={(e) => setNewRubiniCoins(e.target.value)}
                placeholder="Digite a quantidade de Rubini Coins"
              />
            </div>
            <div>
              <Label htmlFor="tickets">Tickets</Label>
              <Input
                id="tickets"
                type="number"
                value={newTickets}
                onChange={(e) => setNewTickets(e.target.value)}
                placeholder="Digite a quantidade de Tickets"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={updateUserBalance} className="flex-1">
                Salvar Alterações
              </Button>
              <Button variant="outline" onClick={() => setEditBalanceOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Economy Edit Dialog */}
      <Dialog open={economyEditOpen} onOpenChange={setEconomyEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Saldo - {selectedEconomyUser?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="economy-rubini-coins">Rubini Coins</Label>
              <Input
                id="economy-rubini-coins"
                type="number"
                value={newEconomyRubiniCoins}
                onChange={(e) => setNewEconomyRubiniCoins(e.target.value)}
                placeholder="Digite a quantidade de Rubini Coins"
              />
            </div>
            <div>
              <Label htmlFor="economy-tickets">Tickets</Label>
              <Input
                id="economy-tickets"
                type="number"
                value={newEconomyTickets}
                onChange={(e) => setNewEconomyTickets(e.target.value)}
                placeholder="Digite a quantidade de Tickets"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={updateEconomyUserBalance} className="flex-1">
                Salvar Alterações
              </Button>
              <Button variant="outline" onClick={() => setEconomyEditOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;