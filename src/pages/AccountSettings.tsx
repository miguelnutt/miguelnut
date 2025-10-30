import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase-helper";
import { prepareUsernameForSearch } from "@/lib/username-utils";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Shield, ShieldCheck, Copy, CheckCheck, Eye, EyeOff, Coins, User as UserIcon, RefreshCw, Gift, Clock, AlertCircle, CheckCircle, XCircle, ShoppingCart, Gem, Ticket, BadgeCheck, Link2, Link2Off } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { useTwitchAuth } from "@/hooks/useTwitchAuth";
import { DailyRewardDialog } from "@/components/DailyRewardDialog";
import { PromotionalBar } from "@/components/PromotionalBar";
import { RubiniCoinsResgateDialog } from "@/components/RubiniCoinsResgateDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AccountSettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const { user: twitchUser, loading: twitchLoading } = useTwitchAuth();
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [totpSecret, setTotpSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const { isAdmin, loading: adminLoading } = useAdmin(user);
  const { isAdminMode } = useAdminMode();
  const [nomePersonagem, setNomePersonagem] = useState("");
  const [savingPersonagem, setSavingPersonagem] = useState(false);
  const [pontosStreamElements, setPontosStreamElements] = useState<number | null>(null);
  const [loadingPontos, setLoadingPontos] = useState(false);
  const [editandoPersonagem, setEditandoPersonagem] = useState(false);
  const [personagemSalvo, setPersonagemSalvo] = useState<string | null>(null);
  const [dailyRewardOpen, setDailyRewardOpen] = useState(false);
  const [rubiniCoins, setRubiniCoins] = useState<number>(0);
  const [tickets, setTickets] = useState<number>(0);
  const [loadingSaldos, setLoadingSaldos] = useState(false);
  const [resgateDialogOpen, setResgateDialogOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [resgates, setResgates] = useState<any[]>([]);
  const [loadingResgates, setLoadingResgates] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    // Só carregar quando twitchAuth terminar de carregar E tiver usuário
    if (!twitchLoading && authReady && twitchUser) {
      carregarDadosCompletos();
    }
  }, [twitchUser, twitchLoading, authReady]);

  useEffect(() => {
    if (profileUserId) {
      carregarResgates();
      
      // Listener para atualizar saldos em tempo real
      const ticketsChannel = supabase
        .channel('tickets_balance_updates')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'tickets',
          filter: `user_id=eq.${profileUserId}`
        }, () => {
          console.log('📊 Tickets updated, refreshing...');
          carregarSaldos();
        })
        .subscribe();

      const rcChannel = supabase
        .channel('rc_balance_updates')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'rubini_coins_balance',
          filter: `user_id=eq.${profileUserId}`
        }, () => {
          console.log('📊 Rubini Coins updated, refreshing...');
          carregarSaldos();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(ticketsChannel);
        supabase.removeChannel(rcChannel);
      };
    }
  }, [profileUserId]);

  /**
   * FUNÇÃO UNIFICADA: Carrega TUDO do perfil do usuário
   * - Busca perfil ativo UMA VEZ (prioriza twitch_user_id)
   * - Resolve conflitos de perfis duplicados
   * - Seta profileUserId
   * - Carrega nome do personagem
   * - Carrega saldos
   * - Carrega pontos StreamElements
   */
  const carregarDadosCompletos = async () => {
    if (!twitchUser) return;
    
    console.log('🔄 Carregando dados completos do perfil...');
    setLoadingSaldos(true);
    
    try {
      let profileByTwitchId = null;
      let profileByUsername = null;
      
      // 1. Buscar por twitch_user_id
      if (twitchUser.twitch_user_id) {
        const { data } = await supabase
          .from('profiles')
          .select('id, nome_personagem, twitch_username')
          .eq('twitch_user_id', twitchUser.twitch_user_id)
          .eq('is_active', true)
          .maybeSingle();

        profileByTwitchId = data;
        console.log('Busca por twitch_user_id:', profileByTwitchId ? '✅ Encontrado' : '❌ Não encontrado');
      }
      
      // 2. Buscar por twitch_username
      const searchTerm = prepareUsernameForSearch(twitchUser.login);
      const { data: usernameData, error: usernameError } = await supabase
        .from('profiles')
        .select('id, nome_personagem, twitch_user_id')
        .ilike('twitch_username', searchTerm)
        .eq('is_active', true)
        .maybeSingle();

      if (usernameError) throw usernameError;
      profileByUsername = usernameData;
      console.log('Busca por twitch_username:', profileByUsername ? '✅ Encontrado' : '❌ Não encontrado');

      let finalProfile = null;

      // 3. Resolver conflitos de perfis duplicados
      if (profileByTwitchId && profileByUsername && profileByTwitchId.id !== profileByUsername.id) {
        console.log('⚠️ CONFLITO: Encontrados 2 perfis diferentes para o mesmo usuário!');
        console.log('Perfil por ID:', profileByTwitchId);
        console.log('Perfil por Username:', profileByUsername);
        
        // Priorizar o perfil que tem nome_personagem preenchido
        if (profileByUsername.nome_personagem && !profileByTwitchId.nome_personagem) {
          console.log('🔄 Mesclando: Consolidando perfis duplicados com tickets e saldos');
          
          try {
            // Usar a função RPC para consolidar perfis corretamente (incluindo tickets)
            const { error: mergeError } = await supabase.rpc('merge_duplicate_profiles', {
              p_keep_profile_id: profileByTwitchId.id,
              p_remove_profile_id: profileByUsername.id
            });

            if (mergeError) {
              console.error('❌ Erro na consolidação RPC:', mergeError);
              // Fallback para método manual se RPC falhar
              await supabase
                .from('profiles')
                .update({ 
                  nome_personagem: profileByUsername.nome_personagem,
                  twitch_user_id: twitchUser.twitch_user_id,
                  display_name_canonical: twitchUser.display_name
                })
                .eq('id', profileByTwitchId.id);
              
              await supabase
                .from('profiles')
                .update({ is_active: false })
                .eq('id', profileByUsername.id);
            } else {
              // Atualizar dados do perfil mantido após consolidação
              await supabase
                .from('profiles')
                .update({ 
                  twitch_user_id: twitchUser.twitch_user_id,
                  display_name_canonical: twitchUser.display_name
                })
                .eq('id', profileByTwitchId.id);
            }
            
            finalProfile = { 
              ...profileByTwitchId, 
              nome_personagem: profileByUsername.nome_personagem 
            };
            console.log('✅ Perfis consolidados com sucesso (tickets incluídos)');
          } catch (consolidationError) {
            console.error('❌ Erro na consolidação:', consolidationError);
            // Em caso de erro, usar perfil por ID sem consolidação
            finalProfile = profileByTwitchId;
          }
        } else {
          // Usar perfil por ID e atualizar com twitch_user_id se necessário
          finalProfile = profileByTwitchId;
        }
      } else if (profileByTwitchId) {
        finalProfile = profileByTwitchId;
      } else if (profileByUsername) {
        // Atualizar perfil por username com twitch_user_id
        if (twitchUser.twitch_user_id && !profileByUsername.twitch_user_id) {
          await supabase
            .from('profiles')
            .update({ 
              twitch_user_id: twitchUser.twitch_user_id,
              display_name_canonical: twitchUser.display_name
            })
            .eq('id', profileByUsername.id);
          console.log('✅ Perfil atualizado com twitch_user_id');
        }
        finalProfile = profileByUsername;
      }

      // 4. Se não tem perfil, criar novo
      if (!finalProfile) {
        console.log('Criando novo perfil com twitch_user_id...');
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            nome: twitchUser.display_name,
            twitch_username: twitchUser.login,
            twitch_user_id: twitchUser.twitch_user_id,
            display_name_canonical: twitchUser.display_name,
            is_active: true
          })
          .select('id, nome_personagem')
          .single();

        if (insertError) throw insertError;
        
        console.log('✅ Perfil criado:', newProfile.id);
        finalProfile = newProfile;
      }

      console.log('✅ Perfil final selecionado:', finalProfile.id, 'Nome:', finalProfile.nome_personagem);
      await carregarDadosPerfil(finalProfile);
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados completos:', error);
      toast.error('Erro ao carregar dados do perfil');
    } finally {
      setLoadingSaldos(false);
    }
  };

  /**
   * Carrega todos os dados de um perfil já identificado
   */
  const carregarDadosPerfil = async (profile: { id: string; nome_personagem: string | null }) => {
    // Setar ID do perfil (usado pelos listeners)
    setProfileUserId(profile.id);

    // Nome do personagem
    const personagemAtual = profile.nome_personagem || "";
    console.log('Nome do personagem no DB:', personagemAtual);
    
    if (!editandoPersonagem) {
      setNomePersonagem(personagemAtual);
    }
    
    if (personagemAtual) {
      setPersonagemSalvo(personagemAtual);
      setEditandoPersonagem(false);
    } else {
      setPersonagemSalvo(null);
      if (!personagemSalvo) {
        setEditandoPersonagem(true);
      }
    }

    // Carregar saldos e pontos em paralelo
    await Promise.all([
      carregarSaldos(profile.id),
      fetchStreamElementsPoints()
    ]);
  };

  /**
   * Carrega apenas os saldos (Rubini Coins + Tickets)
   * Pode receber profileId como parâmetro ou usar o state
   */
  const carregarSaldos = async (profileId?: string) => {
    const userId = profileId || profileUserId;
    if (!userId) return;
    
    try {
      // Buscar Rubini Coins
      const { data: rubiniData } = await supabase
        .from('rubini_coins_balance')
        .select('saldo')
        .eq('user_id', userId)
        .maybeSingle();

      setRubiniCoins(rubiniData?.saldo || 0);

      // Buscar Tickets
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('tickets_atual')
        .eq('user_id', userId)
        .maybeSingle();

      const currentTickets = ticketsData?.tickets_atual || 0;
      setTickets(currentTickets);
      
      // VERIFICAÇÃO ADICIONAL: Se não há tickets no perfil ativo, verificar se há tickets em perfis inativos
      if (currentTickets === 0 && twitchUser?.login) {
        console.log('🔍 Verificando tickets em perfis inativos...');
        
        try {
          // Buscar perfis inativos do mesmo usuário que possam ter tickets
          const { data: inactiveProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('twitch_username', prepareUsernameForSearch(twitchUser.login))
            .eq('is_active', false);

          if (inactiveProfiles && inactiveProfiles.length > 0) {
            const inactiveIds = inactiveProfiles.map(p => p.id);
            
            // Verificar se há tickets nesses perfis inativos
            const { data: inactiveTickets } = await supabase
              .from('tickets')
              .select('user_id, tickets_atual')
              .in('user_id', inactiveIds)
              .gt('tickets_atual', 0);

            if (inactiveTickets && inactiveTickets.length > 0) {
              console.log('⚠️ Encontrados tickets em perfis inativos:', inactiveTickets);
              
              // Consolidar automaticamente usando a função RPC
              for (const inactiveTicket of inactiveTickets) {
                try {
                  console.log(`🔄 Consolidando tickets do perfil inativo ${inactiveTicket.user_id} para ${userId}`);
                  
                  const { error: mergeError } = await supabase.rpc('merge_duplicate_profiles', {
                    p_keep_profile_id: userId,
                    p_remove_profile_id: inactiveTicket.user_id
                  });

                  if (mergeError) {
                    console.error('❌ Erro na consolidação automática:', mergeError);
                  } else {
                    console.log('✅ Tickets consolidados automaticamente');
                    
                    // Recarregar tickets após consolidação
                    const { data: updatedTickets } = await supabase
                      .from('tickets')
                      .select('tickets_atual')
                      .eq('user_id', userId)
                      .maybeSingle();
                    
                    const newTicketsCount = updatedTickets?.tickets_atual || 0;
                    setTickets(newTicketsCount);
                    
                    if (newTicketsCount > currentTickets) {
                      toast.success(`🎫 Tickets consolidados! Você agora tem ${newTicketsCount} tickets.`);
                    }
                  }
                } catch (consolidationError) {
                  console.error('❌ Erro na consolidação automática:', consolidationError);
                }
              }
            }
          }
        } catch (verificationError) {
          console.error('❌ Erro na verificação de perfis inativos:', verificationError);
        }
      }
      
      console.log(`💰 Saldos carregados: ${rubiniData?.saldo || 0} RC, ${ticketsData?.tickets_atual || 0} Tickets`);
    } catch (error) {
      console.error('Erro ao carregar saldos:', error);
    }
  };

  /**
   * Handler para botões de refresh (aceita eventos)
   */
  const handleRefreshSaldos = () => {
    carregarSaldos();
  };

  const carregarResgates = async () => {
    if (!profileUserId) return;
    
    setLoadingResgates(true);
    try {
      const { data, error } = await supabase
        .from('rubini_coins_resgates')
        .select('*')
        .eq('user_id', profileUserId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setResgates(data || []);
    } catch (error) {
      console.error('Erro ao carregar resgates:', error);
    } finally {
      setLoadingResgates(false);
    }
  };

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      if (session?.user) {
        await checkMfaStatus();
      }
    } catch (error) {
      console.error("Error checking user:", error);
    } finally {
      setLoading(false);
      setAuthReady(true);
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
    
    const nomeParaValidar = nomePersonagem.trim();
    
    if (!nomeParaValidar) {
      toast.error("Por favor, digite o nome do personagem");
      return;
    }
    
    // Validações adicionais
    if (nomeParaValidar.length < 2) {
      toast.error("O nome do personagem deve ter pelo menos 2 caracteres");
      return;
    }
    
    if (nomeParaValidar.length > 50) {
      toast.error("O nome do personagem deve ter no máximo 50 caracteres");
      return;
    }
    
    // Permitir apenas letras, números, espaços e alguns caracteres especiais comuns
    const nomeValido = /^[a-zA-ZÀ-ÿ0-9\s\-_\.]+$/.test(nomeParaValidar);
    if (!nomeValido) {
      toast.error("O nome do personagem contém caracteres inválidos. Use apenas letras, números, espaços, hífen, underscore ou ponto.");
      return;
    }

    setSavingPersonagem(true);
    try {
      console.log("Salvando personagem via edge function:", nomeParaValidar);
      
      const twitchToken = localStorage.getItem('twitch_token');
      if (!twitchToken) {
        throw new Error('Token da Twitch não encontrado');
      }

      // Chamar edge function que faz a operação com privilégios de admin
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-twitch-character`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${twitchToken}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            nome_personagem: nomeParaValidar
          }),
        }
      );

      const data = await response.json();
      console.log("Resposta da edge function:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar personagem');
      }
      
      // Atualizar estado SEM recarregar
      setPersonagemSalvo(nomeParaValidar);
      setNomePersonagem(nomeParaValidar);
      setEditandoPersonagem(false);
      
      console.log("Personagem salvo com sucesso:", nomeParaValidar);
      toast.success("Nome do personagem salvo!");
    } catch (error: any) {
      console.error("Erro ao salvar personagem:", error);
      
      // Mensagens de erro mais específicas
      let errorMessage = "Erro ao salvar nome do personagem";
      
      if (error.message) {
        if (error.message.includes("JWT")) {
          errorMessage = "Erro de autenticação. Tente fazer login novamente.";
        } else if (error.message.includes("permission") || error.message.includes("RLS")) {
          errorMessage = "Erro de permissão. Tente novamente em alguns instantes.";
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
        } else if (error.message.includes("validation")) {
          errorMessage = "Nome do personagem inválido. Use apenas letras, números e espaços.";
        } else {
          errorMessage = `Erro: ${error.message}`;
        }
      }
      
      toast.error(errorMessage);
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

  if (!twitchUser && !(isAdmin && isAdminMode)) {
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
      <PromotionalBar />
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
        <div className="mb-4 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">Configurações da Conta</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            Gerencie seu perfil e preferências
          </p>
        </div>

        <div className="space-y-4 md:space-y-6">
          {/* Identidade Twitch - Só para usuários Twitch */}
          {twitchUser && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-primary" />
                Identidade Twitch
              </CardTitle>
              <CardDescription className="text-sm">
                Informações de vínculo da sua conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg border bg-card/50">
                  <div className={`p-2 rounded-full ${twitchUser.twitch_user_id ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                    {twitchUser.twitch_user_id ? (
                      <Link2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Link2Off className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status do Vínculo</p>
                      <p className={`text-base font-semibold ${twitchUser.twitch_user_id ? 'text-green-500' : 'text-yellow-500'}`}>
                        {twitchUser.twitch_user_id ? 'Conta Vinculada' : 'Vínculo Parcial'}
                      </p>
                      {!twitchUser.twitch_user_id && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Reconecte-se para completar o vínculo
                        </p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
                      <div>
                        <Label className="text-xs text-muted-foreground">Nome de Exibição</Label>
                        <p className="text-sm font-medium">{twitchUser.display_name}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Login Twitch</Label>
                        <p className="text-sm font-mono font-medium">@{twitchUser.login}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Saldos Consolidados - Só para usuários Twitch */}
          {twitchUser && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl text-center">
                Seus Saldos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="saldos" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="saldos">Saldos</TabsTrigger>
                  <TabsTrigger value="resgates">Resgates de Rubini Coins</TabsTrigger>
                </TabsList>
                
                <TabsContent value="saldos" className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Pontos de Loja */}
                    <div className="flex flex-col items-center justify-between p-6 bg-gradient-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-full">
                          <ShoppingCart className="h-6 w-6 text-blue-500" />
                        </div>
                      </div>
                      <div className="text-center space-y-2 flex-1">
                        <p className="text-sm text-muted-foreground font-medium">Pontos de Loja</p>
                        <p className="text-3xl font-bold text-blue-500">
                          {loadingPontos ? (
                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          ) : (
                            pontosStreamElements?.toLocaleString() || "0"
                          )}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchStreamElementsPoints}
                        disabled={loadingPontos}
                        className="mt-4 w-full"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingPontos ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>

                    {/* Rubini Coins */}
                    <div className="flex flex-col items-center justify-between p-6 bg-gradient-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-500/10 rounded-full">
                          <Gem className="h-6 w-6 text-purple-500" />
                        </div>
                      </div>
                      <div className="text-center space-y-2 flex-1">
                        <p className="text-sm text-muted-foreground font-medium">Rubini Coins</p>
                        <p className="text-3xl font-bold text-purple-500">
                          {loadingSaldos ? (
                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          ) : (
                            rubiniCoins.toLocaleString()
                          )}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshSaldos}
                        disabled={loadingSaldos}
                        className="mt-4 w-full"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingSaldos ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>

                    {/* Tickets */}
                    <div className="flex flex-col items-center justify-between p-6 bg-gradient-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-yellow-500/10 rounded-full">
                          <Ticket className="h-6 w-6 text-yellow-500" />
                        </div>
                      </div>
                      <div className="text-center space-y-2 flex-1">
                        <p className="text-sm text-muted-foreground font-medium">Tickets</p>
                        <p className="text-3xl font-bold text-yellow-500">
                          {loadingSaldos ? (
                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          ) : (
                            tickets.toLocaleString()
                          )}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshSaldos}
                        disabled={loadingSaldos}
                        className="mt-4 w-full"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingSaldos ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button 
                      onClick={() => setDailyRewardOpen(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <Gift className="mr-2 h-4 w-4" />
                      Ver Recompensa Diária
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="resgates" className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">Histórico de Resgates</h3>
                        <p className="text-sm text-muted-foreground">
                          Acompanhe suas solicitações de resgate
                        </p>
                      </div>
                      <Button onClick={() => setResgateDialogOpen(true)}>
                        Novo Resgate
                      </Button>
                    </div>

                    {loadingResgates ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : resgates.length === 0 ? (
                      <div className="text-center py-8 border rounded-lg bg-card/50">
                        <Coins className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum resgate realizado ainda
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {resgates.map((resgate) => (
                          <div 
                            key={resgate.id} 
                            className="border rounded-lg p-4 bg-card/50 hover:bg-card transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {resgate.status === 'PENDENTE' && <Clock className="h-4 w-4 text-yellow-500" />}
                                {resgate.status === 'PROCESSANDO' && <AlertCircle className="h-4 w-4 text-blue-500" />}
                                {resgate.status === 'ENTREGUE' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                {resgate.status === 'RECUSADO' && <XCircle className="h-4 w-4 text-red-500" />}
                                <span className="font-semibold">
                                  {resgate.status === 'PENDENTE' && 'Pendente'}
                                  {resgate.status === 'PROCESSANDO' && 'Processando'}
                                  {resgate.status === 'ENTREGUE' && 'Entregue'}
                                  {resgate.status === 'RECUSADO' && 'Recusado'}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(resgate.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <div className="text-sm space-y-1">
                              <p>
                                <span className="font-bold text-primary">{resgate.quantidade}</span> Rubini Coins
                              </p>
                              {resgate.status === 'RECUSADO' && resgate.motivo_recusa && (
                                <div className="bg-destructive/10 text-destructive rounded p-2 mt-2">
                                  <strong>Motivo:</strong> {resgate.motivo_recusa}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
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
          {isAdmin && isAdminMode && (
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
          {isAdmin && isAdminMode && (
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
        </div>
      </div>

      <DailyRewardDialog open={dailyRewardOpen} onOpenChange={setDailyRewardOpen} />
      
      {resgateDialogOpen && twitchUser && profileUserId && (
        <RubiniCoinsResgateDialog
          open={resgateDialogOpen}
          onOpenChange={setResgateDialogOpen}
          userId={profileUserId}
          saldoAtual={rubiniCoins}
          onResgateSuccess={() => {
            carregarSaldos();
            carregarResgates();
          }}
        />
      )}
    </>
  );
}
