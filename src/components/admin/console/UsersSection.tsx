import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import { Search, Loader2, RefreshCw } from "lucide-react";
import { AdminManageRubiniCoins } from "@/components/admin/AdminManageRubiniCoins";

interface UserProfile {
  id: string;
  nome: string;
  twitch_username: string;
  created_at: string;
}

export function UsersSection() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [saldos, setSaldos] = useState({ rubiniCoins: 0, tickets: 0, pontos: 0 });

  const searchUser = async () => {
    if (!searchTerm.trim()) {
      toast.error("Digite um nome de usuário");
      return;
    }

    setSearching(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`twitch_username.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!profile) {
        toast.error("Usuário não encontrado");
        setSelectedUser(null);
        return;
      }

      setSelectedUser(profile);
      await loadUserBalances(profile.id, profile.twitch_username);
      
    } catch (error: any) {
      console.error("Erro ao buscar usuário:", error);
      toast.error("Erro ao buscar usuário");
    } finally {
      setSearching(false);
    }
  };

  const loadUserBalances = async (userId: string, twitchUsername: string) => {
    try {
      // Rubini Coins
      const { data: rcData } = await supabase
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

      // StreamElements points
      let sePoints = 0;
      try {
        const { data: seData } = await supabase.functions.invoke('loyalty-balance', {
          body: { username: twitchUsername }
        });
        sePoints = seData?.balance || 0;
      } catch (e) {
        console.warn("Erro ao buscar pontos SE:", e);
      }

      setSaldos({
        rubiniCoins: rcData?.saldo || 0,
        tickets: ticketsData?.tickets_atual || 0,
        pontos: sePoints
      });
    } catch (error: any) {
      console.error("Erro ao carregar saldos:", error);
    }
  };

  const handleResyncUser = async () => {
    if (!selectedUser) return;

    try {
      toast.loading("Ressincronizando usuário...");
      await loadUserBalances(selectedUser.id, selectedUser.twitch_username);
      toast.success("Usuário ressincronizado com sucesso");
    } catch (error: any) {
      toast.error("Erro ao ressincronizar");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Buscar Usuário</CardTitle>
          <CardDescription>
            Busque por nome Twitch ou nome de perfil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Digite o nome do usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUser()}
              />
            </div>
            <Button onClick={searchUser} disabled={searching}>
              {searching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Perfil do Usuário</CardTitle>
                <Button variant="outline" size="sm" onClick={handleResyncUser}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Ressincronizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Nome Twitch</Label>
                  <p className="font-medium">{selectedUser.twitch_username || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Nome</Label>
                  <p className="font-medium">{selectedUser.nome}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">User ID</Label>
                  <p className="font-mono text-xs">{selectedUser.id}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Criado em</Label>
                  <p className="text-sm">
                    {new Date(selectedUser.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saldos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <Label className="text-sm text-muted-foreground">Pontos de Loja</Label>
                  <p className="text-2xl font-bold">{saldos.pontos}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Label className="text-sm text-muted-foreground">Rubini Coins</Label>
                  <p className="text-2xl font-bold">{saldos.rubiniCoins}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Label className="text-sm text-muted-foreground">Tickets</Label>
                  <p className="text-2xl font-bold">{saldos.tickets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <AdminManageRubiniCoins />
        </>
      )}
    </div>
  );
}
