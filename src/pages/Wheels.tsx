import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Copy } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { useAdmin } from "@/hooks/useAdmin";
import { WheelDialog } from "@/components/WheelDialog";
import { SpinDialog } from "@/components/SpinDialog";
import { CanvasWheel } from "@/components/CanvasWheel";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

interface Recompensa {
  tipo: "Pontos de Loja" | "Tickets" | "Rubini Coins";
  valor: string;
  cor: string;
}

interface Wheel {
  id: string;
  nome: string;
  recompensas: Recompensa[];
  ativa: boolean;
}

export default function Wheels() {
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin, loading: adminLoading } = useAdmin(user);
  const [wheels, setWheels] = useState<Wheel[]>([]);
  const [loading, setLoading] = useState(true);
  const [wheelDialogOpen, setWheelDialogOpen] = useState(false);
  const [spinDialogOpen, setSpinDialogOpen] = useState(false);
  const [selectedWheel, setSelectedWheel] = useState<Wheel | null>(null);
  const [editingWheel, setEditingWheel] = useState<Wheel | null>(null);

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
    fetchWheels();

    const channel = supabase
      .channel("wheels_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wheels"
        },
        () => fetchWheels()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchWheels = async () => {
    try {
      const { data, error } = await supabase
        .from("wheels")
        .select("*")
        .eq("ativa", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWheels((data || []) as unknown as Wheel[]);
    } catch (error: any) {
      console.error("Error fetching wheels:", error);
      toast.error("Erro ao carregar roletas");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta roleta?")) return;

    try {
      const { error } = await supabase
        .from("wheels")
        .update({ ativa: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Roleta excluída com sucesso!");
    } catch (error: any) {
      console.error("Error deleting wheel:", error);
      toast.error("Erro ao excluir roleta");
    }
  };

  const handleEdit = (wheel: Wheel) => {
    setEditingWheel(wheel);
    setWheelDialogOpen(true);
  };

  const handleDuplicate = async (wheel: Wheel) => {
    try {
      const { error } = await supabase
        .from("wheels")
        .insert({
          nome: `${wheel.nome} (Cópia)`,
          recompensas: wheel.recompensas,
          ativa: true
        });

      if (error) throw error;
      toast.success("Roleta duplicada com sucesso!");
    } catch (error: any) {
      console.error("Error duplicating wheel:", error);
      toast.error("Erro ao duplicar roleta");
    }
  };

  const handleSpin = (wheel: Wheel) => {
    setSelectedWheel(wheel);
    setSpinDialogOpen(true);
  };

  if (loading || adminLoading) {
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
          <div>
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              Roletas
            </h1>
            <p className="text-muted-foreground">
              {isAdmin ? "Gerencie e rode suas roletas de recompensas" : "Visualize as roletas disponíveis"}
            </p>
          </div>
          {isAdmin && (
            <Button 
              onClick={() => {
                setEditingWheel(null);
                setWheelDialogOpen(true);
              }}
              className="bg-gradient-primary shadow-glow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Roleta
            </Button>
          )}
        </div>

        {wheels.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Nenhuma roleta criada ainda</p>
            {isAdmin && (
              <Button onClick={() => setWheelDialogOpen(true)} className="bg-gradient-primary">
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Roleta
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {wheels.map((wheel) => (
              <Card key={wheel.id} className="shadow-card hover:shadow-glow transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{wheel.nome}</CardTitle>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(wheel)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDuplicate(wheel)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(wheel.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="aspect-square rounded-lg bg-card flex items-center justify-center mb-4 relative overflow-hidden p-2">
                    <div className="w-full h-full flex items-center justify-center scale-[0.85]">
                      <CanvasWheel
                        recompensas={wheel.recompensas}
                        rotation={0}
                        spinning={false}
                        showArrow={false}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    {wheel.recompensas.length} recompensas
                  </div>
                  {isAdmin && (
                    <Button 
                      onClick={() => handleSpin(wheel)}
                      className="w-full bg-gradient-primary"
                    >
                      Girar Roleta
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <WheelDialog
        open={wheelDialogOpen}
        onOpenChange={(open) => {
          setWheelDialogOpen(open);
          if (!open) setEditingWheel(null);
        }}
        onSuccess={fetchWheels}
        wheel={editingWheel}
      />

      <SpinDialog
        open={spinDialogOpen}
        onOpenChange={setSpinDialogOpen}
        wheel={selectedWheel}
      />
    </div>
  );
}
