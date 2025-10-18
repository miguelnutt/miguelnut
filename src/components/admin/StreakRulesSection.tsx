import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";

export function StreakRulesSection() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pontosComum, setPontosComum] = useState(25);
  const [pontosMultiplo5, setPontosMultiplo5] = useState(50);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_reward_default_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setConfigId(data.id);
        setPontosComum(data.pontos_dia_comum);
        setPontosMultiplo5(data.pontos_multiplo_cinco);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações padrão');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (pontosComum < 1 || pontosMultiplo5 < 1) {
      toast.error('Os valores devem ser maiores que 0');
      return;
    }

    setSaving(true);
    try {
      if (configId) {
        const { error } = await supabase
          .from('daily_reward_default_config')
          .update({
            pontos_dia_comum: pontosComum,
            pontos_multiplo_cinco: pontosMultiplo5
          })
          .eq('id', configId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_reward_default_config')
          .insert({
            pontos_dia_comum: pontosComum,
            pontos_multiplo_cinco: pontosMultiplo5
          });

        if (error) throw error;
      }

      toast.success('Configurações salvas com sucesso!');
      loadConfig();
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Sequência (Streak) — Regras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <p className="font-semibold mb-2">Regras Padrão Ativas:</p>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Todos os dias:</strong> +{pontosComum} pontos de loja</li>
                <li>• <strong>Múltiplos de 5 da sequência:</strong> +{pontosMultiplo5} pontos de loja</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pontosComum">Pontos - Dias Comuns</Label>
                <Input
                  id="pontosComum"
                  type="number"
                  min="1"
                  value={pontosComum}
                  onChange={(e) => setPontosComum(parseInt(e.target.value) || 25)}
                />
              </div>
              <div>
                <Label htmlFor="pontosMultiplo5">Pontos - Múltiplos de 5</Label>
                <Input
                  id="pontosMultiplo5"
                  type="number"
                  min="1"
                  value={pontosMultiplo5}
                  onChange={(e) => setPontosMultiplo5(parseInt(e.target.value) || 50)}
                />
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Próximo Prêmio:</p>
              <p className="text-muted-foreground">
                Dia 1-4: {pontosComum} pontos | Dia 5: {pontosMultiplo5} pontos | Dia 6-9: {pontosComum} pontos | Dia 10: {pontosMultiplo5} pontos...
              </p>
            </div>

            <Button onClick={saveConfig} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
              Salvar Regras Padrão
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
