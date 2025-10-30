import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase-helper";
import { searchUsername, normalizeUsernameWithFallback } from "@/lib/username-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserLogin {
  id: string;
  user_id: string;
  dia_atual: number;
  ultimo_login: string;
  profiles: {
    twitch_username: string;
    nome: string;
  };
}

interface ManageDailyRewardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageDailyRewardsDialog({ open, onOpenChange }: ManageDailyRewardsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserLogin[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_daily_logins')
        .select(`
          id,
          user_id,
          dia_atual,
          ultimo_login,
          profiles (
            twitch_username,
            nome
          )
        `)
        .order('dia_atual', { ascending: false });

      if (error) throw error;
      setUsers((data as any) || []);
    } catch (error: any) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja resetar o progresso de ${userName}? Isso vai zerar a sequência e limpar o histórico de recompensas deste usuário.`)) return;

    setResetting(userId);
    try {
      // Deletar registro de daily logins
      const { error: loginError } = await supabase
        .from('user_daily_logins')
        .delete()
        .eq('user_id', userId);

      if (loginError) throw loginError;

      // Deletar histórico de recompensas
      const { error: historyError } = await supabase
        .from('daily_rewards_history')
        .delete()
        .eq('user_id', userId);

      if (historyError) throw historyError;

      toast.success(`Progresso de ${userName} resetado completamente!`);
      loadUsers();
    } catch (error: any) {
      console.error("Erro ao resetar:", error);
      toast.error("Erro ao resetar progresso");
    } finally {
      setResetting(null);
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    
    const username = user.profiles?.twitch_username || "";
    return searchUsername(username, searchTerm);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Recompensas Diárias</DialogTitle>
          <DialogDescription>
            Visualize e resete o progresso de recompensas diárias dos usuários
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário com progresso de recompensa"}
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Username Twitch</TableHead>
                      <TableHead>Dia Atual</TableHead>
                      <TableHead>Último Login</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          @{normalizeUsernameWithFallback(user.profiles?.twitch_username, user.profiles?.nome)}
                        </TableCell>
                        <TableCell>
                          {user.profiles?.twitch_username || "N/A"}
                        </TableCell>
                        <TableCell>Dia {user.dia_atual}</TableCell>
                        <TableCell>
                          {new Date(user.ultimo_login).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReset(user.user_id, user.profiles?.twitch_username || "usuário")}
                            disabled={resetting === user.user_id}
                          >
                            {resetting === user.user_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Resetar
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
