import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Coins, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ResgateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  saldoAtual: number;
  onResgateSuccess: () => void;
}

export function RubiniCoinsResgateDialog({ 
  open, 
  onOpenChange, 
  userId,
  saldoAtual,
  onResgateSuccess 
}: ResgateDialogProps) {
  const [quantidade, setQuantidade] = useState<number>(25);
  const [personagem, setPersonagem] = useState<string>('');
  const [personagens, setPersonagens] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [resgates, setResgates] = useState<any[]>([]);
  const [loadingResgates, setLoadingResgates] = useState(false);

  useEffect(() => {
    if (open) {
      carregarPersonagens();
      carregarResgates();
    }
  }, [open, userId]);

  const carregarPersonagens = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome_personagem')
        .eq('id', userId)
        .single();

      if (profile?.nome_personagem) {
        setPersonagens([profile.nome_personagem]);
        setPersonagem(profile.nome_personagem);
      }
    } catch (error) {
      console.error('Erro ao carregar personagens:', error);
    }
  };

  const carregarResgates = async () => {
    setLoadingResgates(true);
    try {
      const { data, error } = await supabase
        .from('rubini_coins_resgates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setResgates(data || []);
    } catch (error) {
      console.error('Erro ao carregar resgates:', error);
    } finally {
      setLoadingResgates(false);
    }
  };

  const solicitarResgate = async () => {
    if (quantidade % 25 !== 0) {
      toast.error('A quantidade deve ser múltiplo de 25');
      return;
    }

    if (quantidade > saldoAtual) {
      toast.error('Saldo insuficiente');
      return;
    }

    if (!personagem) {
      toast.error('Selecione um personagem');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('solicitar-resgate-rubini-coins', {
        body: { quantidade, personagem, userId }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Resgate solicitado com sucesso!');
      setQuantidade(25);
      carregarResgates();
      onResgateSuccess();
    } catch (error: any) {
      console.error('Erro ao solicitar resgate:', error);
      toast.error(error.message || 'Erro ao solicitar resgate');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'PROCESSANDO':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case 'ENTREGUE':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'RECUSADO':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDENTE: 'Pendente',
      PROCESSANDO: 'Processando',
      ENTREGUE: 'Entregue',
      RECUSADO: 'Recusado'
    };
    return statusMap[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Resgatar Rubini Coins
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Saldo */}
          <div className="bg-primary/10 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Saldo disponível</p>
            <p className="text-2xl font-bold text-primary">{saldoAtual.toLocaleString()} Rubini Coins</p>
          </div>

          {/* Formulário de resgate */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade (múltiplo de 25)</Label>
              <Input
                id="quantidade"
                type="number"
                min="25"
                step="25"
                value={quantidade}
                onChange={(e) => setQuantidade(parseInt(e.target.value) || 25)}
                placeholder="25, 50, 75..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personagem">Personagem</Label>
              <Select value={personagem} onValueChange={setPersonagem}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um personagem" />
                </SelectTrigger>
                <SelectContent>
                  {personagens.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {personagens.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Você precisa vincular um personagem nas configurações da conta
                </p>
              )}
            </div>

            <Button 
              onClick={solicitarResgate} 
              disabled={loading || personagens.length === 0}
              className="w-full"
            >
              {loading ? 'Solicitando...' : 'Solicitar Resgate'}
            </Button>
          </div>

          {/* Histórico de resgates */}
          <div className="space-y-3">
            <h3 className="font-semibold">Histórico de Resgates</h3>
            {loadingResgates ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : resgates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum resgate realizado</p>
            ) : (
              <div className="space-y-2">
                {resgates.map((resgate) => (
                  <div 
                    key={resgate.id} 
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(resgate.status)}
                          <span className="font-medium">{getStatusText(resgate.status)}</span>
                        </div>
                        <p className="text-sm">
                          <span className="font-semibold">{resgate.quantidade}</span> Rubini Coins
                          {' → '} 
                          <span className="text-muted-foreground">{resgate.personagem}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(resgate.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    {resgate.status === 'RECUSADO' && resgate.motivo_recusa && (
                      <div className="bg-destructive/10 text-destructive rounded p-2 text-sm">
                        <strong>Motivo da recusa:</strong> {resgate.motivo_recusa}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}