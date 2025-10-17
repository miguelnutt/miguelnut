import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase-helper";

interface DailyRewardConfig {
  dia: number;
  pontos: number;
}

interface DailyRewardConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DailyRewardConfigDialog({ open, onOpenChange }: DailyRewardConfigDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rewards, setRewards] = useState<DailyRewardConfig[]>([]);

  useEffect(() => {
    if (open) {
      loadRewards();
    }
  }, [open]);

  const loadRewards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_reward_config')
        .select('*')
        .order('dia', { ascending: true });

      if (error) throw error;
      setRewards(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar recompensas:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handlePontosChange = (dia: number, pontos: number) => {
    setRewards(prev => 
      prev.map(r => r.dia === dia ? { ...r, pontos } : r)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = rewards.map(reward => ({
        dia: reward.dia,
        pontos: reward.pontos,
      }));

      const { error } = await supabase
        .from('daily_reward_config')
        .upsert(updates);

      if (error) throw error;

      toast.success("Configurações salvas com sucesso!");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Recompensas Diárias</DialogTitle>
          <DialogDescription>
            Defina os pontos para cada dia de login consecutivo (1-30)
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {rewards.map((reward) => (
                <div key={reward.dia} className="space-y-2">
                  <Label>Dia {reward.dia}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="25"
                    value={reward.pontos}
                    onChange={(e) => handlePontosChange(reward.dia, parseInt(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
