import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import { Loader2, Save, RefreshCw, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface RewardConfig {
  tentativa: number;
  pontos_loja: number;
  tickets: number;
  ativa: boolean;
}

interface ParticipacaoHoje {
  user_id: string;
  twitch_username: string;
  created_at: string;
  acertou: boolean | null;
  num_tentativas: number | null;
}

interface TibiaTermoWord {
  id: string;
  palavra: string;
  ativa: boolean;
  created_at: string;
}

export function TibiaTermoAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<RewardConfig[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Participações de hoje
  const [participacoesHoje, setParticipacoesHoje] = useState<ParticipacaoHoje[]>([]);
  const [loadingParticipacoes, setLoadingParticipacoes] = useState(false);
  const [showDetalhes, setShowDetalhes] = useState(false);
  
  // Reset
  const [resetUsername, setResetUsername] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showResetGlobalDialog, setShowResetGlobalDialog] = useState(false);
  const [showResetUserDialog, setShowResetUserDialog] = useState(false);
  
  // Config geral
  const [exigirLogin, setExigirLogin] = useState(true);
  const [bloquearNovaPartida, setBloquearNovaPartida] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  
  // Gerenciamento de palavras
  const [words, setWords] = useState<TibiaTermoWord[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [addingWord, setAddingWord] = useState(false);
  const [showDeleteWordDialog, setShowDeleteWordDialog] = useState(false);
  const [wordToDelete, setWordToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadRewards();
    loadGeneralConfig();
    loadParticipacoesHoje();
    loadWords();
  }, []);

  const loadRewards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tibiatermo_rewards_by_attempt")
        .select("*")
        .order("tentativa");

      if (error) throw error;
      setRewards(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar recompensas:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const loadGeneralConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("tibiatermo_general_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setExigirLogin(data.exigir_login);
        setBloquearNovaPartida(data.bloquear_nova_partida);
      }
    } catch (error: any) {
      console.error("Erro ao carregar config geral:", error);
    }
  };

  const loadParticipacoesHoje = async () => {
    setLoadingParticipacoes(true);
    try {
      const now = new Date();
      const brasiliaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const dateStr = brasiliaDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('tibiatermo_user_games')
        .select(`
          user_id,
          created_at,
          acertou,
          num_tentativas,
          profiles!inner(twitch_username)
        `)
        .eq('data_jogo', dateStr);

      if (error) throw error;
      
      const participacoes = (data || []).map((item: any) => ({
        user_id: item.user_id,
        twitch_username: item.profiles?.twitch_username || 'Desconhecido',
        created_at: item.created_at,
        acertou: item.acertou,
        num_tentativas: item.num_tentativas,
      }));

      setParticipacoesHoje(participacoes);
    } catch (error: any) {
      console.error("Erro ao carregar participações:", error);
    } finally {
      setLoadingParticipacoes(false);
    }
  };

  const updateReward = (tentativa: number, field: keyof RewardConfig, value: any) => {
    setRewards(prev => prev.map(r => 
      r.tentativa === tentativa ? { ...r, [field]: value } : r
    ));
  };

  const saveRewards = async () => {
    setSaving(true);
    try {
      for (const reward of rewards) {
        const { error } = await supabase
          .from("tibiatermo_rewards_by_attempt")
          .update({
            pontos_loja: reward.pontos_loja,
            tickets: reward.tickets,
            ativa: reward.ativa,
          })
          .eq("tentativa", reward.tentativa);

        if (error) throw error;
      }

      toast.success("Recompensas atualizadas com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar recompensas");
    } finally {
      setSaving(false);
    }
  };

  const saveGeneralConfig = async () => {
    setSavingConfig(true);
    try {
      const { data: existingConfig } = await supabase
        .from('tibiatermo_general_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existingConfig) {
        const { error } = await supabase
          .from('tibiatermo_general_config')
          .update({
            exigir_login: exigirLogin,
            bloquear_nova_partida: bloquearNovaPartida,
          })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tibiatermo_general_config')
          .insert({
            exigir_login: exigirLogin,
            bloquear_nova_partida: bloquearNovaPartida,
          });

        if (error) throw error;
      }

      toast.success("Configurações salvas!");
    } catch (error: any) {
      console.error("Erro ao salvar config:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSavingConfig(false);
    }
  };

  const resetGlobal = async () => {
    setResetting(true);
    try {
      const now = new Date();
      const brasiliaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const dateStr = brasiliaDate.toISOString().split('T')[0];

      const { error } = await supabase
        .from('tibiatermo_user_games')
        .delete()
        .eq('data_jogo', dateStr);

      if (error) throw error;

      toast.success("Todas as participações de hoje foram resetadas!");
      loadParticipacoesHoje();
    } catch (error: any) {
      console.error("Erro ao resetar:", error);
      toast.error("Erro ao resetar participações");
    } finally {
      setResetting(false);
      setShowResetGlobalDialog(false);
    }
  };

  const resetUsuario = async () => {
    if (!resetUsername.trim()) {
      toast.error("Digite um username");
      return;
    }

    setResetting(true);
    try {
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

      const now = new Date();
      const brasiliaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const dateStr = brasiliaDate.toISOString().split('T')[0];

      const { error: deleteError } = await supabase
        .from('tibiatermo_user_games')
        .delete()
        .eq('user_id', profile.id)
        .eq('data_jogo', dateStr);

      if (deleteError) throw deleteError;

      toast.success(`Participação de ${resetUsername} resetada!`);
      setResetUsername("");
      loadParticipacoesHoje();
    } catch (error: any) {
      console.error("Erro ao resetar usuário:", error);
      toast.error("Erro ao resetar participação");
    } finally {
      setResetting(false);
      setShowResetUserDialog(false);
    }
  };

  const loadWords = async () => {
    setLoadingWords(true);
    try {
      const { data, error } = await supabase
        .from('tibiatermo_words')
        .select('*')
        .order('palavra');

      if (error) throw error;
      setWords(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar palavras:", error);
      toast.error("Erro ao carregar palavras");
    } finally {
      setLoadingWords(false);
    }
  };

  const addWord = async () => {
    if (!newWord.trim()) {
      toast.error("Digite uma palavra");
      return;
    }

    const palavra = newWord.trim().toUpperCase();
    
    if (palavra.length < 4 || palavra.length > 12) {
      toast.error("A palavra deve ter entre 4 e 12 caracteres");
      return;
    }

    if (!/^[A-Z]+$/.test(palavra)) {
      toast.error("A palavra deve conter apenas letras");
      return;
    }

    setAddingWord(true);
    try {
      const { error } = await supabase
        .from('tibiatermo_words')
        .insert({ palavra, ativa: true });

      if (error) {
        if (error.code === '23505') {
          toast.error("Esta palavra já existe no dicionário");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Palavra adicionada com sucesso!");
      setNewWord("");
      loadWords();
    } catch (error: any) {
      console.error("Erro ao adicionar palavra:", error);
      toast.error("Erro ao adicionar palavra");
    } finally {
      setAddingWord(false);
    }
  };

  const toggleWordActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tibiatermo_words')
        .update({ ativa: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Palavra ${!currentStatus ? 'ativada' : 'desativada'}`);
      loadWords();
    } catch (error: any) {
      console.error("Erro ao atualizar palavra:", error);
      toast.error("Erro ao atualizar palavra");
    }
  };

  const confirmDeleteWord = (id: string) => {
    setWordToDelete(id);
    setShowDeleteWordDialog(true);
  };

  const deleteWord = async () => {
    if (!wordToDelete) return;

    try {
      const { error } = await supabase
        .from('tibiatermo_words')
        .delete()
        .eq('id', wordToDelete);

      if (error) throw error;

      toast.success("Palavra removida com sucesso!");
      loadWords();
    } catch (error: any) {
      console.error("Erro ao remover palavra:", error);
      toast.error("Erro ao remover palavra");
    } finally {
      setWordToDelete(null);
      setShowDeleteWordDialog(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seção A: Recompensas por tentativa */}
      <Card>
        <CardHeader>
          <CardTitle>Recompensas por Tentativa</CardTitle>
          <CardDescription>
            Configure pontos de loja e tickets para cada número de tentativas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tentativa</TableHead>
                  <TableHead>Pontos de Loja</TableHead>
                  <TableHead>Tickets</TableHead>
                  <TableHead>Ativa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewards.map((reward) => (
                  <TableRow key={reward.tentativa}>
                    <TableCell className="font-medium">
                      Tentativa {reward.tentativa}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={reward.pontos_loja}
                        onChange={(e) => updateReward(reward.tentativa, 'pontos_loja', parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={reward.tickets}
                        onChange={(e) => updateReward(reward.tentativa, 'tickets', parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={reward.ativa}
                        onCheckedChange={(checked) => updateReward(reward.tentativa, 'ativa', checked)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Button onClick={saveRewards} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Recompensas
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seção B: Controles de participação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Participações de Hoje (Brasília)</span>
            <Button
              variant="outline"
              size="sm"
              onClick={loadParticipacoesHoje}
              disabled={loadingParticipacoes}
            >
              <RefreshCw className={`h-4 w-4 ${loadingParticipacoes ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
          <CardDescription>
            Total: {participacoesHoje.length} {participacoesHoje.length === 1 ? 'usuário' : 'usuários'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Collapsible open={showDetalhes} onOpenChange={setShowDetalhes}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                {showDetalhes ? 'Ocultar' : 'Ver'} Detalhes de Hoje
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              {participacoesHoje.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma participação hoje
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Tentativas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participacoesHoje.map((p) => (
                      <TableRow key={p.user_id}>
                        <TableCell>@{p.twitch_username}</TableCell>
                        <TableCell>{new Date(p.created_at).toLocaleTimeString('pt-BR')}</TableCell>
                        <TableCell>
                          {p.acertou === null ? 'Jogando' : p.acertou ? '✅ Acertou' : '❌ Errou'}
                        </TableCell>
                        <TableCell>{p.num_tentativas || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="border-t pt-4 space-y-2">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowResetGlobalDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Resetar Participação de Hoje (Global)
            </Button>

            <div className="flex gap-2">
              <Input
                placeholder="Username da Twitch"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => setShowResetUserDialog(true)}
                disabled={!resetUsername.trim()}
              >
                Resetar Usuário
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção C: Opções gerais */}
      <Card>
        <CardHeader>
          <CardTitle>Opções Gerais</CardTitle>
          <CardDescription>
            A palavra troca às 00:00 (America/Sao_Paulo)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="exigir-login" className="cursor-pointer">
              Exigir login para jogar
            </Label>
            <Switch
              id="exigir-login"
              checked={exigirLogin}
              onCheckedChange={setExigirLogin}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="bloquear-partida" className="cursor-pointer">
              Bloquear nova partida após concluir o dia
            </Label>
            <Switch
              id="bloquear-partida"
              checked={bloquearNovaPartida}
              onCheckedChange={setBloquearNovaPartida}
            />
          </div>

          <Button onClick={saveGeneralConfig} disabled={savingConfig} className="w-full">
            {savingConfig ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações Gerais
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Seção D: Gerenciamento de palavras */}
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Palavras do Dicionário</CardTitle>
          <CardDescription>
            Adicione ou remova palavras válidas do TibiaTermo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Digite uma palavra (4-12 letras)"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && addWord()}
              maxLength={12}
            />
            <Button onClick={addWord} disabled={addingWord || !newWord.trim()}>
              {addingWord ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                'Adicionar Palavra'
              )}
            </Button>
            <Button variant="outline" onClick={loadWords} disabled={loadingWords}>
              <RefreshCw className={`h-4 w-4 ${loadingWords ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="border rounded-lg max-h-96 overflow-y-auto">
            {loadingWords ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : words.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma palavra cadastrada
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Palavra</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {words.map((word) => (
                    <TableRow key={word.id}>
                      <TableCell className="font-medium">{word.palavra}</TableCell>
                      <TableCell>
                        <Switch
                          checked={word.ativa}
                          onCheckedChange={() => toggleWordActive(word.id, word.ativa)}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(word.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => confirmDeleteWord(word.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Total de palavras: {words.length} ({words.filter(w => w.ativa).length} ativas)
          </p>
        </CardContent>
      </Card>

      {/* Dialogs de confirmação */}
      <AlertDialog open={showResetGlobalDialog} onOpenChange={setShowResetGlobalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reset Global</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai apagar TODAS as participações de hoje ({participacoesHoje.length} {participacoesHoje.length === 1 ? 'usuário' : 'usuários'}).
              Os usuários poderão jogar novamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={resetGlobal} disabled={resetting}>
              {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResetUserDialog} onOpenChange={setShowResetUserDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reset de Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Resetar a participação de hoje do usuário <strong>{resetUsername}</strong>?
              O usuário poderá jogar novamente hoje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={resetUsuario} disabled={resetting}>
              {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteWordDialog} onOpenChange={setShowDeleteWordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta palavra do dicionário?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteWord}>
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
