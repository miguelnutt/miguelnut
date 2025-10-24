import { AlertCircle } from "lucide-react";

export const BetaBanner = () => {
  return (
    <div className="w-full bg-destructive/90 py-2 px-4 shadow-sm">
      <div className="container mx-auto flex items-center justify-center gap-2">
        <AlertCircle className="h-4 w-4 text-destructive-foreground shrink-0" />
        <p className="text-sm font-medium text-destructive-foreground text-center">
          Site em fase BETA, aguarde uma versão otimizada em BREVE!
        </p>
      </div>
    </div>
  );
};
