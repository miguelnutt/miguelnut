import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";

export function StreakRulesSection() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pontosComum, setPontosComum] = useState(25);
  const [pontosMultiplo5, setPontosMultiplo5] = useState(50);
  const [custoRestauracaoPorDia, setCustoRestauracaoPorDia] = useState(200);
  const [permitirRestauracao, setPermitirRestauracao] = useState(true);
  const [rubiniCoinsPorDia, setRubiniCoinsPorDia] = useState(0);
  const [ticketsPorDia, setTicketsPorDia] = useState(0);
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
        setCustoRestauracaoPorDia(data.custo_restauracao_por_dia ?? 200);
        setPermitirRestauracao(data.permitir_restauracao ?? true);
        setRubiniCoinsPorDia(data.rubini_coins_por_dia ?? 0);
        setTicketsPorDia(data.tickets_por_dia ?? 0);
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
      toast.error('Pontos devem ser maiores que 0');
      return;
    }
    
    if (custoRestauracaoPorDia < 0 || custoRestauracaoPorDia > 1000) {
      toast.error('Custo de restauração deve estar entre 0 e 1000');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        pontos_dia_comum: pontosComum,
        pontos_multiplo_cinco: pontosMultiplo5,
        custo_restauracao_por_dia: custoRestauracaoPorDia,
        permitir_restauracao: permitirRestauracao,
        rubini_coins_por_dia: rubiniCoinsPorDia,
        tickets_por_dia: ticketsPorDia,
      };

      if (configId) {
        const { error } = await supabase
          .from('daily_reward_default_config')
          .update(updateData)
          .eq('id', configId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_reward_default_config')
          .insert(updateData);

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
                <li>• <strong>Múltiplos de 5:</strong> +{pontosMultiplo5} pontos de loja</li>
                {rubiniCoinsPorDia > 0 && <li>• <strong>Rubini Coins:</strong> +{rubiniCoinsPorDia} por dia</li>}
                {ticketsPorDia > 0 && <li>• <strong>Tickets:</strong> +{ticketsPorDia} por dia</li>}
              </ul>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold mb-3 block">Recompensas por Dia</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="pontosComum" className="text-sm">Pontos Loja - Comum</Label>
                    <Input
                      id="pontosComum"
                      type="number"
                      min="1"
                      value={pontosComum}
                      onChange={(e) => setPontosComum(parseInt(e.target.value) || 25)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pontosMultiplo5" className="text-sm">Pontos Loja - Múltiplo 5</Label>
                    <Input
                      id="pontosMultiplo5"
                      type="number"
                      min="1"
                      value={pontosMultiplo5}
                      onChange={(e) => setPontosMultiplo5(parseInt(e.target.value) || 50)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rubiniCoins" className="text-sm">Rubini Coins (opcional)</Label>
                    <Input
                      id="rubiniCoins"
                      type="number"
                      min="0"
                      value={rubiniCoinsPorDia}
                      onChange={(e) => setRubiniCoinsPorDia(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tickets" className="text-sm">Tickets (opcional)</Label>
                    <Input
                      id="tickets"
                      type="number"
                      min="0"
                      value={ticketsPorDia}
                      onChange={(e) => setTicketsPorDia(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-semibold mb-3 block">Restauração de Sequência</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor="permitirRestauracao" className="text-sm font-medium cursor-pointer">
                        Permitir Restauração
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Se desativado, usuários não podem restaurar streak perdida
                      </p>
                    </div>
                    <Switch
                      id="permitirRestauracao"
                      checked={permitirRestauracao}
                      onCheckedChange={setPermitirRestauracao}
                    />
                  </div>
                  
                  {permitirRestauracao && (
                    <div>
                      <Label htmlFor="custoRestauracao" className="text-sm">
                        Custo por Dia Perdido (Pontos de Loja)
                      </Label>
                      <Input
                        id="custoRestauracao"
                        type="number"
                        min="0"
                        max="1000"
                        value={custoRestauracaoPorDia}
                        onChange={(e) => setCustoRestauracaoPorDia(parseInt(e.target.value) || 200)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Preview: perder 3 dias = {custoRestauracaoPorDia * 3} pontos para restaurar
                      </p>
                    </div>
                  )}
                </div>
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
