import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Youtube } from "lucide-react";
import { supabase } from "@/lib/supabase-helper";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

export default function SiteSettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useAdmin(user);
  const [youtubeVideoId, setYoutubeVideoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Carregando...</div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-4 md:py-8">
        <div className="mb-4 md:mb-8">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent" style={{ WebkitTextStroke: '1px rgba(139, 92, 246, 0.3)' }}>
            Configurações do Site
          </h1>
        </div>

        <Card className="shadow-card max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Última Live do YouTube
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
      </main>
    </div>
  );
}
