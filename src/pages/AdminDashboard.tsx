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
  Ticket,
  Save,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  User,
  Clock,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase-helper";
import { Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  nome: string;
  twitch_username: string | null;
  twitch_user_id: string | null;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
  merged_into?: string | null;
  display_name_canonical?: string | null;
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
  saldo_anterior?: number;
  saldo_atual?: number;
}

interface UserStats {
  total_spins: number;
  total_games_played: number;
  daily_login_streak: number;
  last_daily_reward: string | null;
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
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  
  // Estados para edição de saldo
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [editBalanceOpen, setEditBalanceOpen] = useState(false);
  const [editRubiniCoins, setEditRubiniCoins] = useState("");
  const [editTickets, setEditTickets] = useState("");
  const [balanceUpdateReason, setBalanceUpdateReason] = useState("");

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
      // Buscar usuários únicos e ativos, sem duplicados
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          nome,
          twitch_username,
          twitch_user_id,
          created_at,
          updated_at,
          is_active,
          merged_into,
          display_name_canonical
        `)
        .eq('is_active', true)
        .is('merged_into', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Buscar último login para cada usuário (opcional, sem inner join)
      const usersWithLastLogin = await Promise.all(
        (data || []).map(async (user) => {
          try {
            const { data: loginData } = await supabase
              .from('user_daily_logins')
              .select('ultimo_login')
              .eq('user_id', user.id)
              .order('ultimo_login', { ascending: false })
              .limit(1)
              .single();

            return {
              ...user,
              last_login: loginData?.ultimo_login || user.created_at
            };
          } catch {
            return {
              ...user,
              last_login: user.created_at
            };
          }
        })
      );

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
    setIsEditingBalance(false);
    
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

      const balance = {
        rubini_coins: rubiniCoinsResult.data?.saldo || 0,
        tickets: ticketsResult.data?.tickets_atual || 0
      };
      
      setUserBalance(balance);
      setEditRubiniCoins(balance.rubini_coins.toString());
      setEditTickets(balance.tickets.toString());

      // Carregar histórico completo (últimas 100 transações)
      const { data: historyData, error: historyError } = await supabase
        .from('rubini_coins_history')
        .select('tipo_operacao, valor, descricao, created_at, saldo_anterior, saldo_atual')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (historyError) throw historyError;

      const formattedHistory = historyData?.map(item => ({
        type: item.tipo_operacao,
        amount: item.valor,
        description: item.descricao || '',
        created_at: item.created_at,
        saldo_anterior: item.saldo_anterior,
        saldo_atual: item.saldo_atual
      })) || [];

      setUserHistory(formattedHistory);

      // Carregar estatísticas do usuário
      const [spinsResult, gamesResult, streakResult] = await Promise.all([
        supabase
          .from('spins')
          .select('id')
          .eq('user_id', user.id),
        supabase
          .from('tibiadle_user_games')
          .select('id')
          .eq('user_id', user.id),
        supabase
          .from('user_daily_logins')
          .select('streak_atual, ultimo_login')
          .eq('user_id', user.id)
          .order('ultimo_login', { ascending: false })
          .limit(1)
          .single()
      ]);

      setUserStats({
        total_spins: spinsResult.data?.length || 0,
        total_games_played: gamesResult.data?.length || 0,
        daily_login_streak: streakResult.data?.streak_atual || 0,
        last_daily_reward: streakResult.data?.ultimo_login || null
      });

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
    if (!selectedUser || !userBalance || !session?.user) return;

    // Validações
    const newRubiniCoinsValue = parseInt(editRubiniCoins) || 0;
    const newTicketsValue = parseInt(editTickets) || 0;
    
    if (newRubiniCoinsValue < 0 || newTicketsValue < 0) {
      toast({
        title: "Erro",
        description: "Os valores não podem ser negativos",
        variant: "destructive",
      });
      return;
    }

    if (!balanceUpdateReason.trim()) {
      toast({
        title: "Erro",
        description: "É obrigatório informar o motivo da alteração",
        variant: "destructive",
      });
      return;
    }

    try {
      const rubiniCoinsDiff = newRubiniCoinsValue - userBalance.rubini_coins;
      const ticketsDiff = newTicketsValue - userBalance.tickets;

      // Atualizar Rubini Coins se houve mudança
      if (rubiniCoinsDiff !== 0) {
        const { error: rcError } = await supabase
          .from('rubini_coins_balance')
          .upsert({
            user_id: selectedUser.id,
            saldo: newRubiniCoinsValue
          });

        if (rcError) throw rcError;

        // Registrar no histórico de Rubini Coins
        await supabase
          .from('rubini_coins_history')
          .insert({
            user_id: selectedUser.id,
            tipo_operacao: 'admin_adjustment',
            valor: rubiniCoinsDiff,
            saldo_anterior: userBalance.rubini_coins,
            saldo_atual: newRubiniCoinsValue,
            descricao: `Ajuste administrativo: ${balanceUpdateReason}`,
            admin_user_id: session.user.id
          });
      }

      // Atualizar Tickets se houve mudança
      if (ticketsDiff !== 0) {
        const { error: ticketsError } = await supabase
          .from('tickets')
          .upsert({
            user_id: selectedUser.id,
            tickets_atual: newTicketsValue
          });

        if (ticketsError) throw ticketsError;

        // Registrar no histórico de tickets (se existir tabela)
        try {
          await supabase
            .from('ticket_ledger')
            .insert({
              user_id: selectedUser.id,
              tipo_operacao: 'admin_adjustment',
              valor: ticketsDiff,
              saldo_anterior: userBalance.tickets,
              saldo_atual: newTicketsValue,
              descricao: `Ajuste administrativo: ${balanceUpdateReason}`,
              admin_user_id: session.user.id,
              status: 'completed'
            });
        } catch (ticketLogError) {
          console.warn("Erro ao registrar log de tickets:", ticketLogError);
        }
      }

      // Atualizar estado local
      setUserBalance({
        rubini_coins: newRubiniCoinsValue,
        tickets: newTicketsValue
      });

      setIsEditingBalance(false);
      setEditBalanceOpen(false);
      setBalanceUpdateReason("");

      toast({
        title: "Sucesso",
        description: `Saldo atualizado com sucesso. ${rubiniCoinsDiff !== 0 ? `Rubini Coins: ${rubiniCoinsDiff > 0 ? '+' : ''}${rubiniCoinsDiff}` : ''} ${ticketsDiff !== 0 ? `Tickets: ${ticketsDiff > 0 ? '+' : ''}${ticketsDiff}` : ''}`,
      });

      // Recarregar histórico para mostrar a nova transação
      loadUserDetails(selectedUser);

    } catch (error: any) {
      console.error("Erro ao atualizar saldo:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar saldo do usuário",
        variant: "destructive",
      });
    }
  };

  const cancelBalanceEdit = () => {
    if (!userBalance) return;
    setEditRubiniCoins(userBalance.rubini_coins.toString());
    setEditTickets(userBalance.tickets.toString());
    setBalanceUpdateReason("");
    setIsEditingBalance(false);
    setEditBalanceOpen(false);
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de usuários */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Usuários ({filteredUsers.length})
                  </CardTitle>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadUsers}
                        disabled={usersLoading}
                      >
                        <RefreshCw className={`h-4 w-4 ${usersLoading ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                    
                    {usersLoading ? (
                      <div className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Carregando usuários...
                      </div>
                    ) : (
                      <div className="border rounded-lg max-h-[600px] overflow-y-auto">
                        <div className="divide-y">
                          {filteredUsers.map((user) => (
                            <div
                              key={user.id}
                              className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                                selectedUser?.id === user.id ? 'bg-muted border-l-4 border-l-primary' : ''
                              }`}
                              onClick={() => loadUserDetails(user)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{user.nome}</div>
                                  <div className="text-sm text-muted-foreground truncate">
                                    {user.twitch_username ? `@${user.twitch_username}` : "Sem Twitch"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(user.last_login || user.created_at).toLocaleDateString('pt-BR')}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {user.twitch_user_id && (
                                    <Badge variant="secondary" className="text-xs">
                                      Twitch
                                    </Badge>
                                  )}
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Painel de detalhes do usuário */}
            <div className="lg:col-span-2">
              {selectedUser ? (
                <div className="space-y-6">
                  {/* Cabeçalho do usuário */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">{selectedUser.nome}</CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              {selectedUser.twitch_username ? (
                                <>
                                  <Badge variant="secondary">@{selectedUser.twitch_username}</Badge>
                                  {selectedUser.twitch_user_id && (
                                    <Badge variant="outline">ID: {selectedUser.twitch_user_id}</Badge>
                                  )}
                                </>
                              ) : (
                                <Badge variant="destructive">Sem Twitch</Badge>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadUserDetails(selectedUser)}
                          disabled={userDetailsLoading}
                        >
                          <RefreshCw className={`h-4 w-4 ${userDetailsLoading ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>

                  {userDetailsLoading ? (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center">
                          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                          <p>Carregando detalhes do usuário...</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Informações básicas */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Informações Básicas
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground">ID do Usuário</Label>
                              <p className="font-mono text-sm">{selectedUser.id}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                              <p>
                                <Badge variant={selectedUser.is_active ? "default" : "destructive"}>
                                  {selectedUser.is_active ? "Ativo" : "Inativo"}
                                </Badge>
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground">Criado em</Label>
                              <p className="text-sm">{new Date(selectedUser.created_at).toLocaleString('pt-BR')}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground">Última atualização</Label>
                              <p className="text-sm">{new Date(selectedUser.updated_at).toLocaleString('pt-BR')}</p>
                            </div>
                            {selectedUser.last_login && (
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Último acesso</Label>
                                <p className="text-sm">{new Date(selectedUser.last_login).toLocaleString('pt-BR')}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Saldos e edição */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                              <DollarSign className="h-5 w-5" />
                              Saldos
                            </CardTitle>
                            {!isEditingBalance && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditingBalance(true)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {userBalance && (
                            <div className="space-y-4">
                              {isEditingBalance ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label htmlFor="edit-rubini-coins">Rubini Coins</Label>
                                      <Input
                                        id="edit-rubini-coins"
                                        type="number"
                                        min="0"
                                        value={editRubiniCoins}
                                        onChange={(e) => setEditRubiniCoins(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-tickets">Tickets</Label>
                                      <Input
                                        id="edit-tickets"
                                        type="number"
                                        min="0"
                                        value={editTickets}
                                        onChange={(e) => setEditTickets(e.target.value)}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <Label htmlFor="balance-reason">Motivo da alteração *</Label>
                                    <Input
                                      id="balance-reason"
                                      placeholder="Ex: Correção de bug, compensação, etc."
                                      value={balanceUpdateReason}
                                      onChange={(e) => setBalanceUpdateReason(e.target.value)}
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button onClick={updateUserBalance} className="flex-1">
                                      <Save className="h-4 w-4 mr-2" />
                                      Salvar
                                    </Button>
                                    <Button variant="outline" onClick={cancelBalanceEdit}>
                                      <X className="h-4 w-4 mr-2" />
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="text-center p-6 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                                    <div className="text-3xl font-bold text-yellow-600 mb-1">
                                      {userBalance.rubini_coins.toLocaleString('pt-BR')}
                                    </div>
                                    <div className="text-sm text-muted-foreground">Rubini Coins</div>
                                  </div>
                                  <div className="text-center p-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                                    <div className="text-3xl font-bold text-blue-600 mb-1">
                                      {userBalance.tickets.toLocaleString('pt-BR')}
                                    </div>
                                    <div className="text-sm text-muted-foreground">Tickets</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Estatísticas */}
                      {userStats && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Activity className="h-5 w-5" />
                              Estatísticas
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center p-4 border rounded-lg">
                                <div className="text-2xl font-bold text-purple-600">{userStats.total_spins}</div>
                                <div className="text-sm text-muted-foreground">Spins</div>
                              </div>
                              <div className="text-center p-4 border rounded-lg">
                                <div className="text-2xl font-bold text-green-600">{userStats.total_games_played}</div>
                                <div className="text-sm text-muted-foreground">Jogos</div>
                              </div>
                              <div className="text-center p-4 border rounded-lg">
                                <div className="text-2xl font-bold text-orange-600">{userStats.daily_login_streak}</div>
                                <div className="text-sm text-muted-foreground">Sequência</div>
                              </div>
                              <div className="text-center p-4 border rounded-lg">
                                <div className="text-sm font-bold text-indigo-600">
                                  {userStats.last_daily_reward 
                                    ? new Date(userStats.last_daily_reward).toLocaleDateString('pt-BR')
                                    : 'Nunca'
                                  }
                                </div>
                                <div className="text-sm text-muted-foreground">Último Login</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Histórico */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Histórico de Transações ({userHistory.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="border rounded-lg max-h-96 overflow-y-auto">
                            {userHistory.length > 0 ? (
                              <div className="divide-y">
                                {userHistory.map((item, index) => (
                                  <div key={index} className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Badge variant="outline" className="text-xs">
                                            {item.type}
                                          </Badge>
                                          <span className={`font-bold text-sm ${
                                            item.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                          }`}>
                                            {item.amount >= 0 ? '+' : ''}{item.amount.toLocaleString('pt-BR')}
                                          </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{item.description}</p>
                                        {item.saldo_anterior !== undefined && item.saldo_atual !== undefined && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Saldo: {item.saldo_anterior.toLocaleString('pt-BR')} → {item.saldo_atual.toLocaleString('pt-BR')}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground text-right">
                                        {new Date(item.created_at).toLocaleString('pt-BR')}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-8 text-center text-muted-foreground">
                                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Nenhum histórico encontrado</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">Selecione um usuário</h3>
                      <p>Clique em um usuário na lista ao lado para ver todos os detalhes</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
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