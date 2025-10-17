import { Button } from "@/components/ui/button";
import { FaTwitch } from "react-icons/fa";
import { useState } from "react";
import { toast } from "sonner";

// Função para gerar code_verifier e code_challenge (PKCE)
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function TwitchLoginButton() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);

      // Buscar Client ID dos secrets
      const configResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-config`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!configResponse.ok) {
        throw new Error('Failed to get Twitch configuration');
      }

      const { client_id } = await configResponse.json();

      // PKCE
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      
      // State para CSRF
      const state = Math.random().toString(36).substring(7);
      
      // Salvar no sessionStorage
      sessionStorage.setItem('twitch_code_verifier', codeVerifier);
      sessionStorage.setItem('twitch_state', state);

      const origin = window.location.origin.replace('http://', 'https://');
      const redirectUri = `${origin}/auth/twitch/callback`;

      // Redirecionar para Twitch OAuth
      const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
      authUrl.searchParams.set('client_id', client_id);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'user:read:email');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('❌ Erro no login:', error);
      toast.error('Erro ao iniciar login com Twitch');
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleLogin}
      disabled={loading}
      variant="outline"
      className="w-full gap-2"
    >
      <FaTwitch className="h-5 w-5" style={{ color: '#9146FF' }} />
      {loading ? '🔄 Conectando...' : '🎮 Login com Twitch (v2)'}
    </Button>
  );
}
