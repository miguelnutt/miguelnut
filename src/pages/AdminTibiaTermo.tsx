import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Trash2, Plus, ArrowLeft } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";

const AdminTibiaTermo = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const { isAdmin, loading: adminLoading } = useAdmin(user);

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
    console.log("=== ADMIN TIBIATERMO DEBUG ===");
    console.log("user:", user?.id);
    console.log("isAdmin:", isAdmin);
    console.log("adminLoading:", adminLoading);
    
    // NÃO FAZ NADA enquanto estiver carregando
    if (adminLoading) {
      console.log("Ainda carregando, aguardando...");
      return;
    }
    
    // NÃO FAZ NADA se não tem usuário ainda
    if (!user) {
      console.log("Sem usuário ainda, aguardando...");
      return;
    }
    
    // Agora sim, verificar se é admin
    console.log("Verificação final - isAdmin:", isAdmin);
    
    if (isAdmin) {
      console.log("É admin! Carregando dados...");
      loadWords();
      loadRewardsConfig();
    } else {
      console.log("NÃO é admin, redirecionando...");
      toast.error("Acesso negado!");
      navigate("/account");
    }
  }, [user, isAdmin, adminLoading, navigate]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

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
      // Buscar profile do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('twitch_username', resetUsername.toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;
      
      if (!profile) {
        toast.error("Usuário não encontrado");
        return;
      }

      // Deletar o jogo de hoje desse usuário
      const now = new Date();
      const brasiliaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const dateStr = brasiliaDate.toISOString().split('T')[0];

      const { error: deleteError } = await supabase
        .from('tibiatermo_user_games')
        .delete()
        .eq('user_id', profile.id)
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

  // Mostrar loading enquanto carrega usuário OU admin
  if (!user || adminLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Se não é admin, não renderiza nada (o useEffect já redireciona)
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/games")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                Administração - TibiaTermo
              </h1>
              <p className="text-muted-foreground">
                Gerencie palavras, recompensas e testes
              </p>
            </div>
          </div>

          <Card className="p-6">
            <Tabs defaultValue="words" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="words">Palavras</TabsTrigger>
                <TabsTrigger value="rewards">Recompensas</TabsTrigger>
                <TabsTrigger value="tests">Testes</TabsTrigger>
              </TabsList>

              <TabsContent value="words" className="space-y-4 mt-4">
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

              <TabsContent value="rewards" className="space-y-4 mt-4">
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

              <TabsContent value="tests" className="space-y-4 mt-4">
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
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminTibiaTermo;
