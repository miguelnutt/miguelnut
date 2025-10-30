import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Ticket as TicketIcon, Plus, Minus, Trash2, X, Check } from "lucide-react";
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
import { useAdminMode } from "@/contexts/AdminModeContext";
import { RaffleDialog } from "@/components/RaffleDialog";
import { AddTicketDialog } from "@/components/AddTicketDialog";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { PromotionalBar } from "@/components/PromotionalBar";

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
  tipo_premio: string;
  valor_premio: number;
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
  const { isAdminMode } = useAdminMode();
  const [ranking, setRanking] = useState<TicketRanking[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [ticketHistory, setTicketHistory] = useState<TicketHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [raffleDialogOpen, setRaffleDialogOpen] = useState(false);
  const [addTicketDialogOpen, setAddTicketDialogOpen] = useState(false);
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
      // Ranking de tickets - buscar tickets e perfis separadamente para melhor controle
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select("user_id, tickets_atual")
        .gt("tickets_atual", 0) // Só buscar usuários com tickets > 0
        .order("tickets_atual", { ascending: false });

      if (ticketsError) throw ticketsError;

      if (!ticketsData || ticketsData.length === 0) {
        setRanking([]);
        return;
      }

      const userIds = Array.from(new Set(ticketsData.map((t: any) => t.user_id).filter(Boolean)));

      // Dividir userIds em lotes menores para evitar erro 400 (query muito longa)
      const batchSize = 50; // Reduzir o tamanho do lote
      const profilesData: any[] = [];
      
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        
        try {
          const { data: batchProfiles, error: batchError } = await supabase
            .from("profiles")
            .select("id, nome, nome_personagem, twitch_username, is_temporary, is_active, merged_into")
            .in("id", batch);

          if (batchError) {
            console.error(`Erro ao buscar lote ${i / batchSize + 1}:`, batchError);
          } else if (batchProfiles) {
            profilesData.push(...batchProfiles);
          }
        } catch (error) {
          console.error(`Erro no lote ${i / batchSize + 1}:`, error);
        }
      }

      console.log("Tickets encontrados:", ticketsData.length);
      console.log("User IDs únicos:", userIds.length);
      console.log("Perfis encontrados:", profilesData.length);

      // Processar perfis: separar ativos, inativos e mesclados
      const activeProfiles = profilesData.filter(p => p.is_active && !p.merged_into);
      const inactiveProfiles = profilesData.filter(p => !p.is_active && !p.merged_into);
      const mergedProfiles = profilesData.filter(p => p.merged_into);

      console.log(`Processando perfis - Ativos: ${activeProfiles.length}, Inativos: ${inactiveProfiles.length}, Mesclados: ${mergedProfiles.length}`);

      // Criar mapa inicial com perfis ativos
      const profilesMap: Record<string, any> = {};
      activeProfiles.forEach((p: any) => {
        profilesMap[p.id] = p;
      });

      // Adicionar perfis inativos se não houver conflito
      inactiveProfiles.forEach((p: any) => {
        if (!profilesMap[p.id]) {
          profilesMap[p.id] = { ...p, _inactive: true };
        }
      });

      // Processar perfis mesclados
      if (mergedProfiles.length > 0) {
        console.log("Processando perfis mesclados:", mergedProfiles);
        
        const canonicalIds = Array.from(new Set(mergedProfiles.map(p => p.merged_into).filter(Boolean)));
        
        if (canonicalIds.length > 0) {
          const { data: canonicalProfiles, error: canonicalError } = await supabase
            .from("profiles")
            .select("id, nome, nome_personagem, twitch_username, is_temporary, is_active")
            .in("id", canonicalIds);
            
          if (canonicalError) {
            console.error("Erro ao buscar perfis canônicos:", canonicalError);
          } else if (canonicalProfiles) {
            console.log("Perfis canônicos encontrados:", canonicalProfiles);
            
            // Mapear perfis mesclados para seus canônicos
            mergedProfiles.forEach(merged => {
              if (merged.merged_into) {
                const canonical = canonicalProfiles.find(c => c.id === merged.merged_into);
                if (canonical) {
                  profilesMap[merged.id] = {
                    ...canonical,
                    id: merged.id, // Manter o ID original para o mapeamento
                    _merged_from: merged.merged_into
                  };
                } else {
                  // Se não encontrou o canônico, usar o próprio perfil mesclado
                  profilesMap[merged.id] = { ...merged, _merged_orphan: true };
                }
              }
            });
          }
        }
      }

      console.log("Mapa final de perfis:", Object.keys(profilesMap).length, "perfis");

      // Montar ranking com nomes corretos
      const rankingList: TicketRanking[] = ticketsData
        .map((t: any) => {
          const profile = profilesMap[t.user_id];
          let displayName = "Usuário desconhecido";
          
          if (profile) {
            // Priorizar nome, depois nome_personagem, depois twitch_username
            if (profile.nome && profile.nome.trim() !== '') {
              displayName = profile.nome;
            } else if (profile.nome_personagem && profile.nome_personagem.trim() !== '') {
              displayName = profile.nome_personagem;
            } else if (profile.twitch_username && profile.twitch_username.trim() !== '') {
              displayName = profile.twitch_username;
            } else if (profile.is_temporary) {
              displayName = "Usuário Temporário";
            }
            

          } else {
            console.log("Perfil não encontrado para user_id:", t.user_id);
          }

          return {
            user_id: t.user_id,
            nome: displayName,
            tickets_atual: t.tickets_atual
          };
        })
        .filter((r: TicketRanking) => r.tickets_atual > 0);

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

  const removeUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja remover ${userName} da lista de tickets?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("tickets")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      toast.success(`${userName} removido da lista de tickets`);
      await fetchData();
    } catch (error: any) {
      console.error("Error removing user:", error);
      toast.error("Erro ao remover usuário: " + error.message);
    }
  };

  const deleteTicketHistory = async (historyItem: TicketHistory) => {
    if (!confirm("Tem certeza que deseja apagar este registro do histórico?")) {
      return;
    }

    try {
      if (historyItem.tipo === 'spin') {
        const { error } = await supabase
          .from("spins")
          .delete()
          .eq("id", historyItem.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ticket_ledger")
          .delete()
          .eq("id", historyItem.id);
        
        if (error) throw error;
      }

      toast.success("Registro apagado com sucesso!");
      await fetchData();
    } catch (error: any) {
      console.error("Error deleting history:", error);
      toast.error("Erro ao apagar registro: " + error.message);
    }
  };

  const deleteRaffle = async (raffleId: string, raffle: Raffle) => {
    if (!confirm("Tem certeza que deseja excluir este sorteio?")) {
      return;
    }

    try {
      // Se for Rubini Coins ou Tickets, usar a edge function que ajusta o saldo
      if (raffle.tipo_premio === 'Rubini Coins' || raffle.tipo_premio === 'Tickets') {
        const { error } = await supabase.functions.invoke("delete-raffle-history", {
          body: { raffleId },
        });

        if (error) throw error;
      } else {
        // Para Pontos de Loja, deletar direto (não podemos deduzir do StreamElements)
        const { error } = await supabase
          .from("raffles")
          .delete()
          .eq("id", raffleId);
        
        if (error) throw error;
      }

      toast.success("Sorteio excluído com sucesso!");
      await fetchData();
    } catch (error: any) {
      console.error("Error deleting raffle:", error);
      toast.error("Erro ao excluir sorteio: " + error.message);
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
            Tickets
          </h1>
        </div>

        {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <Button 
                onClick={() => setAddTicketDialogOpen(true)}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Ticket
              </Button>
              <Button 
                onClick={() => setRaffleDialogOpen(true)}
                className="bg-gradient-primary shadow-glow w-full sm:w-auto"
              >
                <Trophy className="mr-2 h-4 w-4" />
                Realizar Sorteio
              </Button>
            </div>
          )}

        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TicketIcon className="h-5 w-5" />
                Ranking de Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ranking.length === 0 ? (
                <p className="text-sm md:text-base text-muted-foreground text-center py-4">
                  Nenhum ticket distribuído ainda
                </p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  {/* Layout Mobile - Cards */}
                  <div className="md:hidden space-y-3">
                    {ranking.map((item, index) => (
                      <div key={item.user_id} className="border border-border rounded-lg p-4 bg-card/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold">
                              {index === 0 && "🥇"}
                              {index === 1 && "🥈"}
                              {index === 2 && "🥉"}
                              {index > 2 && `${index + 1}º`}
                            </span>
                            <div>
                              <div className="font-medium text-base">{item.nome}</div>
                              <div className="text-sm text-muted-foreground">{item.tickets_atual} tickets</div>
                            </div>
                          </div>
                        </div>
                        
                        {isAdmin && isAdminMode && editingUser === item.user_id && (
                          <div className="mt-3 pt-3 border-t border-border space-y-2">
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min="0"
                                value={directValue[item.user_id] ?? item.tickets_atual}
                                onChange={(e) => setDirectValue({
                                  ...directValue,
                                  [item.user_id]: e.target.value
                                })}
                                className="flex-1"
                                placeholder="Valor total"
                              />
                              <Button
                                size="sm"
                                onClick={() => {
                                  const newVal = parseInt(directValue[item.user_id] ?? item.tickets_atual.toString());
                                  if (!isNaN(newVal) && newVal >= 0) {
                                    setDirectTickets(item.user_id, newVal);
                                  }
                                }}
                                disabled={adjusting}
                              >
                                Definir
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                value={ticketAdjustment}
                                onChange={(e) => setTicketAdjustment(e.target.value)}
                                placeholder="Adicionar/Remover (±)"
                                className="flex-1"
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
                                disabled={adjusting}
                              >
                                Ajustar
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
                              className="w-full"
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}
                        
                        {isAdmin && isAdminMode && editingUser !== item.user_id && (
                          <div className="mt-3 pt-3 border-t border-border flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingUser(item.user_id);
                                setDirectValue({ [item.user_id]: item.tickets_atual.toString() });
                              }}
                              className="flex-1"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeUser(item.user_id, item.nome)}
                              className="flex-1"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remover
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Layout Desktop - Table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead className="w-20">Pos.</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead className="w-32 text-right">Tickets</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ranking.map((item, index) => (
                          <>
                            <TableRow key={item.user_id}>
                              <TableCell className="font-bold">
                                {index === 0 && "🥇"}
                                {index === 1 && "🥈"}
                                {index === 2 && "🥉"}
                                {index > 2 && `${index + 1}º`}
                              </TableCell>
                              <TableCell className="font-medium">{item.nome}</TableCell>
                              <TableCell className="text-right">{item.tickets_atual}</TableCell>
                            </TableRow>
                            {isAdmin && isAdminMode && (
                              <TableRow key={`${item.user_id}-controls`}>
                                <TableCell colSpan={3} className="py-2 bg-muted/20">
                                  {editingUser === item.user_id ? (
                                    <div className="space-y-3 px-2">
                                      <div className="flex gap-2 items-center">
                                        <Label className="w-32 text-sm">Definir valor:</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          value={directValue[item.user_id] ?? item.tickets_atual}
                                          onChange={(e) => setDirectValue({
                                            ...directValue,
                                            [item.user_id]: e.target.value
                                          })}
                                          className="w-32"
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
                                          disabled={adjusting}
                                        >
                                          Definir
                                        </Button>
                                      </div>
                                      <div className="flex gap-2 items-center">
                                        <Label className="w-32 text-sm">Ajustar (±):</Label>
                                        <Input
                                          type="number"
                                          value={ticketAdjustment}
                                          onChange={(e) => setTicketAdjustment(e.target.value)}
                                          placeholder="Ex: +10 ou -5"
                                          className="w-32"
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
                                          disabled={adjusting}
                                        >
                                          Aplicar
                                        </Button>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingUser(null);
                                            setTicketAdjustment("");
                                            setDirectValue({});
                                          }}
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2 px-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingUser(item.user_id);
                                          setDirectValue({ [item.user_id]: item.tickets_atual.toString() });
                                        }}
                                      >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Editar Tickets
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => removeUser(item.user_id, item.nome)}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Remover Usuário
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimos Sorteios - Lado a lado com o Ranking */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Últimos Sorteios
              </CardTitle>
            </CardHeader>
            <CardContent>
              {raffles.length === 0 ? (
                <p className="text-sm md:text-base text-muted-foreground text-center py-4">
                  Nenhum sorteio realizado ainda
                </p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto space-y-2 md:space-y-3">
                  {raffles.map((raffle) => (
                    <div
                      key={raffle.id}
                      className="p-3 md:p-4 bg-gradient-card rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Trophy className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="font-bold text-sm truncate">{raffle.nome_vencedor}</span>
                        </div>
                        {isAdmin && isAdminMode && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive flex-shrink-0"
                            onClick={() => deleteRaffle(raffle.id, raffle)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(raffle.created_at)}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs text-primary font-semibold">
                          Prêmio: {raffle.valor_premio} {raffle.tipo_premio}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {raffle.participantes?.length || 0} participantes
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico de Tickets - Abaixo, ocupando toda largura */}
          {isAdmin && (
          <Card className="shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TicketIcon className="h-5 w-5" />
                Histórico de Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticketHistory.length === 0 ? (
                <p className="text-sm md:text-base text-muted-foreground text-center py-4">
                  Nenhum histórico ainda
                </p>
              ) : (
                <div className="space-y-2 md:space-y-3 max-h-[400px] overflow-y-auto">
                  {ticketHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 md:p-3 bg-gradient-card rounded-lg"
                    >
                      <div className="flex items-start md:items-center justify-between mb-1 gap-2 flex-wrap md:flex-nowrap">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-bold text-xs md:text-sm truncate">{item.nome_usuario}</span>
                          <span className="text-primary font-bold text-xs md:text-sm whitespace-nowrap">
                            {item.valor} {item.tipo === 'spin' ? 'ticket(s)' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(item.created_at)}
                          </span>
                          {isAdmin && isAdminMode && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => deleteTicketHistory(item)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
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
          )}
        </div>
      </main>

      <RaffleDialog
        open={raffleDialogOpen}
        onOpenChange={setRaffleDialogOpen}
        onSuccess={fetchData}
      />

      <AddTicketDialog
        open={addTicketDialogOpen}
        onOpenChange={setAddTicketDialogOpen}
        onSuccess={fetchData}
      />
    </div>
  );
}
