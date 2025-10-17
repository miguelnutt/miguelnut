import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TwitchCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        throw new Error(`Twitch OAuth error: ${error}`);
      }

      if (!code || !state) {
        throw new Error('Missing code or state parameter');
      }

      // Validar state (CSRF protection)
      const savedState = localStorage.getItem('twitch_state');
      if (state !== savedState) {
        throw new Error('Invalid state parameter');
      }

      // Recuperar code_verifier
      const codeVerifier = localStorage.getItem('twitch_code_verifier');
      if (!codeVerifier) {
        throw new Error('Missing code verifier');
      }

      const redirectUri = `${window.location.origin.replace(/\/$/, '')}/auth/twitch/callback`;

      // Trocar código por token via edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-auth-exchange`,
        {
          method: 'POST',
          credentials: 'include', // IMPORTANTE: Permite receber cookies
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Limpar localStorage
      localStorage.removeItem('twitch_code_verifier');
      localStorage.removeItem('twitch_state');

      toast.success(`Bem-vindo, ${data.user.display_name}!`);
      navigate('/');
    } catch (error: any) {
      console.error('Callback error:', error);
      setError(error.message);
      toast.error('Erro ao fazer login: ' + error.message);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Erro de Autenticação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="text-primary hover:underline"
            >
              Voltar para a página inicial
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Autenticando com Twitch...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
