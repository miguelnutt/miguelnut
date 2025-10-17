import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase-helper";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Shield, ShieldCheck, Copy, CheckCheck, Eye, EyeOff, Coins, User as UserIcon, RefreshCw, Gift } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { useAdmin } from "@/hooks/useAdmin";
import QRCode from "qrcode";
import { useTwitchAuth } from "@/hooks/useTwitchAuth";
import { DailyRewardConfigDialog } from "@/components/DailyRewardConfigDialog";
import { DailyRewardDialog } from "@/components/DailyRewardDialog";
import { ManageDailyRewardsDialog } from "@/components/ManageDailyRewardsDialog";
import { ManagePointsDialog } from "@/components/ManagePointsDialog";

export default function AccountSettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const { user: twitchUser, loading: twitchLoading } = useTwitchAuth();
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
  const [nomePersonagem, setNomePersonagem] = useState("");
  const [savingPersonagem, setSavingPersonagem] = useState(false);
  const [pontosStreamElements, setPontosStreamElements] = useState<number | null>(null);
  const [loadingPontos, setLoadingPontos] = useState(false);
  const [editandoPersonagem, setEditandoPersonagem] = useState(false);
  const [personagemSalvo, setPersonagemSalvo] = useState<string | null>(null);
  const [dailyRewardConfigOpen, setDailyRewardConfigOpen] = useState(false);
  const [dailyRewardOpen, setDailyRewardOpen] = useState(false);
  const [manageRewardsOpen, setManageRewardsOpen] = useState(false);
  const [managePointsOpen, setManagePointsOpen] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (twitchUser) {
      loadTwitchUserProfile();
    }
  }, [twitchUser]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        await checkMfaStatus();
      }
    } catch (error) {
      console.error("Error checking user:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTwitchUserProfile = async () => {
    if (!twitchUser) return;
    
    console.log("Carregando perfil Twitch...");
    
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome_personagem')
        .eq('twitch_username', twitchUser.login);

      console.log("Perfis carregados:", profiles);

      let profile = profiles && profiles.length > 0 ? profiles[0] : null;

      // Se não tem perfil, criar
      if (!profile) {
        console.log("Criando perfil inicial...");
        const { data: newProfiles } = await supabase
          .from('profiles')
          .insert({
            nome: twitchUser.display_name,
            twitch_username: twitchUser.login,
          })
          .select('id, nome_personagem');

        profile = newProfiles && newProfiles.length > 0 ? newProfiles[0] : null;
        console.log("Perfil criado:", profile);
      }

      // Atualizar estado com o que está salvo
      if (profile) {
        const personagemAtual = profile.nome_personagem || "";
        console.log("Personagem atual no DB:", personagemAtual);
        
        // Só atualizar se não estiver editando
        if (!editandoPersonagem) {
          setNomePersonagem(personagemAtual);
        }
        
        if (personagemAtual) {
          setPersonagemSalvo(personagemAtual);
          setEditandoPersonagem(false);
        } else {
          setPersonagemSalvo(null);
          // Só colocar em modo de edição se realmente não tem personagem
          if (!personagemSalvo) {
            setEditandoPersonagem(true);
          }
        }
      }
      
      await fetchStreamElementsPoints();
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
    }
  };

  const fetchStreamElementsPoints = async () => {
    if (!twitchUser) return;
    
    setLoadingPontos(true);
    try {
      const token = localStorage.getItem('twitch_token');
      if (!token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loyalty-balance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const data = await response.json();

      if (data.balance !== undefined) {
        setPontosStreamElements(data.balance);
      }
    } catch (error) {
      console.error("Error fetching points:", error);
      setPontosStreamElements(null);
    } finally {
      setLoadingPontos(false);
    }
  };

  const handleSavePersonagem = async () => {
    if (!twitchUser) {
      toast.error("Você precisa estar logado com a Twitch");
      return;
    }
    
    if (!nomePersonagem.trim()) {
      toast.error("Por favor, digite o nome do personagem");
      return;
    }

    setSavingPersonagem(true);
    try {
      console.log("Salvando personagem:", nomePersonagem.trim());
      
      // Buscar perfil
      const { data: profiles, error: fetchError } = await supabase
        .from('profiles')
        .select('id, nome_personagem')
        .eq('twitch_username', twitchUser.login);

      if (fetchError) throw fetchError;

      console.log("Perfis encontrados:", profiles);

      if (!profiles || profiles.length === 0) {
        // Criar perfil
        console.log("Criando novo perfil");
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            nome: twitchUser.display_name,
            twitch_username: twitchUser.login,
            nome_personagem: nomePersonagem.trim()
          });
        
        if (insertError) throw insertError;
      } else {
        // Atualizar perfil
        console.log("Atualizando perfil existente");
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ nome_personagem: nomePersonagem.trim() })
          .eq('id', profiles[0].id);
        
        if (updateError) throw updateError;
      }
      
      // Atualizar estado SEM recarregar
      const nomeParaSalvar = nomePersonagem.trim();
      setPersonagemSalvo(nomeParaSalvar);
      setNomePersonagem(nomeParaSalvar);
      setEditandoPersonagem(false);
      
      console.log("Personagem salvo com sucesso:", nomeParaSalvar);
      toast.success("Nome do personagem salvo!");
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSavingPersonagem(false);
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

  if (loading || adminLoading || twitchLoading) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </>
    );
  }

  if (!twitchUser && !isAdmin) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Acesso Negado</CardTitle>
              <CardDescription>
                Você precisa estar logado com a Twitch ou ser administrador para acessar as configurações da conta
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
            Gerencie seu perfil e preferências
          </p>
        </div>

        <div className="space-y-4 md:space-y-6">
          {/* Pontos StreamElements - Só para usuários Twitch */}
          {twitchUser && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Coins className="h-5 w-5 text-yellow-500" />
                Pontos do Canal
              </CardTitle>
              <CardDescription className="text-sm">
                Seus pontos do StreamElements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-gradient-card rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Atual</p>
                  <p className="text-3xl font-bold text-yellow-500">
                    {loadingPontos ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      pontosStreamElements?.toLocaleString() || "0"
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchStreamElementsPoints}
                  disabled={loadingPontos}
                  title="Atualizar saldo"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingPontos ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="mt-4">
                <Button 
                  onClick={() => setDailyRewardOpen(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Gift className="mr-2 h-4 w-4" />
                  Ver Recompensa Diária
                </Button>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Nome do Personagem - Só para usuários Twitch */}
          {twitchUser && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <UserIcon className="h-5 w-5" />
                Nome do Personagem
              </CardTitle>
              <CardDescription className="text-sm">
                Cadastre o nome do seu personagem no jogo para receber Rubini Coins mais rápido
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="twitch-user">Usuário Twitch</Label>
                  <Input
                    id="twitch-user"
                    value={twitchUser.login}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome-personagem">Nome do Personagem no RubinOT</Label>
                  <Input
                    id="nome-personagem"
                    value={nomePersonagem}
                    onChange={(e) => setNomePersonagem(e.target.value)}
                    placeholder="Digite o nome do seu personagem"
                    maxLength={50}
                    disabled={!editandoPersonagem}
                    className={!editandoPersonagem ? "bg-muted" : ""}
                  />
                </div>
                {editandoPersonagem ? (
                  <div className="flex gap-2">
                    {personagemSalvo && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setNomePersonagem(personagemSalvo);
                          setEditandoPersonagem(false);
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                    <Button
                      onClick={handleSavePersonagem}
                      disabled={savingPersonagem || !nomePersonagem.trim()}
                      className="flex-1"
                    >
                      {savingPersonagem ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar Nome"
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setEditandoPersonagem(true)}
                  >
                    Alterar Nome do Personagem
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          )}
          {/* Account Info - Apenas para admin */}
          {isAdmin && (
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
          )}

          {/* 2FA Settings - Apenas para admin */}
          {isAdmin && (
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
          )}

          {/* Configuração de Recompensa Diária - Apenas Admin */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <Gift className="h-5 w-5" />
                  Recompensas Diárias
                </CardTitle>
                <CardDescription className="text-sm">
                  Configure as recompensas de login diário para usuários da Twitch
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => setDailyRewardConfigOpen(true)}>
                    Configurar Recompensas
                  </Button>
                  <Button variant="outline" onClick={() => setManageRewardsOpen(true)}>
                    Gerenciar Recompensas de Usuários
                  </Button>
                  <Button variant="outline" onClick={() => setManagePointsOpen(true)}>
                    Adicionar/Remover Pontos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <DailyRewardConfigDialog open={dailyRewardConfigOpen} onOpenChange={setDailyRewardConfigOpen} />
      <DailyRewardDialog open={dailyRewardOpen} onOpenChange={setDailyRewardOpen} />
      <ManageDailyRewardsDialog open={manageRewardsOpen} onOpenChange={setManageRewardsOpen} />
      <ManagePointsDialog open={managePointsOpen} onOpenChange={setManagePointsOpen} />
    </>
  );
}
