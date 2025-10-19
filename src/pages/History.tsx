import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle } from "lucide-react";
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
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { PromotionalBar } from "@/components/PromotionalBar";

interface Spin {
  id: string;
  nome_usuario: string;
  tipo_recompensa: string;
  valor: string;
  created_at: string;
  wheels: { nome: string } | null;
  origem?: string;
}

export default function History() {
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useAdmin(user);
  const [spins, setSpins] = useState<Spin[]>([]);
  const [filteredSpins, setFilteredSpins] = useState<Spin[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [spinToDelete, setSpinToDelete] = useState<{ id: string; spin: Spin } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState({
    usuario: "",
    tipo: "",
    roleta: ""
  });

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
    fetchSpins();

    const spinsChannel = supabase
      .channel("spins_history")
      .on("postgres_changes", { event: "*", schema: "public", table: "spins" }, () => fetchSpins())
      .subscribe();

    const tibiaTermoChannel = supabase
      .channel("tibiatermo_history")
      .on("postgres_changes", { event: "*", schema: "public", table: "tibiatermo_history" }, () => fetchSpins())
      .subscribe();

    return () => {
      supabase.removeChannel(spinsChannel);
      supabase.removeChannel(tibiaTermoChannel);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, spins]);

  const fetchSpins = async () => {
    try {
      // Buscar histórico das roletas
      const { data: spinsData, error: spinsError } = await supabase
        .from("spins")
        .select(`
          *,
          wheels(nome)
        `)
        .order("created_at", { ascending: false });

      if (spinsError) throw spinsError;

      // Buscar histórico do TibiaTermo
      const { data: tibiaTermoData, error: tibiaTermoError } = await supabase
        .from("tibiatermo_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (tibiaTermoError) throw tibiaTermoError;

      // Mesclar os dados
      const tibiaTermoFormatted = (tibiaTermoData || []).map(item => ({
        id: item.id,
        nome_usuario: item.nome_usuario,
        tipo_recompensa: item.tipo_recompensa,
        valor: item.valor.toString(),
        created_at: item.created_at,
        wheels: null,
        origem: 'TibiaTermo'
      }));

      const allHistory = [...(spinsData || []), ...tibiaTermoFormatted];
      allHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setSpins(allHistory);
    } catch (error: any) {
      console.error("Error fetching spins:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...spins];

    if (filters.usuario) {
      filtered = filtered.filter(s => 
        s.nome_usuario.toLowerCase().includes(filters.usuario.toLowerCase())
      );
    }

    if (filters.tipo) {
      filtered = filtered.filter(s => s.tipo_recompensa === filters.tipo);
    }

    if (filters.roleta) {
      filtered = filtered.filter(s => {
        const gameOrWheel = s.origem || s.wheels?.nome || "";
        return gameOrWheel.toLowerCase().includes(filters.roleta.toLowerCase());
      });
    }

    setFilteredSpins(filtered);
  };

  const deleteHistory = async (id: string, spin: Spin) => {
    // Para Pontos de Loja (roletas ou TibiaTermo), mostrar diálogo com aviso de estorno
    if (spin.tipo_recompensa === "Pontos de Loja") {
      setSpinToDelete({ id, spin });
      setDeleteDialogOpen(true);
      return;
    }

    // Para outros tipos (Tickets, Rubini Coins), confirmação simples
    if (!confirm("Tem certeza que deseja apagar este histórico? O saldo do usuário será ajustado.")) {
      return;
    }

    await executeDelete(id, spin);
  };

  const executeDelete = async (id: string, spin: Spin) => {
    setDeleting(true);
    try {
      // Se for do TibiaTermo, usar função específica que gerencia estorno
      if (spin.origem === 'TibiaTermo') {
        const { data, error } = await supabase.functions.invoke("delete-tibiatermo-history", {
          body: { historyId: id },
        });

        if (error) throw error;
        
        toast.success(data?.message || "Histórico apagado com sucesso!");
        await fetchSpins();
        return;
      }

      // Se for Rubini Coins ou Tickets, usar a edge function que ajusta o saldo
      if (spin.tipo_recompensa === "Rubini Coins" || spin.tipo_recompensa === "Tickets") {
        const { error } = await supabase.functions.invoke("delete-spin-history", {
          body: { spinId: id },
        });

        if (error) throw error;
      } else if (spin.tipo_recompensa === "Pontos de Loja") {
        // Para Pontos de Loja, usar função de estorno que envia débito para StreamElements
        const { data, error } = await supabase.functions.invoke("revert-store-points", {
          body: { spinId: id },
        });

        if (error) throw error;

        if (data?.reverted) {
          toast.success(data.message || "Histórico apagado e pontos estornados na StreamElements!");
        } else {
          toast.success(data.message || "Histórico apagado com sucesso!");
        }
        
        await fetchSpins();
        return;
      } else {
        // Fallback: deletar direto
        const { error } = await supabase
          .from("spins")
          .delete()
          .eq("id", id);

        if (error) throw error;
      }

      toast.success("Histórico apagado com sucesso!");
      await fetchSpins();
    } catch (error: any) {
      console.error("Error deleting history:", error);
      toast.error("Erro ao apagar histórico: " + error.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setSpinToDelete(null);
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
            Histórico
          </h1>
        </div>

        <Card className="shadow-card mb-4 md:mb-6">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
              <div>
                <Label htmlFor="usuario">Usuário</Label>
                <Input
                  id="usuario"
                  placeholder="Nome do usuário"
                  value={filters.usuario}
                  onChange={(e) => setFilters({ ...filters, usuario: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tipo">Tipo de Recompensa</Label>
                <select
                  id="tipo"
                  value={filters.tipo}
                  onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Todos</option>
                  <option value="Pontos de Loja">Pontos de Loja</option>
                  <option value="Tickets">Tickets</option>
                  <option value="Rubini Coins">Rubini Coins</option>
                </select>
              </div>
              <div>
                <Label htmlFor="roleta">Jogo/Roleta</Label>
                <Input
                  id="roleta"
                  placeholder="Nome do jogo ou roleta"
                  value={filters.roleta}
                  onChange={(e) => setFilters({ ...filters, roleta: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-0">
            {filteredSpins.length === 0 ? (
              <div className="text-center py-8 text-sm md:text-base text-muted-foreground">
                {spins.length === 0 ? "Nenhuma recompensa registrada" : "Nenhum resultado encontrado"}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Usuário</TableHead>
                        <TableHead className="whitespace-nowrap">Jogo/Roleta</TableHead>
                        <TableHead className="whitespace-nowrap">Tipo</TableHead>
                        <TableHead className="whitespace-nowrap">Valor</TableHead>
                        <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                        {isAdmin && <TableHead className="text-center whitespace-nowrap">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSpins.map((spin) => (
                        <TableRow key={spin.id}>
                          <TableCell className="font-medium whitespace-nowrap">{spin.nome_usuario}</TableCell>
                          <TableCell className="whitespace-nowrap">{spin.origem || spin.wheels?.nome || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{spin.tipo_recompensa}</TableCell>
                          <TableCell className="whitespace-nowrap">{spin.valor}</TableCell>
                          <TableCell className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(spin.created_at)}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteHistory(spin.id, spin)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
      </main>

      {/* AlertDialog para Pontos de Loja */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão de Pontos de Loja
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="font-semibold text-foreground mb-1">Atenção: Esta ação irá:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Excluir o histórico permanentemente</li>
                  <li>
                    <strong>Debitar -{spinToDelete?.spin.valor} pontos</strong> da conta do usuário{' '}
                    <strong>{spinToDelete?.spin.nome_usuario}</strong> na StreamElements
                  </li>
                </ul>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p><strong>Usuário:</strong> {spinToDelete?.spin.nome_usuario}</p>
                <p><strong>Valor:</strong> {spinToDelete?.spin.valor} pontos</p>
                <p><strong>Origem:</strong> {spinToDelete?.spin.origem || spinToDelete?.spin.wheels?.nome || "-"}</p>
                <p><strong>Data:</strong> {spinToDelete?.spin.created_at && formatDate(spinToDelete.spin.created_at)}</p>
              </div>
              
              <p className="text-sm font-medium">
                Tem certeza que deseja continuar?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => spinToDelete && executeDelete(spinToDelete.id, spinToDelete.spin)}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Excluindo e estornando..." : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
