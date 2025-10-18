import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StreakRanking } from "@/components/StreakRanking";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Trophy, Ticket, Coins, RotateCw, Calendar as CalendarIcon, X, Check } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { User } from "@supabase/supabase-js";
import { PromotionalBar } from "@/components/PromotionalBar";

interface Stats {
  totalSpins: number;
  activeTickets: number;
  totalPoints: number;
  totalRaffles: number;
  totalRC: number;
}

interface RecentSpin {
  id: string;
  nome_usuario: string;
  tipo_recompensa: string;
  valor: string;
  created_at: string;
}

interface RecentRaffle {
  id: string;
  nome_vencedor: string;
  created_at: string;
  tipo_premio: string;
  valor_premio: number;
  pago: boolean;
}

type PeriodType = "today" | "week" | "month" | "custom" | "all";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const { isAdmin } = useAdmin(user);
  const [stats, setStats] = useState<Stats>({
    totalSpins: 0,
    activeTickets: 0,
    totalPoints: 0,
    totalRaffles: 0,
    totalRC: 0
  });
  const [recentSpins, setRecentSpins] = useState<RecentSpin[]>([]);
  const [recentRaffles, setRecentRaffles] = useState<RecentRaffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>("all");
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    fetchData();

    const spinsChannel = supabase
      .channel("spins_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "spins" }, () => fetchData())
      .subscribe();

    const rafflesChannel = supabase
      .channel("raffles_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "raffles" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(spinsChannel);
      supabase.removeChannel(rafflesChannel);
    };
  }, [period, customStartDate, customEndDate]);

  const getDateRange = (): { startDate: string | null; endDate: string | null } => {
    if (period === "all") return { startDate: null, endDate: null };

    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    switch (period) {
      case "today":
        start = startOfDay(now);
        break;
      case "week":
        start = startOfWeek(now, { locale: ptBR });
        break;
      case "month":
        start = startOfMonth(now);
        break;
      case "custom":
        if (!customStartDate || !customEndDate) return { startDate: null, endDate: null };
        start = startOfDay(customStartDate);
        end = endOfDay(customEndDate);
        break;
      default:
        return { startDate: null, endDate: null };
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
  };

  const fetchData = async () => {
    try {
      const { startDate, endDate } = getDateRange();

      // Total de giros
      let spinsQuery = supabase.from("spins").select("*", { count: "exact", head: true });
      if (startDate && endDate) {
        spinsQuery = spinsQuery.gte("created_at", startDate).lte("created_at", endDate);
      }
      const { count: spinsCount } = await spinsQuery;

      // Total de tickets ativos (sem filtro de data - sempre mostra o total atual)
      const { data: ticketsData } = await supabase
        .from("tickets")
        .select("tickets_atual");
      const activeTickets = ticketsData?.reduce((sum, t) => sum + t.tickets_atual, 0) || 0;

      // Total de pontos distribuídos
      let pointsQuery = supabase
        .from("spins")
        .select("valor, tipo_recompensa")
        .eq("tipo_recompensa", "Pontos de Loja");
      if (startDate && endDate) {
        pointsQuery = pointsQuery.gte("created_at", startDate).lte("created_at", endDate);
      }
      const { data: pointsData } = await pointsQuery;
      const totalPoints = pointsData?.reduce((sum, s) => sum + (parseInt(s.valor) || 0), 0) || 0;

      // Total de sorteios
      let rafflesQuery = supabase.from("raffles").select("*", { count: "exact", head: true });
      if (startDate && endDate) {
        rafflesQuery = rafflesQuery.gte("created_at", startDate).lte("created_at", endDate);
      }
      const { count: rafflesCount } = await rafflesQuery;

      // Total de Rubini Coins pagos - soma todas as variações positivas do histórico
      let rcHistoryQuery = supabase
        .from("rubini_coins_history")
        .select("variacao")
        .gt("variacao", 0);
      if (startDate && endDate) {
        rcHistoryQuery = rcHistoryQuery.gte("created_at", startDate).lte("created_at", endDate);
      }
      const { data: rcHistoryData } = await rcHistoryQuery;
      const totalRC = rcHistoryData?.reduce((sum, h) => sum + (h.variacao || 0), 0) || 0;

      setStats({
        totalSpins: spinsCount || 0,
        activeTickets,
        totalPoints,
        totalRaffles: rafflesCount || 0,
        totalRC
      });

      // Últimas recompensas
      let recentSpinsQuery = supabase
        .from("spins")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (startDate && endDate) {
        recentSpinsQuery = recentSpinsQuery.gte("created_at", startDate).lte("created_at", endDate);
      }
      const { data: spinsData } = await recentSpinsQuery;
      setRecentSpins(spinsData || []);

      // Últimos sorteios
      let recentRafflesQuery = supabase
        .from("raffles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (startDate && endDate) {
        recentRafflesQuery = recentRafflesQuery.gte("created_at", startDate).lte("created_at", endDate);
      }
      const { data: rafflesData } = await recentRafflesQuery;
      setRecentRaffles(rafflesData || []);

    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "today": return "Hoje";
      case "week": return "Esta Semana";
      case "month": return "Este Mês";
      case "custom": 
        if (customStartDate && customEndDate) {
          return `${format(customStartDate, "dd/MM/yyyy")} - ${format(customEndDate, "dd/MM/yyyy")}`;
        }
        return "Período Personalizado";
      case "all": return "Todo o Período";
      default: return "Todo o Período";
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Carregando...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PromotionalBar />
      
      <main className="container mx-auto px-4 py-4 md:py-8">
        <div className="mb-4 md:mb-8">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent" style={{ WebkitTextStroke: '1px rgba(139, 92, 246, 0.3)' }}>
            Dashboard
          </h1>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center mb-8">
              <span className="text-sm text-muted-foreground">Período:</span>
              <Button
                variant={period === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("all")}
              >
                Tudo
              </Button>
              <Button
                variant={period === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("today")}
              >
                Hoje
              </Button>
              <Button
                variant={period === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("week")}
              >
                Semana
              </Button>
              <Button
                variant={period === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("month")}
              >
                Mês
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={period === "custom" ? "default" : "outline"}
                    size="sm"
                    className={cn("gap-2")}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {period === "custom" && customStartDate && customEndDate
                      ? `${format(customStartDate, "dd/MM")} - ${format(customEndDate, "dd/MM")}`
                      : "Personalizado"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Data Inicial</label>
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={(date) => {
                          setCustomStartDate(date);
                          if (date && customEndDate) setPeriod("custom");
                        }}
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Data Final</label>
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={(date) => {
                          setCustomEndDate(date);
                          if (customStartDate && date) setPeriod("custom");
                        }}
                        locale={ptBR}
                        disabled={(date) => customStartDate ? date < customStartDate : false}
                        className="pointer-events-auto"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
        
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-6 md:mb-8">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Giros</CardTitle>
              <RotateCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSpins}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tickets Ativos</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeTickets}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pontos Distribuídos</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPoints}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">RC's Pagos</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRC}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sorteios Realizados</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRaffles}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Últimas Recompensas</CardTitle>
            </CardHeader>
            <CardContent>
              {recentSpins.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhuma recompensa ainda</p>
              ) : (
                <div className="space-y-3">
                  {recentSpins.map((spin) => (
                    <div key={spin.id} className="flex justify-between items-center p-3 bg-gradient-card rounded-lg">
                      <div>
                        <p className="font-medium">{spin.nome_usuario}</p>
                        <p className="text-sm text-muted-foreground">
                          {spin.valor} {spin.tipo_recompensa}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(spin.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Últimos Sorteios</CardTitle>
            </CardHeader>
            <CardContent>
              {recentRaffles.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhum sorteio realizado</p>
              ) : (
                <div className="space-y-3">
                  {recentRaffles.map((raffle) => (
                    <div key={raffle.id} className="p-3 bg-gradient-card rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-primary" />
                          <p className="font-medium">{raffle.nome_vencedor}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(raffle.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between ml-7">
                        <p className="text-sm text-muted-foreground">
                          Prêmio: {raffle.valor_premio} {raffle.tipo_premio}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ranking de Sequências */}
        <div className="mt-8">
          <StreakRanking />
        </div>
      </main>
    </div>
  );
}
