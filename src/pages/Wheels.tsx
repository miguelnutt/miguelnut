import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { useAdmin } from "@/hooks/useAdmin";
import { WheelDialog } from "@/components/WheelDialog";
import { SpinDialog } from "@/components/SpinDialog";
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
                  <div className="aspect-square rounded-lg bg-card flex items-center justify-center mb-4 relative overflow-hidden p-4">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="relative w-full h-full max-w-[240px] max-h-[240px]">
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                          {wheel.recompensas.map((r, i) => {
                            const total = wheel.recompensas.length;
                            const angle = 360 / total;
                            const startAngle = i * angle - 90;
                            const endAngle = (i + 1) * angle - 90;
                            
                            const startRad = (startAngle * Math.PI) / 180;
                            const endRad = (endAngle * Math.PI) / 180;
                            
                            const x1 = 100 + 80 * Math.cos(startRad);
                            const y1 = 100 + 80 * Math.sin(startRad);
                            const x2 = 100 + 80 * Math.cos(endRad);
                            const y2 = 100 + 80 * Math.sin(endRad);
                            
                            const largeArcFlag = angle > 180 ? 1 : 0;
                            
                            return (
                              <g key={i}>
                                <path
                                  d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                                  fill={r.cor}
                                  stroke="white"
                                  strokeWidth="1"
                                />
                              </g>
                            );
                          })}
                          <circle cx="100" cy="100" r="20" fill="white" stroke="hsl(var(--primary))" strokeWidth="3" />
                          <text x="100" y="108" textAnchor="middle" fontSize="20">🎯</text>
                        </svg>
                      </div>
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
