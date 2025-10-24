import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase-helper";
import { Search, RefreshCw, BadgeCheck, Link2, Link2Off, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AdminManageRubiniCoins } from "../AdminManageRubiniCoins";
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

interface UserProfile {
  id: string;
  nome: string;
  twitch_username: string;
  twitch_user_id: string | null;
  display_name_canonical: string | null;
  created_at: string;
}

interface UserBalances {
  rubiniCoins: number;
  tickets: number;
  sePoints: number;
}

interface ReconcilePreview {
  rubiniCoins: {
    before: number;
    calculated: number;
    divergence: number;
  };
  tickets: {
    before: number;
    calculated: number;
    divergence: number;
  };
  hadDivergence: boolean;
}

export function UsersSection() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [balances, setBalances] = useState<UserBalances | null>(null);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [reconcilePreview, setReconcilePreview] = useState<ReconcilePreview | null>(null);
  const [reconciling, setReconciling] = useState(false);

  const searchUser = async () => {
    if (!searchTerm.trim()) {
      toast({ title: "Digite um nome de usuário", variant: "destructive" });
      return;
    }

    setSearching(true);
    try {
      // Buscar com prioridade para perfis com twitch_user_id
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, twitch_username, twitch_user_id, display_name_canonical, created_at')
        .eq('is_active', true)
        .or(`twitch_username.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`)
        .order('twitch_user_id', { ascending: false, nullsLast: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSelectedUser(data);
        await loadUserBalances(data.id, data.twitch_username);
      } else {
        toast({ title: "Usuário não encontrado", variant: "destructive" });
      }
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      toast({ title: "Erro ao buscar usuário", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const loadUserBalances = async (userId: string, twitchUsername: string) => {
    try {
      // Rubini Coins
      const { data: rubiniData } = await supabase
        .from('rubini_coins_balance')
        .select('saldo')
        .eq('user_id', userId)
        .maybeSingle();

      // Tickets
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('tickets_atual')
        .eq('user_id', userId)
        .maybeSingle();

      // StreamElements Points
      const { data: seData, error: seError } = await supabase.functions.invoke('get-streamelements-points', {
        body: { username: twitchUsername }
      });

      if (seError) {
        console.error('Erro ao buscar pontos SE:', seError);
        toast({ 
          title: "Aviso", 
          description: "Não foi possível consultar pontos do StreamElements",
          variant: "destructive" 
        });
      }

      setBalances({
        rubiniCoins: rubiniData?.saldo || 0,
        tickets: ticketsData?.tickets_atual || 0,
        sePoints: seData?.points || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar saldos:', error);
      toast({ 
        title: "Erro", 
        description: "Falha ao carregar saldos do usuário",
        variant: "destructive" 
      });
    }
  };

  const handleResyncUser = async () => {
    if (!selectedUser) return;
    
    toast({ title: "Ressincronizando usuário..." });
    await loadUserBalances(selectedUser.id, selectedUser.twitch_username);
    toast({ title: "Ressincronização concluída!" });
  };

  const handleReconcileBalance = async () => {
    if (!selectedUser) return;

    setReconciling(true);
    toast({ title: "Analisando saldos..." });
    
    try {
      // Primeiro fazer dry-run para ver o que seria corrigido
      const { data, error } = await supabase.functions.invoke('reconcile-balance', {
        body: { 
          userId: selectedUser.id,
          dryRun: true
        }
      });

      if (error) throw error;

      if (!data.summary.hadDivergence) {
        toast({ 
          title: "✅ Saldos corretos!", 
          description: "Não há divergências a corrigir"
        });
        setReconciling(false);
        return;
      }

      // Mostrar preview das correções
      setReconcilePreview({
        rubiniCoins: {
          before: data.rubiniCoins.before,
          calculated: data.rubiniCoins.calculated,
          divergence: data.rubiniCoins.divergence
        },
        tickets: {
          before: data.tickets.before,
          calculated: data.tickets.calculated,
          divergence: data.tickets.divergence
        },
        hadDivergence: data.summary.hadDivergence
      });
      
      setReconcileDialogOpen(true);
      setReconciling(false);

    } catch (error) {
      console.error('Erro ao analisar saldos:', error);
      toast({ 
        title: "Erro na análise",
        description: error instanceof Error ? error.message : "Falha ao analisar saldos",
        variant: "destructive"
      });
      setReconciling(false);
    }
  };

  const confirmReconcile = async () => {
    if (!selectedUser) return;

    setReconciling(true);
    setReconcileDialogOpen(false);
    toast({ title: "Aplicando correções..." });

    try {
      const { data, error } = await supabase.functions.invoke('reconcile-balance', {
        body: { 
          userId: selectedUser.id,
          dryRun: false
        }
      });

      if (error) throw error;

      const rcCorrected = data.rubiniCoins.corrected;
      const ticketsCorrected = data.tickets.corrected;
      const corrections = [];
      
      if (rcCorrected) {
        corrections.push(`Rubini Coins: ${data.rubiniCoins.before} → ${data.rubiniCoins.after}`);
      }
      if (ticketsCorrected) {
        corrections.push(`Tickets: ${data.tickets.before} → ${data.tickets.after}`);
      }

      toast({ 
        title: "✅ Reconciliação concluída!",
        description: corrections.length > 0 
          ? corrections.join(' | ')
          : "Saldos já estavam corretos"
      });

      // Recarregar saldos
      await loadUserBalances(selectedUser.id, selectedUser.twitch_username);
      setReconcilePreview(null);
      
    } catch (error) {
      console.error('Erro ao aplicar correções:', error);
      toast({ 
        title: "Erro na reconciliação",
        description: error instanceof Error ? error.message : "Falha ao aplicar correções",
        variant: "destructive"
      });
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Buscar Usuário</CardTitle>
          <CardDescription>Digite o nome de usuário da Twitch ou nome do perfil</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Twitch username ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUser()}
            />
            <Button onClick={searchUser} disabled={searching}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {searching && <Skeleton className="h-64 w-full" />}

      {selectedUser && balances && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="flex items-center gap-2">
                    <BadgeCheck className="h-5 w-5 text-primary" />
                    {selectedUser.nome}
                  </CardTitle>
                  <CardDescription>@{selectedUser.twitch_username}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleReconcileBalance} 
                    variant="outline" 
                    size="sm"
                    disabled={reconciling}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {reconciling ? "Analisando..." : "Reconciliar"}
                  </Button>
                  <Button onClick={handleResyncUser} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status do Vínculo */}
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card/50">
                <div className={`p-2 rounded-full ${selectedUser.twitch_user_id ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                  {selectedUser.twitch_user_id ? (
                    <Link2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Link2Off className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">Status do Vínculo:</p>
                    <Badge variant={selectedUser.twitch_user_id ? "default" : "secondary"}>
                      {selectedUser.twitch_user_id ? 'Vinculado' : 'Parcial'}
                    </Badge>
                  </div>
                  {selectedUser.twitch_user_id ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">ID Canônico Twitch</p>
                      <p className="text-xs font-mono bg-muted px-2 py-1 rounded w-fit">
                        {selectedUser.twitch_user_id}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">
                      ⚠️ Usuário precisa reconectar para completar vínculo
                    </p>
                  )}
                  {selectedUser.display_name_canonical && (
                    <div className="space-y-1 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Display Name Canônico</p>
                      <p className="text-sm font-medium">{selectedUser.display_name_canonical}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Saldos */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Saldos</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-gradient-card">
                    <p className="text-xs text-muted-foreground mb-1">Rubini Coins</p>
                    <p className="text-2xl font-bold text-purple-500">{balances.rubiniCoins}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-gradient-card">
                    <p className="text-xs text-muted-foreground mb-1">Tickets</p>
                    <p className="text-2xl font-bold text-yellow-500">{balances.tickets}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-gradient-card">
                    <p className="text-xs text-muted-foreground mb-1">Pontos SE</p>
                    <p className="text-2xl font-bold text-blue-500">{balances.sePoints}</p>
                  </div>
                </div>
              </div>

              {/* Informações Adicionais */}
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Criado em: {new Date(selectedUser.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedUser && (
        <AdminManageRubiniCoins />
      )}

      {/* Dialog de Confirmação de Reconciliação */}
      <AlertDialog open={reconcileDialogOpen} onOpenChange={setReconcileDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reconciliação de Saldo</AlertDialogTitle>
            <AlertDialogDescription>
              Foram detectadas divergências entre os saldos armazenados e o histórico de transações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {reconcilePreview && (
            <div className="space-y-4 py-4">
              {/* Rubini Coins */}
              {reconcilePreview.rubiniCoins.divergence !== 0 && (
                <div className="space-y-2 p-4 rounded-lg border bg-card/50">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <p className="text-sm font-semibold">Rubini Coins</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Saldo atual:</span>
                      <span className="font-mono">{reconcilePreview.rubiniCoins.before}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Saldo correto:</span>
                      <span className="font-mono font-semibold text-green-500">
                        {reconcilePreview.rubiniCoins.calculated}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-muted-foreground">Divergência:</span>
                      <span className={`font-mono font-bold ${
                        reconcilePreview.rubiniCoins.divergence > 0 ? 'text-red-500' : 'text-yellow-500'
                      }`}>
                        {reconcilePreview.rubiniCoins.divergence > 0 ? '+' : ''}
                        {reconcilePreview.rubiniCoins.divergence}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tickets */}
              {reconcilePreview.tickets.divergence !== 0 && (
                <div className="space-y-2 p-4 rounded-lg border bg-card/50">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    <p className="text-sm font-semibold">Tickets</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Saldo atual:</span>
                      <span className="font-mono">{reconcilePreview.tickets.before}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Saldo correto:</span>
                      <span className="font-mono font-semibold text-green-500">
                        {reconcilePreview.tickets.calculated}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-muted-foreground">Divergência:</span>
                      <span className={`font-mono font-bold ${
                        reconcilePreview.tickets.divergence > 0 ? 'text-red-500' : 'text-yellow-500'
                      }`}>
                        {reconcilePreview.tickets.divergence > 0 ? '+' : ''}
                        {reconcilePreview.tickets.divergence}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  Esta ação corrigirá os saldos para corresponder ao histórico de transações confirmadas.
                  Um registro de auditoria será criado.
                </p>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReconcile} disabled={reconciling}>
              {reconciling ? "Aplicando..." : "Confirmar Correção"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
