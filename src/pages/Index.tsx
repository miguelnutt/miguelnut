import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { useTwitchStatus } from "@/hooks/useTwitchStatus";
import { Loader2, Radio, Youtube } from "lucide-react";

export default function Index() {
  const { isLive, loading: twitchLoading } = useTwitchStatus();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-4 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent text-center" style={{ WebkitTextStroke: '1px rgba(139, 92, 246, 0.3)' }}>
            Bem-vindo!
          </h1>
        </div>

        {twitchLoading ? (
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
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Youtube className="h-5 w-5" />
                    <span className="font-semibold">📺 Canal do YouTube</span>
                  </div>
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <iframe
                      width="100%"
                      height="100%"
                      src="https://www.youtube.com/embed?listType=user_uploads&list=miguelnutt"
                      title="Canal do YouTube - Miguelnutt"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="text-center">
                    <a 
                      href="https://www.youtube.com/@miguelnutt" 
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
      </main>
    </div>
  );
}
