import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Coins, Search, Loader2, Plus, Minus, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { removeAtSymbol, searchUsername } from '@/lib/username-utils';

export function AdminManageRubiniCoins() {
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<any>(null);
  const [saldoAtual, setSaldoAtual] = useState<number>(0);
  const [quantidade, setQuantidade] = useState<number>(0);
  const [motivo, setMotivo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dialogConfirmacao, setDialogConfirmacao] = useState(false);
  const [tipoOperacao, setTipoOperacao] = useState<'adicionar' | 'remover'>('adicionar');

  const buscarUsuario = async () => {
    if (!buscaUsuario.trim()) {
      toast.error('Digite um usuário Twitch para buscar');
      return;
    }

    setBuscando(true);
    try {
      // Remover @ do username se presente
      const cleanUsername = removeAtSymbol(buscaUsuario.trim());
      
      // Usar edge function para resolver identidade canônica
      const { data, error } = await supabase.functions.invoke('resolve-user-identity', {
        body: { searchTerm: cleanUsername }
      });

      if (error) throw error;

      if (!data.success || !data.canonicalProfile) {
        toast.error('Usuário não encontrado');
        setUsuarioSelecionado(null);
        setSaldoAtual(0);
        return;
      }

      // Usar perfil canônico e saldo consolidado
      const profile = data.canonicalProfile;
      const consolidatedBalance = data.consolidatedBalances.rubini_coins;

      setUsuarioSelecionado({
        id: profile.id,
        twitch_username: profile.twitch_username,
        twitch_user_id: profile.twitch_user_id,
        aliases: data.aliases,
        hasDuplicates: data.hasDuplicates,
        duplicateProfiles: data.duplicateProfiles
      });

      setSaldoAtual(consolidatedBalance);

      let successMessage = `Usuário encontrado: @${profile.twitch_username}`;
      if (data.hasDuplicates) {
        successMessage += ` (⚠️ ${data.duplicateProfiles.length} duplicatas - saldo consolidado)`;
      }
      if (data.aliases.length > 0) {
        successMessage += ` [${data.aliases.length} alias]`;
      }

      toast.success(successMessage);
    } catch (error: any) {
      console.error('Erro ao buscar usuário:', error);
      toast.error('Erro ao buscar usuário');
    } finally {
      setBuscando(false);
    }
  };

  const confirmarOperacao = (tipo: 'adicionar' | 'remover') => {
    if (!usuarioSelecionado) {
      toast.error('Selecione um usuário primeiro');
      return;
    }

    if (!quantidade || quantidade <= 0) {
      toast.error('Digite uma quantidade válida');
      return;
    }

    if (!motivo.trim()) {
      toast.error('Digite um motivo para a operação');
      return;
    }

    if (tipo === 'remover' && quantidade > saldoAtual) {
      toast.error('Quantidade maior que o saldo disponível');
      return;
    }

    setTipoOperacao(tipo);
    setDialogConfirmacao(true);
  };

  const executarOperacao = async () => {
    setSalvando(true);
    try {
      const valorOperacao = tipoOperacao === 'adicionar' ? quantidade : -quantidade;
      const motivoCompleto = `[Admin] ${tipoOperacao === 'adicionar' ? 'Adição' : 'Remoção'} manual: ${motivo}`;

      const { data, error } = await supabase.functions.invoke('add-rubini-coins', {
        body: {
          userId: usuarioSelecionado.id,
          valor: valorOperacao,
          motivo: motivoCompleto
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const novoSaldo = saldoAtual + valorOperacao;
      setSaldoAtual(novoSaldo);
      setQuantidade(0);
      setMotivo('');
      setDialogConfirmacao(false);

      const mensagem = tipoOperacao === 'adicionar' 
        ? `✅ +${quantidade} Rubini Coins adicionados ao usuário @${usuarioSelecionado.twitch_username}`
        : `✅ -${quantidade} Rubini Coins removidos do usuário @${usuarioSelecionado.twitch_username}`;
      
      toast.success(mensagem);
    } catch (error: any) {
      console.error('Erro ao executar operação:', error);
      toast.error('Erro ao executar operação');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Gerenciar Saldos de Rubini Coins
          </CardTitle>
          <CardDescription>
            Adicione ou remova Rubini Coins manualmente de qualquer usuário
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Busca de usuário */}
          <div className="space-y-2">
            <Label htmlFor="busca-usuario">Buscar Usuário</Label>
            <div className="flex gap-2">
              <Input
                id="busca-usuario"
                placeholder="@nome_do_usuario"
                value={buscaUsuario}
                onChange={(e) => setBuscaUsuario(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && buscarUsuario()}
              />
              <Button 
                onClick={buscarUsuario} 
                disabled={buscando}
                variant="outline"
              >
                {buscando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Usuário selecionado */}
          {usuarioSelecionado && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">
                    @{usuarioSelecionado.twitch_username}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Saldo Atual</p>
                <p className="text-2xl font-bold text-primary">
                  {saldoAtual.toLocaleString()} Rubini Coins
                </p>
              </div>

              {/* Controles de operação */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    min="1"
                    value={quantidade || ''}
                    onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
                    placeholder="Digite a quantidade..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="motivo">Motivo da Operação *</Label>
                  <Input
                    id="motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex: Correção de bug, prêmio especial, ajuste..."
                    maxLength={200}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => confirmarOperacao('adicionar')}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={!quantidade || !motivo.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Rubini Coins
                  </Button>
                  <Button 
                    onClick={() => confirmarOperacao('remover')}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    disabled={!quantidade || !motivo.trim() || quantidade > saldoAtual}
                  >
                    <Minus className="h-4 w-4 mr-2" />
                    Remover Rubini Coins
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!usuarioSelecionado && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Busque um usuário para gerenciar o saldo de Rubini Coins</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação */}
      <Dialog open={dialogConfirmacao} onOpenChange={setDialogConfirmacao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Operação</DialogTitle>
            <DialogDescription>
              Você está prestes a {tipoOperacao === 'adicionar' ? 'adicionar' : 'remover'} Rubini Coins.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usuário:</span>
                <span className="font-semibold">
                  @{usuarioSelecionado?.twitch_username}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Operação:</span>
                <span className={`font-semibold ${tipoOperacao === 'adicionar' ? 'text-green-600' : 'text-red-600'}`}>
                  {tipoOperacao === 'adicionar' ? '+' : '-'}{quantidade} Rubini Coins
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo Atual:</span>
                <span>{saldoAtual.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Novo Saldo:</span>
                <span className="font-bold text-primary">
                  {(saldoAtual + (tipoOperacao === 'adicionar' ? quantidade : -quantidade)).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-semibold mb-1">Motivo:</p>
              <p className="text-sm">{motivo}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogConfirmacao(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={executarOperacao} 
              disabled={salvando}
              className={tipoOperacao === 'adicionar' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                `Confirmar ${tipoOperacao === 'adicionar' ? 'Adição' : 'Remoção'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
