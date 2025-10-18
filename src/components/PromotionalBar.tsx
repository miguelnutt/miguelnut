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
  const [button1Color, setButton1Color] = useState("#8B5CF6");
  const [button2Text, setButton2Text] = useState("Crie seu site com IA grátis");
  const [button2Url, setButton2Url] = useState("https://lovable.dev/invite/RNZUAZW");
  const [button2Color, setButton2Color] = useState("#3B82F6");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editButton1Text, setEditButton1Text] = useState("");
  const [editButton1Url, setEditButton1Url] = useState("");
  const [editButton1Color, setEditButton1Color] = useState("");
  const [editButton2Text, setEditButton2Text] = useState("");
  const [editButton2Url, setEditButton2Url] = useState("");
  const [editButton2Color, setEditButton2Color] = useState("");
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
        setButton1Color(data.button1_color || "#8B5CF6");
        setButton2Text(data.button2_text);
        setButton2Url(data.button2_url);
        setButton2Color(data.button2_color || "#3B82F6");
      }
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const abrirEdicao = () => {
    setEditButton1Text(button1Text);
    setEditButton1Url(button1Url);
    setEditButton1Color(button1Color);
    setEditButton2Text(button2Text);
    setEditButton2Url(button2Url);
    setEditButton2Color(button2Color);
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
        button1_color: editButton1Color,
        button2_text: editButton2Text.trim(),
        button2_url: editButton2Url.trim(),
        button2_color: editButton2Color
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
      setButton1Color(editButton1Color);
      setButton2Text(editButton2Text);
      setButton2Url(editButton2Url);
      setButton2Color(editButton2Color);
      
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
      <div className="w-full bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 py-3 px-4 shadow-sm rounded-lg">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={button1Url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-300 text-sm font-medium shadow-sm hover:shadow-md hover:scale-[1.02] w-full sm:w-auto justify-center text-white"
            style={{
              backgroundColor: button1Color,
              opacity: 0.9
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
          >
            <Crown className="h-4 w-4" />
            <span>{button1Text}</span>
          </a>
          <a
            href={button2Url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-300 text-sm font-medium shadow-sm hover:shadow-md hover:scale-[1.02] w-full sm:w-auto justify-center text-white"
            style={{
              backgroundColor: button2Color,
              opacity: 0.9
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
          >
            <Rocket className="h-4 w-4" />
            <span>{button2Text}</span>
          </a>
          {isAdmin && (
            <button
              onClick={abrirEdicao}
              className="flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted/70 text-muted-foreground rounded-full transition-all duration-300 text-sm font-medium shadow-sm hover:shadow-md hover:scale-[1.02]"
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
              <div className="space-y-2">
                <Label htmlFor="edit-button1-color">Cor do Botão</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-button1-color"
                    type="color"
                    value={editButton1Color}
                    onChange={(e) => setEditButton1Color(e.target.value)}
                    className="w-20 h-10 cursor-pointer"
                  />
                  <Input
                    value={editButton1Color}
                    onChange={(e) => setEditButton1Color(e.target.value)}
                    placeholder="#8B5CF6"
                    maxLength={7}
                  />
                </div>
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
              <div className="space-y-2">
                <Label htmlFor="edit-button2-color">Cor do Botão</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-button2-color"
                    type="color"
                    value={editButton2Color}
                    onChange={(e) => setEditButton2Color(e.target.value)}
                    className="w-20 h-10 cursor-pointer"
                  />
                  <Input
                    value={editButton2Color}
                    onChange={(e) => setEditButton2Color(e.target.value)}
                    placeholder="#3B82F6"
                    maxLength={7}
                  />
                </div>
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
