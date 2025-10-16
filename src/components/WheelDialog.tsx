import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";

interface Recompensa {
  tipo: "Pontos de Loja" | "Tickets" | "Rubini Coins";
  valor: string;
  cor: string;
}

interface WheelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  wheel?: {
    id: string;
    nome: string;
    recompensas: Recompensa[];
  } | null;
}

const tiposRecompensa = ["Pontos de Loja", "Tickets", "Rubini Coins"] as const;
const coresDisponiveis = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52BE80"
];

export function WheelDialog({ open, onOpenChange, onSuccess, wheel }: WheelDialogProps) {
  const [nome, setNome] = useState(wheel?.nome || "");
  const [recompensas, setRecompensas] = useState<Recompensa[]>(
    wheel?.recompensas || [
      { tipo: "Tickets", valor: "1", cor: coresDisponiveis[0] },
      { tipo: "Pontos de Loja", valor: "100", cor: coresDisponiveis[1] }
    ]
  );
  const [loading, setLoading] = useState(false);

  const addRecompensa = () => {
    setRecompensas([
      ...recompensas,
      {
        tipo: "Tickets",
        valor: "1",
        cor: coresDisponiveis[recompensas.length % coresDisponiveis.length]
      }
    ]);
  };

  const removeRecompensa = (index: number) => {
    setRecompensas(recompensas.filter((_, i) => i !== index));
  };

  const updateRecompensa = (index: number, field: keyof Recompensa, value: string) => {
    const updated = [...recompensas];
    updated[index] = { ...updated[index], [field]: value };
    setRecompensas(updated);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Digite um nome para a roleta");
      return;
    }

    if (recompensas.length === 0) {
      toast.error("Adicione pelo menos uma recompensa");
      return;
    }

    setLoading(true);
    try {
      if (wheel?.id) {
        const { error } = await supabase
          .from("wheels")
          .update({ nome, recompensas: recompensas as any })
          .eq("id", wheel.id);

        if (error) throw error;
        toast.success("Roleta atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("wheels")
          .insert({ nome, recompensas: recompensas as any });

        if (error) throw error;
        toast.success("Roleta criada com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
      setNome("");
      setRecompensas([
        { tipo: "Tickets", valor: "1", cor: coresDisponiveis[0] },
        { tipo: "Pontos de Loja", valor: "100", cor: coresDisponiveis[1] }
      ]);
    } catch (error: any) {
      console.error("Error saving wheel:", error);
      toast.error("Erro ao salvar roleta: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{wheel ? "Editar Roleta" : "Nova Roleta"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome da Roleta</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Roleta Principal"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Recompensas</Label>
              <Button onClick={addRecompensa} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-3">
              {recompensas.map((recompensa, index) => (
                <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <select
                        value={recompensa.tipo}
                        onChange={(e) => updateRecompensa(index, "tipo", e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      >
                        {tiposRecompensa.map(tipo => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Valor</Label>
                        <Input
                          value={recompensa.valor}
                          onChange={(e) => updateRecompensa(index, "valor", e.target.value)}
                          placeholder="Ex: 100"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cor</Label>
                        <Input
                          type="color"
                          value={recompensa.cor}
                          onChange={(e) => updateRecompensa(index, "cor", e.target.value)}
                          className="h-10 w-20"
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => removeRecompensa(index)}
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}