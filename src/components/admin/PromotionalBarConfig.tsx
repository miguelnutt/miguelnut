import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Crown, Rocket, Loader2 } from 'lucide-react';

export function PromotionalBarConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  
  const [button1Text, setButton1Text] = useState('Crie sua conta no Rubinot');
  const [button1Url, setButton1Url] = useState('https://rubinot.site/miguelnutt');
  const [button2Text, setButton2Text] = useState('Crie seu site com IA grátis');
  const [button2Url, setButton2Url] = useState('https://lovable.dev/invite/RNZUAZW');

  useEffect(() => {
    carregarConfig();
  }, []);

  const carregarConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promotional_bar_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfigId(data.id);
        setButton1Text(data.button1_text);
        setButton1Url(data.button1_url);
        setButton2Text(data.button2_text);
        setButton2Url(data.button2_url);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const salvarConfig = async () => {
    if (!button1Text.trim() || !button1Url.trim() || !button2Text.trim() || !button2Url.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSaving(true);
    try {
      const dados = {
        button1_text: button1Text.trim(),
        button1_url: button1Url.trim(),
        button2_text: button2Text.trim(),
        button2_url: button2Url.trim()
      };

      if (configId) {
        // Atualizar
        const { error } = await supabase
          .from('promotional_bar_config')
          .update(dados)
          .eq('id', configId);

        if (error) throw error;
      } else {
        // Inserir
        const { data, error } = await supabase
          .from('promotional_bar_config')
          .insert(dados)
          .select()
          .single();

        if (error) throw error;
        if (data) setConfigId(data.id);
      }

      toast.success('Configurações salvas! Recarregue a página para ver as alterações.');
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração da Barra Promocional</CardTitle>
        <CardDescription>
          Edite os textos e links dos botões da barra que aparece em todas as páginas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Botão 1 - Rubinot */}
        <div className="space-y-4 p-4 border rounded-lg bg-primary/5">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Crown className="h-5 w-5" />
            Botão 1 (Esquerda)
          </div>
          <div className="space-y-2">
            <Label htmlFor="button1-text">Texto do Botão</Label>
            <Input
              id="button1-text"
              value={button1Text}
              onChange={(e) => setButton1Text(e.target.value)}
              placeholder="Crie sua conta no Rubinot"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="button1-url">Link de Redirecionamento</Label>
            <Input
              id="button1-url"
              value={button1Url}
              onChange={(e) => setButton1Url(e.target.value)}
              placeholder="https://rubinot.site/miguelnutt"
              type="url"
            />
          </div>
        </div>

        {/* Botão 2 - IA */}
        <div className="space-y-4 p-4 border rounded-lg bg-accent/5">
          <div className="flex items-center gap-2 font-semibold text-accent">
            <Rocket className="h-5 w-5" />
            Botão 2 (Direita)
          </div>
          <div className="space-y-2">
            <Label htmlFor="button2-text">Texto do Botão</Label>
            <Input
              id="button2-text"
              value={button2Text}
              onChange={(e) => setButton2Text(e.target.value)}
              placeholder="Crie seu site com IA grátis"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="button2-url">Link de Redirecionamento</Label>
            <Input
              id="button2-url"
              value={button2Url}
              onChange={(e) => setButton2Url(e.target.value)}
              placeholder="https://lovable.dev/invite/RNZUAZW"
              type="url"
            />
          </div>
        </div>

        <Button 
          onClick={salvarConfig} 
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Configurações'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}