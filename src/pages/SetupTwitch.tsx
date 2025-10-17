import { useState } from "react";
import { supabase } from "@/lib/supabase-helper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { FaTwitch } from "react-icons/fa";

export default function SetupTwitch() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enableTwitchAuth = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('enable-twitch-auth');
      
      if (functionError) throw functionError;
      
      if (data.success) {
        setSuccess(true);
        toast.success("Twitch OAuth configurado com sucesso!");
      } else {
        throw new Error(data.error || "Erro desconhecido");
      }
    } catch (err: any) {
      console.error("Error enabling Twitch:", err);
      setError(err.message);
      toast.error("Erro ao configurar Twitch: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
            <FaTwitch className="h-10 w-10 text-white" />
          </div>
          <CardTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
            Configurar Login com Twitch
          </CardTitle>
          <CardDescription>
            Ative o login via Twitch automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!success && !error && (
            <>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>✅ Client ID da Twitch: Configurado</p>
                <p>✅ Client Secret da Twitch: Configurado</p>
                <p className="pt-2 text-xs">
                  Clique no botão abaixo para ativar o provider Twitch automaticamente.
                </p>
              </div>
              
              <Button
                onClick={enableTwitchAuth}
                disabled={loading}
                className="w-full bg-gradient-primary"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <FaTwitch className="mr-2 h-5 w-5" />
                    Ativar Login com Twitch
                  </>
                )}
              </Button>
            </>
          )}

          {success && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">
                  Twitch OAuth Ativado!
                </p>
                <p className="text-sm text-muted-foreground">
                  O login via Twitch já está funcionando. Você pode testar na página de login.
                </p>
              </div>
              <Button
                onClick={() => window.location.href = "/login"}
                className="w-full bg-gradient-primary"
              >
                Ir para Login
              </Button>
            </div>
          )}

          {error && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <XCircle className="h-16 w-16 text-destructive" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">
                  Erro na Configuração
                </p>
                <p className="text-sm text-muted-foreground break-words">
                  {error}
                </p>
              </div>
              <Button
                onClick={() => {
                  setError(null);
                  setSuccess(false);
                }}
                variant="outline"
                className="w-full"
              >
                Tentar Novamente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
