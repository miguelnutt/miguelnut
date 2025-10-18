import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";

interface ChatConfig {
  id: string;
  chat_ativo: boolean;
  permitir_links: boolean;
  permitir_simbolos: boolean;
  max_caracteres: number;
}

export function ChatModerationPanel() {
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setConfig(data);
    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('chat_config')
        .update({
          chat_ativo: config.chat_ativo,
          permitir_links: config.permitir_links,
          permitir_simbolos: config.permitir_simbolos,
          max_caracteres: config.max_caracteres
        })
        .eq('id', config.id);

      if (error) throw error;
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!config) {
    return <div>Configurações não encontradas</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Moderação do Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="chat-active" className="flex flex-col gap-1">
            <span>Chat Ativo</span>
            <span className="font-normal text-xs text-muted-foreground">
              Ativar ou desativar o chat completamente
            </span>
          </Label>
          <Switch
            id="chat-active"
            checked={config.chat_ativo}
            onCheckedChange={(checked) => setConfig({ ...config, chat_ativo: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="allow-links" className="flex flex-col gap-1">
            <span>Permitir Links</span>
            <span className="font-normal text-xs text-muted-foreground">
              Permitir que usuários enviem links no chat
            </span>
          </Label>
          <Switch
            id="allow-links"
            checked={config.permitir_links}
            onCheckedChange={(checked) => setConfig({ ...config, permitir_links: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="allow-symbols" className="flex flex-col gap-1">
            <span>Permitir Símbolos</span>
            <span className="font-normal text-xs text-muted-foreground">
              Permitir caracteres especiais e emojis
            </span>
          </Label>
          <Switch
            id="allow-symbols"
            checked={config.permitir_simbolos}
            onCheckedChange={(checked) => setConfig({ ...config, permitir_simbolos: checked })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-chars">Máximo de Caracteres</Label>
          <Input
            id="max-chars"
            type="number"
            min="10"
            max="1000"
            value={config.max_caracteres}
            onChange={(e) => setConfig({ ...config, max_caracteres: parseInt(e.target.value) || 500 })}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </CardContent>
    </Card>
  );
}
