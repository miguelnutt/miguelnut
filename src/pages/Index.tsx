import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase-helper";
import { useTwitchStatus } from "@/hooks/useTwitchStatus";
import { useAdmin } from "@/hooks/useAdmin";
import { Loader2, Radio, Youtube, Edit } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

// Vídeo padrão - última live do canal
const DEFAULT_VIDEO_ID = "EeF3UTkCoxY";

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useAdmin(user);
  const { isLive, loading: twitchLoading } = useTwitchStatus();
  const [youtubeVideoId, setYoutubeVideoId] = useState<string>(DEFAULT_VIDEO_ID);
  const [videoStartTime, setVideoStartTime] = useState<number>(0);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [recentRewards, setRecentRewards] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    fetchRecentRewards();
  }, []);

  const fetchRecentRewards = async () => {
    try {
      const { data: spins } = await supabase
        .from("spins")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);

      const { data: raffles } = await supabase
        .from("raffles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);

      const combined = [
        ...(spins || []).map(s => ({ ...s, type: 'spin' })),
        ...(raffles || []).map(r => ({ ...r, type: 'raffle' }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

      setRecentRewards(combined);
    } catch (error) {
      console.error("Error fetching recent rewards:", error);
    }
  };

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
      
      // Se o admin configurou um vídeo, usa ele. Senão usa o padrão
      if (data && data.youtube_video_id) {
        setYoutubeVideoId(data.youtube_video_id);
        setVideoStartTime(data.video_start_time || 0);
      } else {
        setYoutubeVideoId(DEFAULT_VIDEO_ID);
        setVideoStartTime(0);
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      // Em caso de erro, usa o vídeo padrão
      setYoutubeVideoId(DEFAULT_VIDEO_ID);
      setVideoStartTime(0);
    } finally {
      setSettingsLoading(false);
    }
  };

  const extractVideoId = (url: string): { videoId: string; startTime: number } => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/live\/([^&\n?#]+)/,
    ];

    let videoId = url;
    let startTime = 0;

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        videoId = match[1];
        break;
      }
    }

    if (url.length === 11 && !url.includes('/')) {
      videoId = url;
    }

    // Extract timestamp from URL
    const timeMatch = url.match(/[?&]t=(\d+)s?/) || url.match(/[?&]start=(\d+)/);
    if (timeMatch) {
      startTime = parseInt(timeMatch[1]);
    }

    return { videoId, startTime };
  };

  const handleSaveVideo = async () => {
    setSaving(true);
    try {
      const { videoId, startTime } = extractVideoId(newVideoUrl);
      
      if (!videoId) {
        toast.error("URL inválida. Por favor, insira uma URL válida do YouTube.");
        return;
      }

      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("site_settings")
          .update({ 
            youtube_video_id: videoId,
            video_start_time: startTime 
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("site_settings")
          .insert({ 
            youtube_video_id: videoId,
            video_start_time: startTime 
          });

        if (error) throw error;
      }

      setYoutubeVideoId(videoId);
      setVideoStartTime(startTime);
      setDialogOpen(false);
      setNewVideoUrl("");
      toast.success("Vídeo atualizado com sucesso!");
    } catch (error: any) {
      console.error("Error saving video:", error);
      toast.error("Erro ao salvar vídeo: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const loading = twitchLoading || settingsLoading;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-4 md:py-8">
        {/* Recent Rewards Section */}
        {recentRewards.length > 0 && (
          <div className="max-w-5xl mx-auto mb-4">
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Últimas Recompensas</h3>
                  <a href="/dashboard" className="text-sm text-primary hover:underline">
                    Ir para Dashboard →
                  </a>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {recentRewards.map((reward, idx) => (
                    <div key={idx} className="flex-shrink-0 bg-muted rounded-lg px-3 py-2 min-w-[200px]">
                      <div className="text-xs text-muted-foreground">
                        {reward.type === 'spin' ? '🎰 Roleta' : '🎉 Sorteio'}
                      </div>
                      <div className="font-semibold text-sm">
                        {reward.type === 'spin' ? reward.nome_usuario : reward.nome_vencedor}
                      </div>
                      <div className="text-xs text-primary">
                        {reward.type === 'spin' ? `${reward.valor} ${reward.tipo_recompensa}` : `${reward.valor_premio} ${reward.tipo_premio}`}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}


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
              ) : (
                <div className="space-y-4 p-4 md:p-6">
                  {isAdmin && (
                    <div className="flex items-center justify-end mb-2">
                      <Button
                        onClick={() => setDialogOpen(true)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Trocar Vídeo
                      </Button>
                    </div>
                  )}
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=0${videoStartTime > 0 ? `&start=${videoStartTime}` : ''}`}
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
              )}
            </CardContent>
          </Card>
        )}

        {/* Dialog para trocar vídeo */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Trocar Vídeo do YouTube</DialogTitle>
              <DialogDescription>
                Cole a URL da sua última live do YouTube abaixo
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Acesse: <a href="https://www.youtube.com/@MiguelnutTibiano/streams" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">youtube.com/@MiguelnutTibiano/streams</a>
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveVideo} 
                  disabled={saving || !newVideoUrl}
                  className="flex-1"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
                <Button 
                  onClick={() => {
                    setDialogOpen(false);
                    setNewVideoUrl("");
                  }}
                  variant="outline"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
