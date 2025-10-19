import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase-helper";
import { Search, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AdminManageRubiniCoins } from "../AdminManageRubiniCoins";

interface UserProfile {
  id: string;
  nome: string;
  twitch_username: string;
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
      const { data, error } = await supabase
        .from('twitch_profiles')
        .select('id, nome, twitch_username, created_at')
        .or(`twitch_username.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`)
        .limit(1)
        .single();

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
        .select('balance')
        .eq('user_id', userId)
        .single();

      // Tickets
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('amount')
        .eq('user_id', userId)
        .single();

      // StreamElements Points
      const { data: seData } = await supabase.functions.invoke('get-streamelements-points', {
        body: { twitchUsername }
      });

      setBalances({
        rubiniCoins: rubiniData?.balance || 0,
        tickets: ticketsData?.amount || 0,
        sePoints: seData?.data?.points || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar saldos:', error);
    }
  };

  const handleResyncUser = async () => {
    if (!selectedUser) return;
    
    toast({ title: "Ressincronizando usuário..." });
    await loadUserBalances(selectedUser.id, selectedUser.twitch_username);
    toast({ title: "Ressincronização concluída!" });
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{selectedUser.nome}</span>
              <Button onClick={handleResyncUser} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Ressincronizar
              </Button>
            </CardTitle>
            <CardDescription>@{selectedUser.twitch_username}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Rubini Coins</p>
                <p className="text-2xl font-bold">{balances.rubiniCoins}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tickets</p>
                <p className="text-2xl font-bold">{balances.tickets}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pontos SE</p>
                <p className="text-2xl font-bold">{balances.sePoints}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Criado em: {new Date(selectedUser.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedUser && (
        <AdminManageRubiniCoins />
      )}
    </div>
  );
}
