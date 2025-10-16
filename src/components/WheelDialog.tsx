import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

const colorThemes = {
  Red: ["#8B0000", "#DC143C", "#FF6B6B", "#FFA07A", "#FFB6C1"],
  Orange: ["#CC5500", "#FF8C00", "#FFA500", "#FFB347", "#FFDAB9"],
  Yellow: ["#9B870C", "#DAA520", "#FFD700", "#F0E68C", "#FFFACD"],
  Green: ["#006400", "#228B22", "#32CD32", "#90EE90", "#98FB98"],
  Blue: ["#00008B", "#4169E1", "#6495ED", "#87CEEB", "#B0E0E6"],
  Purple: ["#4B0082", "#8B008B", "#9370DB", "#BA55D3", "#DDA0DD"],
  Pink: ["#C71585", "#FF1493", "#FF69B4", "#FFB6C1", "#FFC0CB"],
};

function SortableRecompensaItem({
  recompensa,
  index,
  onUpdate,
  onRemove,
  tiposRecompensa,
}: {
  recompensa: Recompensa;
  index: number;
  onUpdate: (index: number, field: keyof Recompensa, value: string) => void;
  onRemove: (index: number) => void;
  tiposRecompensa: readonly string[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `recompensa-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-2 items-start p-3 border rounded-lg bg-card"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing pt-2"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 space-y-2">
        <div>
          <Label className="text-xs">Tipo</Label>
          <select
            value={recompensa.tipo}
            onChange={(e) => onUpdate(index, "tipo", e.target.value)}
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
              onChange={(e) => onUpdate(index, "valor", e.target.value)}
              placeholder="Ex: 100"
            />
          </div>
          <div>
            <Label className="text-xs">Cor</Label>
            <Input
              type="color"
              value={recompensa.cor}
              onChange={(e) => onUpdate(index, "cor", e.target.value)}
              className="h-10 w-20"
            />
          </div>
        </div>
      </div>
      <Button
        onClick={() => onRemove(index)}
        size="icon"
        variant="ghost"
        className="text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function WheelDialog({ open, onOpenChange, onSuccess, wheel }: WheelDialogProps) {
  const [nome, setNome] = useState(wheel?.nome || "");
  const [recompensas, setRecompensas] = useState<Recompensa[]>(
    wheel?.recompensas || [
      { tipo: "Tickets", valor: "1", cor: "#228B22" },
      { tipo: "Pontos de Loja", valor: "100", cor: "#90EE90" }
    ]
  );
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof colorThemes>("Green");
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRecompensas((items) => {
        const oldIndex = parseInt(active.id.toString().split('-')[1]);
        const newIndex = parseInt(over.id.toString().split('-')[1]);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
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
        { tipo: "Tickets", valor: "1", cor: "#228B22" },
        { tipo: "Pontos de Loja", valor: "100", cor: "#90EE90" }
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
              <Label>Recompensas</Label>
              <Button onClick={addRecompensa} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={recompensas.map((_, i) => `recompensa-${i}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {recompensas.map((recompensa, index) => (
                    <SortableRecompensaItem
                      key={`recompensa-${index}`}
                      recompensa={recompensa}
                      index={index}
                      onUpdate={updateRecompensa}
                      onRemove={removeRecompensa}
                      tiposRecompensa={tiposRecompensa}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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