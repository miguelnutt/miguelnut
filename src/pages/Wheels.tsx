import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Copy, GripVertical, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { WheelDialog } from "@/components/WheelDialog";
import { SpinDialog } from "@/components/SpinDialog";
import { CanvasWheel } from "@/components/CanvasWheel";
import { WheelRanking } from "@/components/WheelRanking";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { PromotionalBar } from "@/components/PromotionalBar";

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
  ordem: number;
  duracao_spin: number;
  visivel_para_usuarios: boolean;
}

export default function Wheels() {
  const { sessionUser, twitchUser, isAdmin } = useAuth();
  const { isAdminMode } = useAdminMode();
  const { loading: adminLoading } = useAdmin(sessionUser);
  const [wheels, setWheels] = useState<Wheel[]>([]);
  const [loading, setLoading] = useState(true);
  const [wheelDialogOpen, setWheelDialogOpen] = useState(false);
  const [spinDialogOpen, setSpinDialogOpen] = useState(false);
  const [selectedWheel, setSelectedWheel] = useState<Wheel | null>(null);
  const [editingWheel, setEditingWheel] = useState<Wheel | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [testMode, setTestMode] = useState(false);

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
        () => {
          fetchWheels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, adminLoading]);

  const fetchWheels = async () => {
    try {
      let query = supabase
        .from("wheels")
        .select("*")
        .eq("ativa", true);
      
      // Se não for admin ou não estiver em modo admin, mostrar apenas roletas visíveis
      if (!isAdmin || !isAdminMode) {
        query = query.eq("visivel_para_usuarios", true);
      }
      
      const { data, error } = await query
        .order("ordem", { ascending: true })
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
      fetchWheels();
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
      fetchWheels();
    } catch (error: any) {
      console.error("Error duplicating wheel:", error);
      toast.error("Erro ao duplicar roleta");
    }
  };

  const handleSpin = (wheel: Wheel, isTest: boolean = false) => {
    setSelectedWheel(wheel);
    setTestMode(isTest);
    setSpinDialogOpen(true);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newWheels = [...wheels];
    const draggedWheel = newWheels[draggedIndex];
    newWheels.splice(draggedIndex, 1);
    newWheels.splice(index, 0, draggedWheel);
    
    setWheels(newWheels);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    try {
      // Update ordem for all wheels
      const updates = wheels.map((wheel, index) => 
        supabase
          .from("wheels")
          .update({ ordem: index })
          .eq("id", wheel.id)
      );

      await Promise.all(updates);
      toast.success("Ordem atualizada!");
    } catch (error: any) {
      console.error("Error updating order:", error);
      toast.error("Erro ao atualizar ordem");
      fetchWheels(); // Reload on error
    } finally {
      setDraggedIndex(null);
    }
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

  const renderWheelsSection = () => {
    if (wheels.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nenhuma roleta criada ainda</p>
          {isAdmin && isAdminMode && (
            <Button onClick={() => setWheelDialogOpen(true)} className="bg-gradient-primary">
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeira Roleta
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
        {wheels.map((wheel, index) => (
          <Card 
            key={wheel.id} 
            className={`shadow-card hover:shadow-glow transition-all duration-300 ${
              isAdmin && isAdminMode ? 'cursor-move' : ''
            } ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}`}
            draggable={isAdmin && isAdminMode}
            onDragStart={() => isAdmin && isAdminMode && handleDragStart(index)}
            onDragOver={(e) => isAdmin && isAdminMode && handleDragOver(e, index)}
            onDragEnd={() => isAdmin && isAdminMode && handleDragEnd()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isAdmin && isAdminMode && (
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                  )}
                  <CardTitle>{wheel.nome}</CardTitle>
                </div>
                {isAdmin && isAdminMode && (
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        const { error } = await supabase
                          .from("wheels")
                          .update({ visivel_para_usuarios: !wheel.visivel_para_usuarios })
                          .eq("id", wheel.id);
                        
                        if (!error) {
                          toast.success(wheel.visivel_para_usuarios ? "Roleta ocultada" : "Roleta visível");
                        }
                      }}
                      title={wheel.visivel_para_usuarios ? "Ocultar roleta" : "Tornar roleta visível"}
                    >
                      {wheel.visivel_para_usuarios ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
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
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={() => handleSpin(wheel, true)}
                  variant="outline"
                  className="w-full"
                >
                  🎮 Testar Roleta
                </Button>
                {isAdmin && isAdminMode && (
                  <Button 
                    onClick={() => handleSpin(wheel, false)}
                    className="w-full bg-gradient-primary"
                  >
                    Girar Roleta
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PromotionalBar />
      
      <main className="container mx-auto px-4 py-4 md:py-8">
        <div className="mb-4 md:mb-8">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent" style={{ WebkitTextStroke: '1px rgba(139, 92, 246, 0.3)' }}>
            Roletas
          </h1>
        </div>

        {isAdmin && isAdminMode && (
          <div className="mb-6">
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
          </div>
        )}

        {/* Layout: Ranking esquerda, Roletas direita (2 por linha) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <WheelRanking />
          </div>
          <div className="lg:col-span-2">
            {renderWheelsSection()}
          </div>
        </div>
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
        testMode={testMode}
        loggedUser={sessionUser}
        twitchUser={twitchUser ? {
          login: twitchUser.login,
          id: twitchUser.twitch_user_id,
          display_name: twitchUser.display_name
        } : null}
      />
    </div>
  );
}
