import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical } from "lucide-react";
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
    duracao_spin: number;
  } | null;
}

const tiposRecompensa = ["Pontos de Loja", "Tickets", "Rubini Coins"] as const;

const colorThemes = {
  Red: ["#540002", "#F66262", "#B3040A", "#FFBABA"],
  Orange: ["#C75D00", "#FFB06B", "#FF7700", "#FFD7B4"],
  Yellow: ["#A77C00", "#FFDE85", "#FFBE00", "#FAF0D0"],
  Green: ["#1E5128", "#BCCC9A", "#4E9F3D", "#E4F1C0"],
  Blue: ["#032D80", "#7EA4E6", "#0062C9", "#DEEEFF"],
  Purple: ["#6F0381", "#E897F6", "#9935AA", "#F8E3FB"],
  Pink: ["#AD0059", "#FDABDC", "#F7007E", "#FFF3F9"],
  Brown: ["#362300", "#8A744A", "#734C00", "#FBEED4"],
  Black: ["#061000", "#A9A9A9", "#4C4C4C", "#EFEFEF"],
};

export function WheelDialog({ open, onOpenChange, onSuccess, wheel }: WheelDialogProps) {
  const [nome, setNome] = useState(wheel?.nome || "");
  const [duracaoSpin, setDuracaoSpin] = useState(wheel?.duracao_spin || 4);
  const [recompensas, setRecompensas] = useState<Recompensa[]>(
    wheel?.recompensas || [
      { tipo: "Tickets", valor: "1", cor: "#2D5016" },
      { tipo: "Pontos de Loja", valor: "100", cor: "#C1E1C1" }
    ]
  );
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof colorThemes>("Green");
  const [loading, setLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Atualizar estados quando a prop wheel mudar
  useEffect(() => {
    if (wheel) {
      setNome(wheel.nome);
      setDuracaoSpin(wheel.duracao_spin || 4);
      setRecompensas(wheel.recompensas);
    } else {
      setNome("");
      setDuracaoSpin(4);
      setRecompensas([
        { tipo: "Tickets", valor: "1", cor: "#2D5016" },
        { tipo: "Pontos de Loja", valor: "100", cor: "#C1E1C1" }
      ]);
    }
  }, [wheel, open]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newRecompensas = [...recompensas];
    const draggedItem = newRecompensas[draggedIndex];
    newRecompensas.splice(draggedIndex, 1);
    newRecompensas.splice(index, 0, draggedItem);
    setRecompensas(newRecompensas);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const applyTheme = (theme: keyof typeof colorThemes) => {
    setSelectedTheme(theme);
    const colors = colorThemes[theme];
    setRecompensas(recompensas.map((r, i) => ({
      ...r,
      cor: colors[i % colors.length]
    })));
  };

  const addRecompensa = () => {
    const colors = colorThemes[selectedTheme];
    setRecompensas([
      ...recompensas,
      {
        tipo: "Tickets",
        valor: "1",
        cor: colors[recompensas.length % colors.length]
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
          .update({ nome, duracao_spin: duracaoSpin, recompensas: recompensas as any })
          .eq("id", wheel.id);

        if (error) throw error;
        toast.success("Roleta atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("wheels")
          .insert({ nome, duracao_spin: duracaoSpin, recompensas: recompensas as any });

        if (error) throw error;
        toast.success("Roleta criada com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
      setNome("");
      setDuracaoSpin(4);
      setRecompensas([
        { tipo: "Tickets", valor: "1", cor: "#006400" },
        { tipo: "Pontos de Loja", valor: "100", cor: "#98FB98" }
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
            <Label htmlFor="duracao">Duração do Giro (segundos)</Label>
            <Input
              id="duracao"
              type="number"
              min="1"
              max="30"
              value={duracaoSpin}
              onChange={(e) => setDuracaoSpin(Math.max(1, Math.min(30, parseInt(e.target.value) || 4)))}
              placeholder="Ex: 4"
            />
          </div>

          <div>
            <Label className="mb-2 block">Tema de Cores</Label>
            <div className="grid grid-cols-7 gap-2">
              {(Object.keys(colorThemes) as Array<keyof typeof colorThemes>).map((theme) => (
                <button
                  key={theme}
                  onClick={() => applyTheme(theme)}
                  className={`flex flex-col gap-0.5 p-2 rounded-lg border-2 transition-all ${
                    selectedTheme === theme ? 'border-primary scale-105' : 'border-transparent hover:border-muted'
                  }`}
                >
                  {colorThemes[theme].map((color, i) => (
                    <div
                      key={i}
                      className="w-full h-3 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <span className="text-[10px] text-center mt-1 font-medium">{theme}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Recompensas (arraste para reordenar)</Label>
              <Button onClick={addRecompensa} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-3">
              {recompensas.map((recompensa, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex gap-2 items-start p-3 border rounded-lg bg-card transition-opacity ${
                    draggedIndex === index ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  <div className="cursor-grab active:cursor-grabbing pt-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <select
                        value={recompensa.tipo}
                        onChange={(e) => updateRecompensa(index, "tipo", e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      >
                        {tiposRecompensa.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo}
                          </option>
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