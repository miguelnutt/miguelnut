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
    console.log('🎯 NOVO BOTÃO - Botão clicado!');
    console.log('📦 Versão: 2.0');
    
    try {
      setLoading(true);
      console.log('⏳ Loading ativado');

      // PKCE
      const codeVerifier = generateCodeVerifier();
      console.log('✅ Code verifier gerado:', codeVerifier.substring(0, 20) + '...');
      
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      console.log('✅ Code challenge gerado:', codeChallenge.substring(0, 20) + '...');
      
      // State para CSRF
      const state = Math.random().toString(36).substring(7);
      console.log('✅ State gerado:', state);
      
      // Salvar no sessionStorage
      sessionStorage.setItem('twitch_code_verifier', codeVerifier);
      sessionStorage.setItem('twitch_state', state);
      console.log('✅ Salvou no sessionStorage');

      const TWITCH_CLIENT_ID = "gvbk9smrzjp6wrdq5hzhyf9xhk1k43";
      const redirectUri = `${window.location.origin}/auth/twitch/callback`;

      console.log('🔐 Iniciando login Twitch...');
      console.log('📍 Redirect URI:', redirectUri);
      console.log('🔑 Client ID:', TWITCH_CLIENT_ID);
      console.log('🌐 Origin:', window.location.origin);

      // Redirecionar para Twitch OAuth
      const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
      authUrl.searchParams.set('client_id', TWITCH_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'user:read:email');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      const finalUrl = authUrl.toString();
      console.log('🌐 URL COMPLETA:', finalUrl);
      console.log('🚀 Redirecionando em 2 segundos...');

      // Aguardar um pouco para ver os logs
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('🚀 REDIRECIONANDO AGORA!');
      window.location.href = finalUrl;
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
