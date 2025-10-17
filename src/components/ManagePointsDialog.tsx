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
import { Loader2, Plus, Minus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase-helper";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Profile {
  id: string;
  nome: string;
  twitch_username: string;
}

interface ManagePointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManagePointsDialog({ open, onOpenChange }: ManagePointsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [points, setPoints] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, twitch_username')
        .not('twitch_username', 'is', null)
        .order('nome', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPoints = async (isAdd: boolean) => {
    if (!selectedUser || !points) {
      toast.error("Selecione um usuário e digite a quantidade");
      return;
    }

    const pointsNum = parseInt(points);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      toast.error("Digite uma quantidade válida");
      return;
    }

    setProcessing(true);
    try {
      const seToken = import.meta.env.VITE_STREAMELEMENTS_JWT_TOKEN;
      const seChannelId = import.meta.env.VITE_STREAMELEMENTS_CHANNEL_ID;

      if (!seToken || !seChannelId) {
        toast.error("StreamElements não configurado");
        return;
      }

      const finalPoints = isAdd ? pointsNum : -pointsNum;

      const response = await fetch(
        `https://api.streamelements.com/kappa/v2/points/${seChannelId}/${selectedUser.twitch_username}/${finalPoints}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${seToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao modificar pontos');
      }

      toast.success(`${isAdd ? 'Adicionado' : 'Removido'} ${pointsNum} pontos de ${selectedUser.nome}`);
      setPoints("");
      setSelectedUser(null);
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao modificar pontos");
    } finally {
      setProcessing(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.nome?.toLowerCase().includes(searchLower) ||
      user.twitch_username?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Pontos</DialogTitle>
          <DialogDescription>
            Adicione ou remova pontos dos usuários
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Formulário de modificação */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="space-y-2">
                <Label>Usuário Selecionado</Label>
                <Input
                  value={selectedUser ? `${selectedUser.nome} (${selectedUser.twitch_username})` : "Nenhum"}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Quantidade de Pontos</Label>
                <Input
                  type="number"
                  placeholder="Digite a quantidade"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  min="1"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleAddPoints(true)}
                  disabled={!selectedUser || !points || processing}
                  className="flex-1"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Pontos
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleAddPoints(false)}
                  disabled={!selectedUser || !points || processing}
                  className="flex-1"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Minus className="mr-2 h-4 w-4" />
                      Remover Pontos
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Lista de usuários */}
            <div className="space-y-2">
              <Label>Selecionar Usuário</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário encontrado
              </div>
            ) : (
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Username Twitch</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow 
                        key={user.id}
                        className={selectedUser?.id === user.id ? "bg-muted" : ""}
                      >
                        <TableCell className="font-medium">{user.nome}</TableCell>
                        <TableCell>{user.twitch_username}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={selectedUser?.id === user.id ? "default" : "outline"}
                            onClick={() => setSelectedUser(user)}
                          >
                            {selectedUser?.id === user.id ? "Selecionado" : "Selecionar"}
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
