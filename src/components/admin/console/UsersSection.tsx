import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase-helper";
import { Search, RefreshCw, BadgeCheck, Link2, Link2Off, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AdminManageRubiniCoins } from "../AdminManageRubiniCoins";

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

export function UsersSection() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [balances, setBalances] = useState<UserBalances | null>(null);

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

    toast({ title: "Buscando transações pendentes..." });
    
    try {
      // Buscar histórico pendente ou falho
      const { data: pendingEvents, error: fetchError } = await supabase
        .from('rubini_coins_history')
        .select('*')
        .eq('user_id', selectedUser.id)
        .in('status', ['pendente', 'falhou'])
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      if (!pendingEvents || pendingEvents.length === 0) {
        toast({ 
          title: "Nenhuma transação pendente", 
          description: "O saldo está sincronizado" 
        });
        return;
      }

      toast({ 
        title: `Reconciliando ${pendingEvents.length} transação(ões)...`,
        description: "Aguarde o processamento"
      });

      // Processar cada evento pendente
      let successCount = 0;
      for (const event of pendingEvents) {
        try {
          const { data, error } = await supabase.functions.invoke('reconcile-rubini-coins', {
            body: { 
              historyId: event.id,
              adminUserId: selectedUser.id
            }
          });

          if (error) throw error;
          if (data?.success) successCount++;
        } catch (err) {
          console.error(`Erro ao reconciliar evento ${event.id}:`, err);
        }
      }

      toast({ 
        title: "Reconciliação concluída!",
        description: `${successCount} de ${pendingEvents.length} transação(ões) processadas com sucesso`
      });

      // Recarregar saldos
      await loadUserBalances(selectedUser.id, selectedUser.twitch_username);
    } catch (error) {
      console.error('Erro ao reconciliar:', error);
      toast({ 
        title: "Erro na reconciliação",
        description: "Falha ao processar transações pendentes",
        variant: "destructive"
      });
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
                  <Button onClick={handleReconcileBalance} variant="outline" size="sm">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Reconciliar
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
    </div>
  );
}
