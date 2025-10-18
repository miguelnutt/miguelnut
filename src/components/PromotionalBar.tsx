import { Crown, Rocket, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

export function PromotionalBar() {
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useAdmin(user);
  const [button1Text, setButton1Text] = useState("Crie sua conta no Rubinot");
  const [button1Url, setButton1Url] = useState("https://rubinot.site/miguelnutt");
  const [button2Text, setButton2Text] = useState("Crie seu site com IA grátis");
  const [button2Url, setButton2Url] = useState("https://lovable.dev/invite/RNZUAZW");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editButton1Text, setEditButton1Text] = useState("");
  const [editButton1Url, setEditButton1Url] = useState("");
  const [editButton2Text, setEditButton2Text] = useState("");
  const [editButton2Url, setEditButton2Url] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    carregarConfig();
  }, []);

  const carregarConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('promotional_bar_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setButton1Text(data.button1_text);
        setButton1Url(data.button1_url);
        setButton2Text(data.button2_text);
        setButton2Url(data.button2_url);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const abrirEdicao = () => {
    setEditButton1Text(button1Text);
    setEditButton1Url(button1Url);
    setEditButton2Text(button2Text);
    setEditButton2Url(button2Url);
    setEditDialogOpen(true);
  };

  const salvarConfig = async () => {
    if (!editButton1Text.trim() || !editButton1Url.trim() || !editButton2Text.trim() || !editButton2Url.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('promotional_bar_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      const dados = {
        button1_text: editButton1Text.trim(),
        button1_url: editButton1Url.trim(),
        button2_text: editButton2Text.trim(),
        button2_url: editButton2Url.trim()
      };

      if (existing) {
        const { error } = await supabase
          .from('promotional_bar_config')
          .update(dados)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('promotional_bar_config')
          .insert(dados);

        if (error) throw error;
      }

      setButton1Text(editButton1Text);
      setButton1Url(editButton1Url);
      setButton2Text(editButton2Text);
      setButton2Url(editButton2Url);
      
      toast.success('Barra atualizada com sucesso!');
      setEditDialogOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="w-full bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 py-2 px-4">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <a
            href={button1Url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-2 bg-white/80 backdrop-blur-sm border border-primary/20 hover:border-primary/40 text-foreground rounded-full transition-all duration-300 text-sm font-medium shadow-sm hover:shadow-md"
          >
            <Crown className="h-4 w-4 text-primary" />
            {button1Text}
          </a>
          <a
            href={button2Url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-2 bg-white/80 backdrop-blur-sm border border-accent/20 hover:border-accent/40 text-foreground rounded-full transition-all duration-300 text-sm font-medium shadow-sm hover:shadow-md"
          >
            <Rocket className="h-4 w-4 text-accent" />
            {button2Text}
          </a>
          {isAdmin && (
            <button
              onClick={abrirEdicao}
              className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm border border-muted-foreground/20 hover:border-muted-foreground/40 text-muted-foreground rounded-full transition-all duration-300 text-sm font-medium shadow-sm hover:shadow-md"
              title="Editar barra promocional"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Barra Promocional</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-4 p-4 border rounded-lg bg-primary/5">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Crown className="h-5 w-5" />
                Botão 1 (Esquerda)
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-button1-text">Texto do Botão</Label>
                <Input
                  id="edit-button1-text"
                  value={editButton1Text}
                  onChange={(e) => setEditButton1Text(e.target.value)}
                  placeholder="Crie sua conta no Rubinot"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-button1-url">Link de Redirecionamento</Label>
                <Input
                  id="edit-button1-url"
                  value={editButton1Url}
                  onChange={(e) => setEditButton1Url(e.target.value)}
                  placeholder="https://rubinot.site/miguelnutt"
                  type="url"
                />
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-accent/5">
              <div className="flex items-center gap-2 font-semibold text-accent">
                <Rocket className="h-5 w-5" />
                Botão 2 (Direita)
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-button2-text">Texto do Botão</Label>
                <Input
                  id="edit-button2-text"
                  value={editButton2Text}
                  onChange={(e) => setEditButton2Text(e.target.value)}
                  placeholder="Crie seu site com IA grátis"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-button2-url">Link de Redirecionamento</Label>
                <Input
                  id="edit-button2-url"
                  value={editButton2Url}
                  onChange={(e) => setEditButton2Url(e.target.value)}
                  placeholder="https://lovable.dev/invite/RNZUAZW"
                  type="url"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={salvarConfig} disabled={saving} className="flex-1">
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button onClick={() => setEditDialogOpen(false)} variant="outline">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
