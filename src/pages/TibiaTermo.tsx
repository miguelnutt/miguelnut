import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Settings, Trash2, Plus } from "lucide-react";
import { useTwitchAuth } from "@/hooks/useTwitchAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { WheelRanking } from "@/components/WheelRanking";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const TibiaTermo = () => {
  const navigate = useNavigate();
  const { user: twitchUser, loading: twitchLoading } = useTwitchAuth();
  const { authReady } = useAuth();
  const [user, setUser] = useState<any>(null);
  const { isAdmin, loading: adminLoading } = useAdmin(user);
  const [gameData, setGameData] = useState<any>(null);
  const [currentGuess, setCurrentGuess] = useState("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingGame, setLoadingGame] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const isLoadingGameRef = useRef(false);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Admin states
  const [words, setWords] = useState<any[]>([]);
  const [newWord, setNewWord] = useState("");
  const [bulkWords, setBulkWords] = useState("");
  const [adding, setAdding] = useState(false);
  const [rewardsConfig, setRewardsConfig] = useState({
    pontos_acerto: 25,
    tickets_bonus: 1,
    max_tentativas_bonus: 4,
  });
  const [savingRewards, setSavingRewards] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    // Limpar timeout anterior
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }

    // Só proceder se auth estiver pronto
    if (!authReady || twitchLoading || adminLoading) {
      console.log('[TibiaTermo] Aguardando auth...', { authReady, twitchLoading, adminLoading });
      return;
    }

    // Admin sempre pode acessar (se tiver Twitch)
    if (isAdmin && twitchUser) {
      loadTimeoutRef.current = setTimeout(() => {
        loadGame();
      }, 300);
      return;
    }
    
    // Não-admin precisa de login Twitch
    if (!twitchUser) {
      toast.error("Você precisa estar logado com a Twitch para jogar!");
      navigate("/login");
      return;
    }

    // Carregar jogo com debounce
    loadTimeoutRef.current = setTimeout(() => {
      loadGame();
    }, 300);

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [authReady, twitchUser, twitchLoading, isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin && showAdmin) {
      loadWords();
      loadRewardsConfig();
    }
  }, [isAdmin, showAdmin]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const loadGame = async () => {
    if (!twitchUser) {
      console.log('[TibiaTermo] loadGame: sem twitch user');
      return;
    }

    // Single-flight: evitar múltiplas chamadas
    if (isLoadingGameRef.current) {
      console.log('[TibiaTermo] loadGame: já está carregando, ignorando...');
      return;
    }
    
    isLoadingGameRef.current = true;
    setLoadingGame(true);
    
    console.log('[TibiaTermo] Buscando palavra do dia...');
    
    try {
      const twitchToken = localStorage.getItem('twitch_token');
      if (!twitchToken) {
        toast.error("Token da Twitch não encontrado. Faça login novamente.");
        navigate("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-tibiatermo-word', {
        headers: {
          Authorization: `Bearer ${twitchToken}`,
        },
      });

      if (error) {
        console.error('[TibiaTermo] Erro ao buscar palavra:', error);
        throw error;
      }

      console.log('[TibiaTermo] Palavra carregada:', { 
        palavra_length: data.palavra?.length, 
        tentativas: data.tentativas?.length,
        acertou: data.acertou 
      });

      setGameData(data);
      setGuesses(data.tentativas || []);
      
      if (data.acertou !== null) {
        setGameOver(true);
        setWon(data.acertou);
      }
    } catch (error: any) {
      console.error('[TibiaTermo] Error loading game:', error);
      
      if (error.message?.includes('404')) {
        toast.error("Função do jogo não encontrada. Entre em contato com o suporte.");
      } else if (error.message?.includes('401')) {
        toast.error("Sessão expirada. Faça login novamente.");
        navigate("/login");
      } else {
        toast.error(error.message || "Erro ao carregar jogo");
      }
    } finally {
      setLoadingGame(false);
      isLoadingGameRef.current = false;
    }
  };

  const handleKeyPress = (key: string) => {
    if (gameOver || submitting) return;

    if (key === "ENTER") {
      submitGuess();
    } else if (key === "BACKSPACE") {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < (gameData?.palavra.length || 8)) {
      setCurrentGuess(prev => prev + key);
    }
  };

  const submitGuess = async () => {
    if (!currentGuess || currentGuess.length !== gameData.palavra.length) {
      toast.error(`A palavra deve ter ${gameData.palavra.length} letras`);
      return;
    }

    if (guesses.includes(currentGuess)) {
      toast.error("Você já tentou essa palavra!");
      return;
    }

    setSubmitting(true);

    try {
      const twitchToken = localStorage.getItem('twitch_token');
      if (!twitchToken) {
        toast.error("Sessão expirada. Faça login novamente.");
        navigate("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke('submit-tibiatermo-guess', {
        body: { 
          tentativa: currentGuess,
          jogo_id: gameData.jogo_id,
        },
        headers: {
          Authorization: `Bearer ${twitchToken}`,
        },
      });

      if (error) throw error;

      setGuesses(data.tentativas);
      setCurrentGuess("");

      if (data.jogo_finalizado) {
        setGameOver(true);
        setWon(data.acertou);

        if (data.acertou) {
          let message = `🎉 Parabéns! Você acertou em ${data.num_tentativas} tentativa${data.num_tentativas > 1 ? 's' : ''}!`;
          if (data.premiacao_pontos > 0) {
            message += ` +${data.premiacao_pontos} Pontos de Loja`;
          }
          if (data.premiacao_tickets > 0) {
            message += ` +${data.premiacao_tickets} Ticket`;
          }
          toast.success(message);
        } else {
          toast.error(`Tentativas esgotadas. A palavra era: ${data.palavra}`);
        }
      }
    } catch (error: any) {
      console.error('Error submitting guess:', error);
      toast.error(error.message || "Erro ao enviar tentativa");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle physical keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver || submitting) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        submitGuess();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setCurrentGuess(prev => prev.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        if (currentGuess.length < (gameData?.palavra.length || 8)) {
          setCurrentGuess(prev => prev + e.key.toUpperCase());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, submitting, currentGuess, gameData]);

  const getLetterColor = (guess: string, letterIndex: number) => {
    if (!gameData) return "bg-muted border-border";
    
    const letter = guess[letterIndex];
    const targetWord = gameData.palavra;

    if (targetWord[letterIndex] === letter) {
      return "bg-green-500 text-white border-green-600";
    } else if (targetWord.includes(letter)) {
      return "bg-yellow-500 text-white border-yellow-600";
    } else {
      return "bg-gray-500 text-white border-gray-600";
    }
  };

  const keyboard = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
  ];

  // Admin functions
  const loadWords = async () => {
    try {
      const { data, error } = await supabase
        .from("tibiatermo_words")
        .select("*")
        .order("palavra");

      if (error) throw error;
      setWords(data || []);
    } catch (error: any) {
      console.error("Error loading words:", error);
      toast.error("Erro ao carregar palavras");
    }
  };

  const loadRewardsConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("tibiatermo_rewards_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setRewardsConfig({
          pontos_acerto: data.pontos_acerto,
          tickets_bonus: data.tickets_bonus,
          max_tentativas_bonus: data.max_tentativas_bonus,
        });
      }
    } catch (error: any) {
      console.error("Error loading rewards config:", error);
    }
  };

  const validateWord = (word: string) => {
    const cleaned = word.trim().toUpperCase();
    if (cleaned.length < 4 || cleaned.length > 8) {
      return null;
    }
    if (!/^[A-Z]+$/.test(cleaned)) {
      return null;
    }
    return cleaned;
  };

  const addWord = async () => {
    const validated = validateWord(newWord);
    if (!validated) {
      toast.error("Palavra inválida (4-8 letras, sem espaços)");
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from("tibiatermo_words")
        .insert({ palavra: validated, ativa: true });

      if (error) {
        if (error.code === "23505") {
          toast.error("Palavra já existe");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Palavra adicionada!");
      setNewWord("");
      loadWords();
    } catch (error: any) {
      console.error("Error adding word:", error);
      toast.error("Erro ao adicionar palavra");
    } finally {
      setAdding(false);
    }
  };

  const addBulkWords = async () => {
    const lines = bulkWords.split("\n").filter((l) => l.trim());
    const validWords = lines
      .map((l) => validateWord(l))
      .filter((w) => w !== null);

    if (validWords.length === 0) {
      toast.error("Nenhuma palavra válida encontrada");
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from("tibiatermo_words")
        .insert(validWords.map((palavra) => ({ palavra, ativa: true })));

      if (error) throw error;

      toast.success(`${validWords.length} palavras adicionadas!`);
      setBulkWords("");
      loadWords();
    } catch (error: any) {
      console.error("Error adding bulk words:", error);
      toast.error("Erro ao adicionar palavras");
    } finally {
      setAdding(false);
    }
  };

  const toggleWord = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("tibiatermo_words")
        .update({ ativa: !currentState })
        .eq("id", id);

      if (error) throw error;

      toast.success(currentState ? "Palavra desativada" : "Palavra ativada");
      loadWords();
    } catch (error: any) {
      console.error("Error toggling word:", error);
      toast.error("Erro ao atualizar palavra");
    }
  };

  const deleteWord = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta palavra?")) return;

    try {
      const { error } = await supabase
        .from("tibiatermo_words")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Palavra excluída!");
      loadWords();
    } catch (error: any) {
      console.error("Error deleting word:", error);
      toast.error("Erro ao excluir palavra");
    }
  };

  const saveRewardsConfig = async () => {
    setSavingRewards(true);
    try {
      const { error } = await supabase
        .from("tibiatermo_rewards_config")
        .update(rewardsConfig)
        .eq('id', (await supabase.from('tibiatermo_rewards_config').select('id').limit(1).single()).data?.id);

      if (error) throw error;

      toast.success("Configurações de recompensas salvas!");
    } catch (error: any) {
      console.error("Error saving rewards:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSavingRewards(false);
    }
  };

  const resetUserGame = async () => {
    if (!resetUsername.trim()) {
      toast.error("Digite um username");
      return;
    }

    if (!confirm(`Deseja resetar o jogo de hoje para o usuário ${resetUsername}?`)) {
      return;
    }

    setResetting(true);
    try {
      // Resolver usuário pela identidade canônica (suporta twitch_user_id ou nome)
      const token = localStorage.getItem('twitch_token');
      const resolveResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-user-identity`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ searchTerm: resetUsername.trim() }),
        }
      );

      if (!resolveResponse.ok) {
        toast.error("Erro ao buscar usuário");
        return;
      }

      const resolveData = await resolveResponse.json();
      
      if (!resolveData.canonicalProfile) {
        toast.error("Usuário não encontrado");
        return;
      }

      const profileId = resolveData.canonicalProfile.id;

      // Deletar o jogo de hoje desse usuário
      const now = new Date();
      const brasiliaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const dateStr = brasiliaDate.toISOString().split('T')[0];

      const { error: deleteError } = await supabase
        .from('tibiatermo_user_games')
        .delete()
        .eq('user_id', profileId)
        .eq('data_jogo', dateStr);

      if (deleteError) throw deleteError;

      toast.success(`Jogo resetado para ${resetUsername}! O usuário pode jogar novamente.`);
      setResetUsername("");
    } catch (error: any) {
      console.error("Error resetting game:", error);
      toast.error("Erro ao resetar jogo");
    } finally {
      setResetting(false);
    }
  };

  const activeCount = words.filter((w) => w.ativa).length;
  const inactiveCount = words.length - activeCount;

  if (twitchLoading || adminLoading || loadingGame) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Se não é admin e não tem Twitch, redireciona
  if (!isAdmin && !twitchUser) {
    return null;
  }

  // Admin sem Twitch só pode ver configurações
  if (!twitchUser && isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold text-foreground">TibiaTermo</h1>
                <p className="text-muted-foreground">
                  Painel de administração
                </p>
              </div>
              <Dialog open={showAdmin} onOpenChange={setShowAdmin}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" title="Configurações">
                    <Settings className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Configurações do TibiaTermo</DialogTitle>
                    <DialogDescription>
                      Gerencie palavras e recompensas do jogo
                    </DialogDescription>
                  </DialogHeader>

                  <Tabs defaultValue="words" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="words">Palavras</TabsTrigger>
                      <TabsTrigger value="rewards">Recompensas</TabsTrigger>
                      <TabsTrigger value="tests">Testes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="words" className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="font-bold">Total:</span> {words.length}
                          </div>
                          <div>
                            <span className="font-bold text-green-600">Ativas:</span> {activeCount}
                          </div>
                          <div>
                            <span className="font-bold text-red-600">Inativas:</span> {inactiveCount}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Nova palavra (4-8 letras)"
                            value={newWord}
                            onChange={(e) => setNewWord(e.target.value.toUpperCase())}
                            maxLength={8}
                          />
                          <Button onClick={addWord} disabled={adding}>
                            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          </Button>
                        </div>

                        <div>
                          <Textarea
                            placeholder="Adicionar várias palavras (uma por linha)"
                            value={bulkWords}
                            onChange={(e) => setBulkWords(e.target.value.toUpperCase())}
                            rows={4}
                          />
                          <Button 
                            onClick={addBulkWords} 
                            disabled={adding}
                            className="mt-2 w-full"
                          >
                            {adding ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Adicionando...
                              </>
                            ) : (
                              "Adicionar em Lote"
                            )}
                          </Button>
                        </div>

                        <div className="border rounded-lg max-h-96 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Palavra</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {words.map((word) => (
                                <TableRow key={word.id}>
                                  <TableCell className="font-medium">{word.palavra}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={word.ativa}
                                        onCheckedChange={() => toggleWord(word.id, word.ativa)}
                                      />
                                      <span className={word.ativa ? "text-green-600" : "text-red-600"}>
                                        {word.ativa ? "Ativa" : "Inativa"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteWord(word.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="rewards" className="space-y-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="pontos">Pontos de Loja por acerto</Label>
                          <Input
                            id="pontos"
                            type="number"
                            value={rewardsConfig.pontos_acerto}
                            onChange={(e) => setRewardsConfig({
                              ...rewardsConfig,
                              pontos_acerto: parseInt(e.target.value) || 0
                            })}
                          />
                        </div>

                        <div>
                          <Label htmlFor="tickets">Tickets bônus</Label>
                          <Input
                            id="tickets"
                            type="number"
                            value={rewardsConfig.tickets_bonus}
                            onChange={(e) => setRewardsConfig({
                              ...rewardsConfig,
                              tickets_bonus: parseInt(e.target.value) || 0
                            })}
                          />
                        </div>

                        <div>
                          <Label htmlFor="max-tentativas">Máximo de tentativas para bônus</Label>
                          <Input
                            id="max-tentativas"
                            type="number"
                            value={rewardsConfig.max_tentativas_bonus}
                            onChange={(e) => setRewardsConfig({
                              ...rewardsConfig,
                              max_tentativas_bonus: parseInt(e.target.value) || 0
                            })}
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            Acertar em até {rewardsConfig.max_tentativas_bonus} tentativa{rewardsConfig.max_tentativas_bonus > 1 ? 's' : ''} ganha {rewardsConfig.tickets_bonus} ticket{rewardsConfig.tickets_bonus > 1 ? 's' : ''}
                          </p>
                        </div>

                        <Button onClick={saveRewardsConfig} disabled={savingRewards}>
                          {savingRewards ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            "Salvar Alterações"
                          )}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="tests" className="space-y-4">
                      <div className="space-y-4">
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-semibold mb-2">Resetar Jogo de Usuário</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Digite o username da Twitch do usuário para resetar o jogo de hoje. 
                            Isso permitirá que ele jogue novamente hoje.
                          </p>
                          
                          <div className="flex gap-2">
                            <Input
                              placeholder="Username da Twitch"
                              value={resetUsername}
                              onChange={(e) => setResetUsername(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  resetUserGame();
                                }
                              }}
                            />
                            <Button 
                              onClick={resetUserGame} 
                              disabled={resetting || !resetUsername.trim()}
                            >
                              {resetting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Resetando...
                                </>
                              ) : (
                                "Resetar"
                              )}
                            </Button>
                          </div>
                          
                          <p className="text-xs text-muted-foreground mt-2">
                            ⚠️ Esta ação não pode ser desfeita. Use apenas para testes.
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Para jogar, faça login com sua conta da Twitch.
                <br />
                Como administrador, você pode configurar o jogo clicando no botão de configurações acima.
              </p>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const maxLength = gameData?.palavra.length || 8;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">TibiaTermo</h1>
              <p className="text-muted-foreground">
                Descubra a palavra do dia em até 6 tentativas!
              </p>
            </div>
            {isAdmin && (
              <Dialog open={showAdmin} onOpenChange={setShowAdmin}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" title="Configurações">
                    <Settings className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Configurações do TibiaTermo</DialogTitle>
                    <DialogDescription>
                      Gerencie palavras e recompensas do jogo
                    </DialogDescription>
                  </DialogHeader>

                  <Tabs defaultValue="words" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="words">Palavras</TabsTrigger>
                      <TabsTrigger value="rewards">Recompensas</TabsTrigger>
                      <TabsTrigger value="tests">Testes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="words" className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="font-bold">Total:</span> {words.length}
                          </div>
                          <div>
                            <span className="font-bold text-green-600">Ativas:</span> {activeCount}
                          </div>
                          <div>
                            <span className="font-bold text-red-600">Inativas:</span> {inactiveCount}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Nova palavra (4-8 letras)"
                            value={newWord}
                            onChange={(e) => setNewWord(e.target.value.toUpperCase())}
                            maxLength={8}
                          />
                          <Button onClick={addWord} disabled={adding}>
                            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          </Button>
                        </div>

                        <div>
                          <Textarea
                            placeholder="Adicionar várias palavras (uma por linha)"
                            value={bulkWords}
                            onChange={(e) => setBulkWords(e.target.value.toUpperCase())}
                            rows={4}
                          />
                          <Button onClick={addBulkWords} disabled={adding} className="mt-2">
                            Adicionar em Lote
                          </Button>
                        </div>
                      </div>

                      <div className="border rounded-lg max-h-96 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Palavra</TableHead>
                              <TableHead className="text-center">Ativa</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {words.map((word) => (
                              <TableRow key={word.id}>
                                <TableCell className="font-mono font-bold">
                                  {word.palavra}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Switch
                                    checked={word.ativa}
                                    onCheckedChange={() => toggleWord(word.id, word.ativa)}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteWord(word.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value="rewards" className="space-y-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="pontos">Pontos de Loja por acerto</Label>
                          <Input
                            id="pontos"
                            type="number"
                            value={rewardsConfig.pontos_acerto}
                            onChange={(e) => setRewardsConfig({
                              ...rewardsConfig,
                              pontos_acerto: parseInt(e.target.value) || 0
                            })}
                          />
                        </div>

                        <div>
                          <Label htmlFor="tickets">Tickets bônus</Label>
                          <Input
                            id="tickets"
                            type="number"
                            value={rewardsConfig.tickets_bonus}
                            onChange={(e) => setRewardsConfig({
                              ...rewardsConfig,
                              tickets_bonus: parseInt(e.target.value) || 0
                            })}
                          />
                        </div>

                        <div>
                          <Label htmlFor="max-tentativas">Máximo de tentativas para bônus</Label>
                          <Input
                            id="max-tentativas"
                            type="number"
                            value={rewardsConfig.max_tentativas_bonus}
                            onChange={(e) => setRewardsConfig({
                              ...rewardsConfig,
                              max_tentativas_bonus: parseInt(e.target.value) || 0
                            })}
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            Acertar em até {rewardsConfig.max_tentativas_bonus} tentativa{rewardsConfig.max_tentativas_bonus > 1 ? 's' : ''} ganha {rewardsConfig.tickets_bonus} ticket{rewardsConfig.tickets_bonus > 1 ? 's' : ''}
                          </p>
                        </div>

                        <Button onClick={saveRewardsConfig} disabled={savingRewards}>
                          {savingRewards ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            "Salvar Alterações"
                          )}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="tests" className="space-y-4">
                      <div className="space-y-4">
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-semibold mb-2">Resetar Jogo de Usuário</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Digite o username da Twitch do usuário para resetar o jogo de hoje. 
                            Isso permitirá que ele jogue novamente hoje.
                          </p>
                          
                          <div className="flex gap-2">
                            <Input
                              placeholder="Username da Twitch"
                              value={resetUsername}
                              onChange={(e) => setResetUsername(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  resetUserGame();
                                }
                              }}
                            />
                            <Button 
                              onClick={resetUserGame} 
                              disabled={resetting || !resetUsername.trim()}
                            >
                              {resetting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Resetando...
                                </>
                              ) : (
                                "Resetar"
                              )}
                            </Button>
                          </div>
                          
                          <p className="text-xs text-muted-foreground mt-2">
                            ⚠️ Esta ação não pode ser desfeita. Use apenas para testes.
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card className="p-6 mb-6 bg-card">
            <p className="text-center text-sm text-muted-foreground mb-4">
              A palavra de hoje tem <span className="font-bold text-foreground">{maxLength} letras</span>
            </p>

            <div className="flex flex-col gap-2 mb-6">
              {[...Array(6)].map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-2 justify-center">
                  {[...Array(maxLength)].map((_, colIndex) => {
                    const guess = guesses[rowIndex];
                    const isCurrentRow = rowIndex === guesses.length && !gameOver;
                    const letter = isCurrentRow 
                      ? currentGuess[colIndex] || ""
                      : guess?.[colIndex] || "";

                    return (
                      <div
                        key={colIndex}
                        className={`w-12 h-12 sm:w-14 sm:h-14 border-2 flex items-center justify-center text-xl font-bold uppercase transition-all rounded ${
                          guess
                            ? getLetterColor(guess, colIndex)
                            : isCurrentRow && letter
                            ? "border-primary bg-primary/10"
                            : "border-border"
                        }`}
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {gameOver && (
              <div className="text-center mb-6">
                {won ? (
                  <div className="text-green-500 text-xl font-bold">
                    🎉 Você acertou! Nova palavra amanhã. 🎉
                  </div>
                ) : (
                  <div>
                    <div className="text-red-500 text-xl font-bold mb-2">
                      Tentativas esgotadas! 😢
                    </div>
                    <div className="text-muted-foreground">
                      A palavra era: <span className="font-bold text-foreground">{gameData.palavra}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {keyboard.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-1 justify-center">
                  {row.map((key) => (
                    <Button
                      key={key}
                      variant="outline"
                      size={key.length > 1 ? "sm" : "icon"}
                      className="text-xs sm:text-sm font-bold"
                      onClick={() => handleKeyPress(key)}
                      disabled={gameOver || submitting}
                    >
                      {key === "BACKSPACE" ? "⌫" : key}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          <div className="text-center text-sm text-muted-foreground space-y-1 mb-8">
            <p>🟩 = Letra correta na posição certa</p>
            <p>🟨 = Letra correta na posição errada</p>
            <p>⬜ = Letra não está na palavra</p>
          </div>

          {/* Ranking de Prêmios */}
          <WheelRanking />
        </div>
      </main>
    </div>
  );
};

export default TibiaTermo;