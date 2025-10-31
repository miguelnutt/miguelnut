import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase-helper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Shield, ArrowLeft } from "lucide-react";
import { FaTwitch } from "react-icons/fa";
import { useHalloweenTheme } from "@/contexts/HalloweenThemeContext";


export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const { headerProfileImage } = useHalloweenTheme();

  useEffect(() => {
    checkIfAdminExists();
  }, []);

  const checkIfAdminExists = async () => {
    try {
      const { data, error } = await supabase.rpc('has_admin_user');
      if (error) {
        console.error("Error checking admin:", error);
      } else {
        setHasAdmin(data || false);
      }
    } catch (error) {
      console.error("Error checking admin:", error);
    } finally {
      setCheckingAdmin(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if MFA is required
      if (data.user) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        
        if (factors && factors.totp.length > 0) {
          const verifiedFactor = factors.totp.find(f => f.status === "verified");
          if (verifiedFactor) {
            setFactorId(verifiedFactor.id);
            setMfaRequired(true);
            toast.info("Digite o código do seu aplicativo autenticador");
            setLoading(false);
            return;
          }
        }
      }

      toast.success("Login realizado com sucesso!");
      navigate("/");
    } catch (error: any) {
      toast.error("Erro ao fazer login: " + error.message);
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error("Digite um código de 6 dígitos");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factorId,
        code: mfaCode
      });

      if (error) throw error;

      toast.success("Login realizado com sucesso!");
      navigate("/");
    } catch (error: any) {
      toast.error("Código inválido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar novamente se já existe admin
    const { data: adminExists } = await supabase.rpc('has_admin_user');
    if (adminExists) {
      toast.error("Não é mais possível criar novas contas. O sistema já possui um administrador.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error("Erro ao criar conta: " + error.message);
      } else {
        toast.success("Primeira conta admin criada com sucesso! Futuros cadastros estão bloqueados.");
        // Desabilitar signups após primeiro cadastro
        await supabase.rpc('configure_auth_disable_signup');
        navigate("/");
      }
    } catch (error) {
      toast.error("Erro inesperado ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-glow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Verificando sistema...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mfaRequired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-glow">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
              Autenticação de Dois Fatores
            </CardTitle>
            <CardDescription>
              Digite o código de 6 dígitos do seu aplicativo autenticador
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfaCode">Código de Verificação</Label>
                <Input
                  id="mfaCode"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  required
                  className="font-mono text-lg text-center tracking-widest"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMfaRequired(false);
                    setMfaCode("");
                    setFactorId("");
                    supabase.auth.signOut();
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading || mfaCode.length !== 6}
                  className="flex-1 bg-gradient-primary"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Verificar"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="absolute top-4 left-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao site
          </Button>
          
          <img 
            src={headerProfileImage} 
            alt="Profile" 
            className="mx-auto h-20 w-20 rounded-full object-cover"
          />
          
          {!hasAdmin && (
            <CardTitle className="text-2xl mt-4">
              Primeiro Acesso - Criar Conta
            </CardTitle>
          )}
        </CardHeader>
        <CardContent>
          {!hasAdmin ? (
            <>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Este é o primeiro acesso ao sistema. Após criar esta conta, não será mais possível criar novas contas.
                </AlertDescription>
              </Alert>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-primary"
                  disabled={loading}
                >
                  {loading ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-primary"
                  disabled={loading}
                >
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.href = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-auth-exchange`;
                }}
              >
                <FaTwitch className="mr-2 h-5 w-5 text-purple-500" />
                Login com a Twitch
              </Button>

            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
