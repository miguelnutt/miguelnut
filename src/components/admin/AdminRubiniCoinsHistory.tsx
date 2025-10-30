import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-helper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
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
import { normalizeUsername } from "@/lib/username-utils";

interface HistoryItem {
  id: string;
  user_id: string | null;
  variacao: number;
  motivo: string;
  created_at: string;
  profiles?: {
    twitch_username: string;
  };
}

export function AdminRubiniCoinsHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rubini_coins_history")
        .select(`
          *,
          profiles:user_id (twitch_username)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar histórico:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-rubini-coins-history", {
        body: { historyId: deleteId },
      });

      if (error) throw error;

      toast.success("Histórico deletado e saldo ajustado!");
      fetchHistory();
    } catch (error: any) {
      console.error("Erro ao deletar histórico:", error);
      toast.error(error.message || "Erro ao deletar histórico");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Histórico de Rubini Coins</CardTitle>
            <Button onClick={fetchHistory} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhum histórico encontrado</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gradient-card rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {normalizeUsername(item.profiles?.twitch_username)}
                      </p>
                      <span
                        className={`text-sm font-bold ${
                          item.variacao > 0 ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {item.variacao > 0 ? "+" : ""}
                        {item.variacao} RC
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.motivo}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                  </div>
                  <Button
                    onClick={() => setDeleteId(item.id)}
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este histórico? O saldo do usuário será ajustado
              automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
