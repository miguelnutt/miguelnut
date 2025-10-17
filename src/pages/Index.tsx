import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase-helper";
import { useTwitchStatus } from "@/hooks/useTwitchStatus";
import { Loader2, Radio, Youtube } from "lucide-react";

export default function Index() {
  const { isLive, loading: twitchLoading } = useTwitchStatus();
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    fetchSettings();

    // Realtime para atualizar quando admin mudar o vídeo
    const channel = supabase
      .channel("site_settings_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, () => fetchSettings())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        setYoutubeVideoId(data.youtube_video_id);
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const loading = twitchLoading || settingsLoading;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-4 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent text-center" style={{ WebkitTextStroke: '1px rgba(139, 92, 246, 0.3)' }}>
            Bem-vindo!
          </h1>
        </div>

        {loading ? (
          <Card className="shadow-card max-w-5xl mx-auto">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card max-w-5xl mx-auto">
            <CardContent className="p-0">
              {isLive ? (
                <div className="space-y-4 p-4 md:p-6">
                  <div className="flex items-center gap-2 text-primary">
                    <Radio className="h-5 w-5 animate-pulse" />
                    <span className="font-semibold">🔴 AO VIVO NA TWITCH</span>
                  </div>
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <iframe
                      src="https://player.twitch.tv/?channel=miguelnutt&parent=localhost&parent=lovable.app&parent=lovableproject.com&autoplay=true&muted=false"
                      height="100%"
                      width="100%"
                      allowFullScreen
                      title="Twitch Live Stream"
                    />
                  </div>
                </div>
              ) : youtubeVideoId ? (
                <div className="space-y-4 p-4 md:p-6">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Youtube className="h-5 w-5" />
                    <span className="font-semibold">📺 Última Live no YouTube</span>
                  </div>
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                      title="Última Live do YouTube"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="text-center">
                    <a 
                      href="https://www.youtube.com/@MiguelnutTibiano" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Visite o canal completo no YouTube →
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-8 md:p-12 text-center text-muted-foreground">
                  <p className="text-lg">Nenhum conteúdo disponível no momento</p>
                  <p className="text-sm mt-2">O admin ainda não configurou a última live do YouTube</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
