import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase-helper";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Shield, ShieldCheck, Copy, CheckCheck, Eye, EyeOff } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { useAdmin } from "@/hooks/useAdmin";
import QRCode from "qrcode";

export default function AccountSettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [totpSecret, setTotpSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const { isAdmin, loading: adminLoading } = useAdmin(user);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }

      setUser(user);
      await checkMfaStatus();
    } catch (error) {
      console.error("Error checking user:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const checkMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const hasTotpFactor = data.totp.some(factor => factor.status === "verified");
      setMfaEnabled(hasTotpFactor);
    } catch (error) {
      console.error("Error checking MFA status:", error);
    }
  };

  const handleEnableMfa = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Autenticador Admin"
      });

      if (error) throw error;

      if (data) {
        setFactorId(data.id);
        setTotpSecret(data.totp.secret);
        
        // Generate QR code
        const qrCodeUrl = data.totp.qr_code;
        setQrCode(qrCodeUrl);
      }
    } catch (error: any) {
      console.error("Error enrolling MFA:", error);
      toast.error("Erro ao configurar 2FA: " + error.message);
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Digite um código de 6 dígitos");
      return;
    }

    setVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factorId,
        code: verificationCode
      });

      if (error) throw error;

      toast.success("Autenticação de dois fatores habilitada com sucesso!");
      setQrCode("");
      setTotpSecret("");
      setVerificationCode("");
      setMfaEnabled(true);
    } catch (error: any) {
      console.error("Error verifying MFA:", error);
      toast.error("Código inválido. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  const handleDisableMfa = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      
      for (const factor of data.totp) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      toast.success("Autenticação de dois fatores desabilitada");
      setMfaEnabled(false);
    } catch (error: any) {
      console.error("Error disabling MFA:", error);
      toast.error("Erro ao desabilitar 2FA: " + error.message);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(totpSecret);
    setCopiedSecret(true);
    toast.success("Código secreto copiado!");
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  if (loading || adminLoading) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Acesso Negado</CardTitle>
              <CardDescription>
                Você precisa ser administrador para acessar esta página.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
        <div className="mb-4 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">Configurações da Conta</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            Gerencie suas preferências de segurança e autenticação
          </p>
        </div>

        <div className="space-y-4 md:space-y-6">
          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Informações da Conta</CardTitle>
              <CardDescription className="text-sm">Seus dados de login</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex gap-2">
                  <Input 
                    value={showEmail ? (user?.email || "") : "••••••••@••••••.com"} 
                    disabled 
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowEmail(!showEmail)}
                    title={showEmail ? "Ocultar email" : "Mostrar email"}
                  >
                    {showEmail ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2FA Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                {mfaEnabled ? (
                  <ShieldCheck className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                ) : (
                  <Shield className="h-4 w-4 md:h-5 md:w-5" />
                )}
                <span className="text-base md:text-xl">Autenticação de Dois Fatores (2FA)</span>
              </CardTitle>
              <CardDescription className="text-sm">
                Adicione uma camada extra de segurança à sua conta usando um aplicativo autenticador como Google Authenticator
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mfaEnabled ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
                    <CheckCheck className="h-4 w-4" />
                    <span className="font-medium">2FA está ativo e protegendo sua conta</span>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={handleDisableMfa}
                  >
                    Desabilitar 2FA
                  </Button>
                </div>
              ) : qrCode ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      1. Escaneie o QR Code com seu aplicativo autenticador:
                    </p>
                    <div className="flex justify-center p-4 bg-white rounded-lg">
                      <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                    </div>
                    
                    <p className="text-sm font-medium mt-4">
                      Ou insira manualmente este código secreto:
                    </p>
                    <div className="flex gap-2">
                      <Input 
                        value={totpSecret} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={copySecret}
                      >
                        {copiedSecret ? (
                          <CheckCheck className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <p className="text-sm font-medium">
                      2. Digite o código de 6 dígitos do seu aplicativo:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="000000"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                        className="font-mono text-lg text-center tracking-widest"
                      />
                      <Button
                        onClick={handleVerifyMfa}
                        disabled={verifying || verificationCode.length !== 6}
                      >
                        {verifying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Verificar"
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setQrCode("");
                      setTotpSecret("");
                      setVerificationCode("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    A autenticação de dois fatores adiciona uma camada extra de segurança, 
                    exigindo um código do seu celular além da senha para fazer login.
                  </p>
                  <Button 
                    onClick={handleEnableMfa}
                    disabled={enrolling}
                  >
                    {enrolling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Configurando...
                      </>
                    ) : (
                      "Habilitar 2FA"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
