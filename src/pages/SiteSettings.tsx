import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Youtube } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { DailyRewardTodaySection } from "@/components/admin/DailyRewardTodaySection";
import { StreakRulesSection } from "@/components/admin/StreakRulesSection";
import { DailyRewardSpecialConfigDialog } from "@/components/DailyRewardSpecialConfigDialog";
import { MaintenanceSection } from "@/components/admin/MaintenanceSection";
import { RankingDisplaySection } from "@/components/admin/RankingDisplaySection";
import { ManageDailyRewardsDialog } from "@/components/ManageDailyRewardsDialog";
import { ChatModerationPanel } from "@/components/ChatModerationPanel";
import { PromotionalBar } from "@/components/PromotionalBar";
import { AdminRubiniCoinsResgates } from "@/components/admin/AdminRubiniCoinsResgates";
import { PromotionalBarConfig } from "@/components/admin/PromotionalBarConfig";

export default function SiteSettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useAdmin(user);
  const [youtubeVideoId, setYoutubeVideoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [button1Text, setButton1Text] = useState("Crie sua conta no Rubinot");
  const [button1Url, setButton1Url] = useState("https://rubinot.site/miguelnutt");
  const [button2Text, setButton2Text] = useState("Crie seu site com IA grátis");
  const [button2Url, setButton2Url] = useState("https://lovable.dev/invite/RNZUAZW");
  const [savingBar, setSavingBar] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user && !isAdmin) {
      navigate("/");
    }
  }, [user, isAdmin, navigate]);

  useEffect(() => {
    fetchSettings();
    fetchBarConfig();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setYoutubeVideoId(data.youtube_video_id || "");
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const fetchBarConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("promotional_bar_config")
        .select("*")
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
      console.error("Error fetching bar config:", error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Buscar o ID da configuração existente
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Atualizar
        const { error } = await supabase
          .from("site_settings")
          .update({ youtube_video_id: youtubeVideoId })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Inserir
        const { error } = await supabase
          .from("site_settings")
          .insert({ youtube_video_id: youtubeVideoId });

        if (error) throw error;
      }

      toast.success("Configurações salvas com sucesso!");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const saveBarConfig = async () => {
    setSavingBar(true);
    try {
      const { data: existing } = await supabase
        .from("promotional_bar_config")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("promotional_bar_config")
          .update({
            button1_text: button1Text,
            button1_url: button1Url,
            button2_text: button2Text,
            button2_url: button2Url
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("promotional_bar_config")
          .insert({
            button1_text: button1Text,
            button1_url: button1Url,
            button2_text: button2Text,
            button2_url: button2Url
          });

        if (error) throw error;
      }

      toast.success("Barra promocional atualizada!");
      window.location.reload(); // Recarregar para atualizar a barra
    } catch (error: any) {
      console.error("Error saving bar config:", error);
      toast.error("Erro ao salvar barra: " + error.message);
    } finally {
      setSavingBar(false);
    }
  };

  const extractVideoId = (url: string) => {
    // Extrair ID do vídeo de diferentes formatos de URL do YouTube
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/live\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Se já for apenas o ID
    if (url.length === 11 && !url.includes('/')) {
      return url;
    }

    return url;
  };

  const handleYoutubeUrlChange = (value: string) => {
    const videoId = extractVideoId(value);
    setYoutubeVideoId(videoId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <PromotionalBar />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Carregando...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PromotionalBar />
      
      <main className="container mx-auto px-4 py-4 md:py-8">
        <div className="mb-4 md:mb-8">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent" style={{ WebkitTextStroke: '1px rgba(139, 92, 246, 0.3)' }}>
            Configurações do Site
          </h1>
        </div>

        <div className="grid gap-6 max-w-2xl">
          {/* Seção 1: Configurações da Barra Promocional */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="h-5 w-5" />
                Barra Promocional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <h3 className="font-semibold">Botão 1 (Primário - com ícone de coroa)</h3>
                <div className="space-y-2">
                  <Label htmlFor="button1-text">Texto do Botão 1</Label>
                  <Input
                    id="button1-text"
                    placeholder="Crie sua conta no Rubinot"
                    value={button1Text}
                    onChange={(e) => setButton1Text(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="button1-url">Link do Botão 1</Label>
                  <Input
                    id="button1-url"
                    placeholder="https://rubinot.site/miguelnutt"
                    value={button1Url}
                    onChange={(e) => setButton1Url(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Botão 2 (Secundário - com ícone de foguete)</h3>
                <div className="space-y-2">
                  <Label htmlFor="button2-text">Texto do Botão 2</Label>
                  <Input
                    id="button2-text"
                    placeholder="Crie seu site com IA grátis"
                    value={button2Text}
                    onChange={(e) => setButton2Text(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="button2-url">Link do Botão 2</Label>
                  <Input
                    id="button2-url"
                    placeholder="https://lovable.dev/invite/RNZUAZW"
                    value={button2Url}
                    onChange={(e) => setButton2Url(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={saveBarConfig} disabled={savingBar} className="w-full">
                {savingBar ? "Salvando..." : "Salvar Barra Promocional"}
              </Button>
            </CardContent>
          </Card>

          {/* Seção 2: Configurações do YouTube */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="h-5 w-5" />
                Última Live do YouTube
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm p-3 bg-primary/10 text-primary rounded-lg mb-4">
                💡 <strong>Vídeo Padrão Atual:</strong> Já existe um vídeo configurado. Você pode trocar abaixo se quiser mostrar outra live.
              </div>
              
              <div>
                <Label htmlFor="youtube">URL ou ID da Última Live do YouTube</Label>
                <Input
                  id="youtube"
                  placeholder="https://www.youtube.com/watch?v=... ou ID da live"
                  value={youtubeVideoId}
                  onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Cole a URL da sua última live no YouTube ou apenas o ID (11 caracteres)
                </p>
              </div>

              {youtubeVideoId && (
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                    title="Preview da live do YouTube"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={saveSettings} 
                  disabled={saving}
                  className="bg-gradient-primary shadow-glow"
                >
                  {saving ? "Salvando..." : "Salvar Configurações"}
                </Button>
                <Button 
                  onClick={() => navigate("/")}
                  variant="outline"
                >
                  Voltar
                </Button>
              </div>

              <div className="text-sm text-muted-foreground mt-4 p-4 bg-muted rounded-lg">
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <Youtube className="h-4 w-4" />
                  Como funciona:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Vá para a página de Lives do YouTube: <a href="https://www.youtube.com/@MiguelnutTibiano/streams" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">youtube.com/@MiguelnutTibiano/streams</a></li>
                  <li>Clique na sua última live transmitida</li>
                  <li>Copie a URL da live e cole aqui</li>
                  <li>Se sua live da Twitch estiver online, ela será exibida automaticamente</li>
                  <li>Caso contrário, a última live do YouTube configurada aqui será mostrada</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Seção 1: Recompensa Diária (hoje) */}
          <DailyRewardTodaySection />

          {/* Seção 2: Sequência (Streak) — Regras */}
          <StreakRulesSection />

          {/* Seção 3: Recompensas Especiais por Dia da Sequência */}
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <Button 
                onClick={() => setShowSpecialDialog(true)}
                className="w-full bg-gradient-primary shadow-glow"
              >
                Gerenciar Recompensas Especiais da Sequência
              </Button>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Configure prêmios específicos para dias da sequência
              </p>
            </CardContent>
          </Card>

          {/* Seção 4: Moderação do Chat */}
          <ChatModerationPanel />

          {/* Seção 5: Manutenção e Auditoria */}
          <MaintenanceSection />

          {/* Seção 5: Rankings e Exibição */}
          <RankingDisplaySection />

          {/* Seção 6: Resgates de Rubini Coins */}
          <AdminRubiniCoinsResgates />

          {/* Seção 7: Configuração da Barra Promocional */}
          <PromotionalBarConfig />

          {/* Gerenciar Progresso dos Usuários */}
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <Button 
                onClick={() => setManageDialogOpen(true)}
                variant="outline"
                className="w-full"
              >
                Gerenciar Progresso dos Usuários
              </Button>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Visualizar e resetar sequências de usuários
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Dialogs de Gerenciamento */}
      <DailyRewardSpecialConfigDialog 
        open={showSpecialDialog} 
        onOpenChange={setShowSpecialDialog}
      />
      <ManageDailyRewardsDialog 
        open={manageDialogOpen} 
        onOpenChange={setManageDialogOpen}
      />
    </div>
  );
}
