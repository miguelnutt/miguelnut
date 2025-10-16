import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
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

interface Spin {
  id: string;
  nome_usuario: string;
  tipo_recompensa: string;
  valor: string;
  created_at: string;
  wheels: { nome: string } | null;
}

export default function History() {
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useAdmin(user);
  const [spins, setSpins] = useState<Spin[]>([]);
  const [filteredSpins, setFilteredSpins] = useState<Spin[]>([]);
  const [loading, setLoading] = useState(true);
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

    const channel = supabase
      .channel("spins_history")
      .on("postgres_changes", { event: "*", schema: "public", table: "spins" }, () => fetchSpins())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, spins]);

  const fetchSpins = async () => {
    try {
      const { data, error } = await supabase
        .from("spins")
        .select(`
          *,
          wheels(nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSpins(data || []);
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

    if (filters.roleta && filtered[0]?.wheels) {
      filtered = filtered.filter(s => 
        s.wheels?.nome.toLowerCase().includes(filters.roleta.toLowerCase())
      );
    }

    setFilteredSpins(filtered);
  };

  const deleteHistory = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar este histórico?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("spins")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Histórico apagado com sucesso!");
      await fetchSpins();
    } catch (error: any) {
      console.error("Error deleting history:", error);
      toast.error("Erro ao apagar histórico: " + error.message);
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
        <div className="mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent" style={{ WebkitTextStroke: '1px rgba(139, 92, 246, 0.3)' }}>
            Histórico
          </h1>
        </div>

        <Card className="shadow-card mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
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
                <Label htmlFor="roleta">Roleta</Label>
                <Input
                  id="roleta"
                  placeholder="Nome da roleta"
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
              <div className="text-center py-8 text-muted-foreground">
                {spins.length === 0 ? "Nenhuma recompensa registrada" : "Nenhum resultado encontrado"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Roleta</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        {isAdmin && <TableHead className="text-center">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSpins.map((spin) => (
                        <TableRow key={spin.id}>
                          <TableCell className="font-medium">{spin.nome_usuario}</TableCell>
                          <TableCell>{spin.wheels?.nome || "N/A"}</TableCell>
                          <TableCell>{spin.tipo_recompensa}</TableCell>
                          <TableCell>{spin.valor}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(spin.created_at)}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteHistory(spin.id)}
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
    </div>
  );
}
