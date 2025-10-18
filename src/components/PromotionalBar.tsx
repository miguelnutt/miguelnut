import { Crown, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

interface BarConfig {
  button1_text: string;
  button1_url: string;
  button2_text: string;
  button2_url: string;
}

export const PromotionalBar = () => {
  const [config, setConfig] = useState<BarConfig>({
    button1_text: 'Crie sua conta no Rubinot',
    button1_url: 'https://rubinot.site/miguelnutt',
    button2_text: 'Crie seu site com IA grátis',
    button2_url: 'https://lovable.dev/invite/RNZUAZW'
  });

  useEffect(() => {
    carregarConfig();
  }, []);

  const carregarConfig = async () => {
    try {
      const { data } = await supabase
        .from('promotional_bar_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data) {
        setConfig({
          button1_text: data.button1_text,
          button1_url: data.button1_url,
          button2_text: data.button2_text,
          button2_url: data.button2_url
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configuração da barra:', error);
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-background via-primary/5 to-background border-y border-border/40 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-center justify-center max-w-3xl mx-auto">
          {/* Botão 1 - Rubinot */}
          <a
            href={config.button1_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto group"
          >
            <Button
              variant="outline"
              className="w-full md:w-auto h-auto py-3 px-6 rounded-full border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/20 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] hover:border-primary/50"
            >
              <Crown className="h-4 w-4 mr-2 text-primary group-hover:animate-pulse" />
              <span className="font-medium text-sm">{config.button1_text}</span>
            </Button>
          </a>

          {/* Botão 2 - Site com IA */}
          <a
            href={config.button2_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto group"
          >
            <Button
              variant="outline"
              className="w-full md:w-auto h-auto py-3 px-6 rounded-full border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-purple-500/10 hover:from-purple-500/10 hover:to-purple-500/20 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] hover:border-purple-500/50"
            >
              <Rocket className="h-4 w-4 mr-2 text-purple-500 group-hover:animate-bounce" />
              <span className="font-medium text-sm">{config.button2_text}</span>
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
};