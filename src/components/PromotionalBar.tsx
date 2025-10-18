import { Crown, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PromotionalBar = () => {
  return (
    <div className="w-full bg-gradient-to-r from-background via-primary/5 to-background border-y border-border/40 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-center justify-center max-w-3xl mx-auto">
          {/* Botão Rubinot */}
          <a
            href="https://rubinot.site/miguelnutt"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto group"
          >
            <Button
              variant="outline"
              className="w-full md:w-auto h-auto py-3 px-6 rounded-full border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/20 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] hover:border-primary/50"
            >
              <Crown className="h-4 w-4 mr-2 text-primary group-hover:animate-pulse" />
              <span className="font-medium text-sm">Crie sua conta no Rubinot</span>
            </Button>
          </a>

          {/* Botão Site com IA */}
          <a
            href="https://lovable.dev/invite/RNZUAZW"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto group"
          >
            <Button
              variant="outline"
              className="w-full md:w-auto h-auto py-3 px-6 rounded-full border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-purple-500/10 hover:from-purple-500/10 hover:to-purple-500/20 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] hover:border-purple-500/50"
            >
              <Rocket className="h-4 w-4 mr-2 text-purple-500 group-hover:animate-bounce" />
              <span className="font-medium text-sm">Crie seu site com IA grátis</span>
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
};
