import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Ticket as TicketIcon, Plus, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase-helper";
import { useAdmin } from "@/hooks/useAdmin";
import { RaffleDialog } from "@/components/RaffleDialog";
import { AddUserDialog } from "@/components/AddUserDialog";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

interface TicketRanking {
  user_id: string;
  nome: string;
  tickets_atual: number;
}

interface Raffle {
  id: string;
  nome_vencedor: string;
  created_at: string;
  participantes: any;
}

interface TicketHistory {
  id: string;
  nome_usuario: string;
  valor: string;
  created_at: string;
  tipo: 'spin' | 'ledger';
  motivo?: string;
}

export default function Tickets() {
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useAdmin(user);
  const [ranking, setRanking] = useState<TicketRanking[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [ticketHistory, setTicketHistory] = useState<TicketHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [raffleDialogOpen, setRaffleDialogOpen] = useState(false);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [ticketAdjustment, setTicketAdjustment] = useState("");
  const [directValue, setDirectValue] = useState<Record<string, string>>({});
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchData();

    const ticketsChannel = supabase
      .channel("tickets_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => fetchData())
      .subscribe();

    const rafflesChannel = supabase
      .channel("raffles_tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "raffles" }, () => fetchData())
      .subscribe();

    const spinsChannel = supabase
      .channel("spins_tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "spins" }, () => fetchData())
      .subscribe();

    const ledgerChannel = supabase
      .channel("ticket_ledger_tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_ledger" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(rafflesChannel);
      supabase.removeChannel(spinsChannel);
      supabase.removeChannel(ledgerChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Ranking de tickets
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select("user_id, tickets_atual")
        .order("tickets_atual", { ascending: false });

      if (ticketsError) throw ticketsError;

      const userIds = Array.from(new Set((ticketsData || []).map((t: any) => t.user_id).filter(Boolean)));

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      const profilesMap: Record<string, string> = {};
      (profilesData || []).forEach((p: any) => {
        profilesMap[p.id] = p.nome;
      });

      const rankingList: TicketRanking[] = (ticketsData || []).map((t: any) => ({
        user_id: t.user_id,
        nome: profilesMap[t.user_id] || "Usuário desconhecido",
        tickets_atual: t.tickets_atual
      }));

      setRanking(rankingList);

      // Últimos sorteios
      const { data: rafflesData, error: rafflesError } = await supabase
        .from("raffles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (rafflesError) throw rafflesError;
      setRaffles(rafflesData || []);

      // Histórico de tickets ganhos na roleta
      const { data: spinsData, error: spinsError } = await supabase
        .from("spins" as any)
        .select("*")
        .eq("tipo_recompensa", "Tickets")
        .order("created_at", { ascending: false })
        .limit(20);

      if (spinsError) throw spinsError;

      // Buscar do ticket_ledger também
      const { data: ledgerData, error: ledgerError } = await supabase
        .from("ticket_ledger")
        .select("id, variacao, motivo, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(20);

      if (ledgerError) throw ledgerError;

      // Garantir nomes para usuários no ledger
      const ledgerUserIds = Array.from(new Set((ledgerData || []).map((e: any) => e.user_id).filter(Boolean)));
      const missingIds = ledgerUserIds.filter((id: string) => !(profilesMap as any)[id]);
      if (missingIds.length) {
        const { data: moreProfiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", missingIds);
        (moreProfiles || []).forEach((p: any) => {
          (profilesMap as any)[p.id] = p.nome;
        });
      }

      // Combinar e ordenar histórico
      const history: TicketHistory[] = [
        ...(spinsData || []).map((spin: any) => ({
          id: spin.id,
          nome_usuario: spin.nome_usuario,
          valor: spin.valor,
          created_at: spin.created_at,
          tipo: 'spin' as const,
        })),
        ...(ledgerData || []).map((entry: any) => ({
          id: entry.id,
          nome_usuario: entry.user_id ? ((profilesMap as any)[entry.user_id] || "Usuário desconhecido") : "Usuário desconhecido",
          valor: entry.variacao > 0 ? `+${entry.variacao}` : `${entry.variacao}`,
          created_at: entry.created_at,
          tipo: 'ledger' as const,
          motivo: entry.motivo
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTicketHistory(history.slice(0, 20));

    } catch (error: any) {
      console.error("Error fetching tickets data:", error);
      toast.error("Erro ao carregar dados de tickets");
    } finally {
      setLoading(false);
    }
  };

  const adjustTickets = async (userId: string, adjustment: number, motivo: string) => {
    setAdjusting(true);
    try {
      // Buscar tickets atuais
      const { data: currentData } = await supabase
        .from("tickets")
        .select("tickets_atual")
        .eq("user_id", userId)
        .maybeSingle();

      const currentTickets = currentData?.tickets_atual || 0;
      const newTickets = Math.max(0, currentTickets + adjustment);

      // Atualizar tickets
      const { error: updateError } = await supabase
        .from("tickets")
        .upsert({
          user_id: userId,
          tickets_atual: newTickets
        });

      if (updateError) throw updateError;

      // Salvar no ledger
      await supabase
        .from("ticket_ledger")
        .insert({
          user_id: userId,
          variacao: adjustment,
          motivo
        });

      toast.success("Tickets ajustados com sucesso!");
      setEditingUser(null);
      setTicketAdjustment("");
      setDirectValue({});
      
      // Forçar refresh imediato
      await fetchData();
    } catch (error: any) {
      console.error("Error adjusting tickets:", error);
      toast.error("Erro ao ajustar tickets: " + error.message);
    } finally {
      setAdjusting(false);
    }
  };

  const setDirectTickets = async (userId: string, newValue: number) => {
    const currentTickets = ranking.find(r => r.user_id === userId)?.tickets_atual || 0;
    const adjustment = newValue - currentTickets;
    
    if (adjustment !== 0) {
      await adjustTickets(
        userId,
        adjustment,
        `Valor ajustado de ${currentTickets} para ${newValue}`
      );
    } else {
      setEditingUser(null);
      setDirectValue({});
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
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Sistema de Tickets
          </h1>
          {isAdmin && (
            <div className="flex gap-2">
              <Button 
                onClick={() => setAddUserDialogOpen(true)}
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Usuário
              </Button>
              <Button 
                onClick={() => setRaffleDialogOpen(true)}
                className="bg-gradient-primary shadow-glow"
              >
                <Trophy className="mr-2 h-4 w-4" />
                Realizar Sorteio
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TicketIcon className="h-5 w-5" />
                Ranking de Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ranking.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum ticket distribuído ainda
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Posição</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Tickets</TableHead>
                        {isAdmin && <TableHead>Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ranking.map((item, index) => (
                        <TableRow key={item.user_id}>
                          <TableCell className="font-bold">
                            {index === 0 && "🥇"}
                            {index === 1 && "🥈"}
                            {index === 2 && "🥉"}
                            {index > 2 && `${index + 1}º`}
                          </TableCell>
                          <TableCell className="font-medium">{item.nome}</TableCell>
                          <TableCell>{item.tickets_atual}</TableCell>
                          {isAdmin && (
                            <TableCell>
                          {editingUser === item.user_id ? (
                                <div className="flex gap-2 items-center flex-wrap">
                                  <div className="flex gap-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={directValue[item.user_id] ?? item.tickets_atual}
                                      onChange={(e) => setDirectValue({
                                        ...directValue,
                                        [item.user_id]: e.target.value
                                      })}
                                      className="w-20"
                                      placeholder="Total"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        const newVal = parseInt(directValue[item.user_id] ?? item.tickets_atual.toString());
                                        if (!isNaN(newVal) && newVal >= 0) {
                                          setDirectTickets(item.user_id, newVal);
                                        }
                                      }}
                                    >
                                      Definir
                                    </Button>
                                  </div>
                                  <div className="flex gap-1">
                                    <Input
                                      type="number"
                                      value={ticketAdjustment}
                                      onChange={(e) => setTicketAdjustment(e.target.value)}
                                      placeholder="±"
                                      className="w-20"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        const adj = parseInt(ticketAdjustment);
                                        if (!isNaN(adj) && adj !== 0) {
                                          adjustTickets(
                                            item.user_id,
                                            adj,
                                            `Ajuste manual: ${adj > 0 ? "+" : ""}${adj}`
                                          );
                                        }
                                      }}
                                    >
                                      ±
                                    </Button>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingUser(null);
                                      setTicketAdjustment("");
                                      setDirectValue({});
                                    }}
                                  >
                                    X
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                     onClick={() => {
                                       adjustTickets(item.user_id, 1, "Adicionado +1 manualmente");
                                     }}
                                     disabled={adjusting}
                                   >
                                     <Plus className="h-4 w-4" />
                                   </Button>
                                   <Button
                                     size="icon"
                                     variant="ghost"
                                     onClick={() => {
                                       adjustTickets(item.user_id, -1, "Removido -1 manualmente");
                                     }}
                                     disabled={item.tickets_atual === 0 || adjusting}
                                   >
                                     <Minus className="h-4 w-4" />
                                   </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingUser(item.user_id);
                                      setDirectValue({ [item.user_id]: item.tickets_atual.toString() });
                                    }}
                                  >
                                    Editar
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TicketIcon className="h-5 w-5" />
                Histórico de Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticketHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum histórico ainda
                </p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {ticketHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-gradient-card rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{item.nome_usuario}</span>
                          <span className="text-primary font-bold">
                            {item.valor} {item.tipo === 'spin' ? 'ticket(s)' : ''}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                      {item.motivo && (
                        <div className="text-xs text-muted-foreground">
                          {item.motivo}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.tipo === 'spin' ? '🎰 Roleta' : '📝 Ajuste'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Últimos Sorteios
              </CardTitle>
            </CardHeader>
            <CardContent>
              {raffles.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum sorteio realizado ainda
                </p>
              ) : (
                <div className="space-y-3">
                  {raffles.map((raffle) => (
                    <div
                      key={raffle.id}
                      className="p-4 bg-gradient-card rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-primary" />
                          <span className="font-bold">{raffle.nome_vencedor}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(raffle.created_at)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {raffle.participantes?.length || 0} participantes
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <RaffleDialog
        open={raffleDialogOpen}
        onOpenChange={setRaffleDialogOpen}
        onSuccess={fetchData}
      />

      <AddUserDialog
        open={addUserDialogOpen}
        onOpenChange={setAddUserDialogOpen}
        onSuccess={fetchData}
      />
    </div>
  );
}
