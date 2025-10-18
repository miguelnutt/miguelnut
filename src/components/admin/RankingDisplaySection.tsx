import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TrendingUp, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";

export function RankingDisplaySection() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exibirPublicamente, setExibirPublicamente] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('streak_ranking_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setConfigId(data.id);
        setExibirPublicamente(data.exibir_publicamente);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações de ranking');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (value: boolean) => {
    setSaving(true);
    try {
      if (configId) {
        const { error } = await supabase
          .from('streak_ranking_config')
          .update({ exibir_publicamente: value })
          .eq('id', configId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('streak_ranking_config')
          .insert({ exibir_publicamente: value });

        if (error) throw error;
      }

      setExibirPublicamente(value);
      toast.success(`Ranking ${value ? 'ativado' : 'desativado'} com sucesso!`);
      loadConfig();
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const updateRankingNow = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('recalculate-streak-ranking');
      
      if (error) throw error;
      
      toast.success('Ranking atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar ranking:', error);
      toast.error('Erro ao atualizar ranking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Rankings e Exibição
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !saving ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex-1">
                <Label htmlFor="public-ranking" className="text-base font-semibold">
                  Exibir Ranking Público
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Mostrar "Maiores sequências ativas" no dashboard
                </p>
              </div>
              <Switch
                id="public-ranking"
                checked={exibirPublicamente}
                onCheckedChange={saveConfig}
                disabled={saving}
              />
            </div>

            <Button 
              onClick={updateRankingNow} 
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar Agora
            </Button>

            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="text-muted-foreground">
                O ranking é atualizado automaticamente após cada resgate e na virada do dia (00:00 Brasília).
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
