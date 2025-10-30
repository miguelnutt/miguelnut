import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Coins, Clock, CheckCircle, XCircle, AlertCircle, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AdminRubiniCoinsResgates() {
  const [resgates, setResgates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [resgateEdicao, setResgateEdicao] = useState<any>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [novoStatus, setNovoStatus] = useState('');
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarResgates();
  }, [filtroStatus]);

  const carregarResgates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-resgate-rubini-coins', {
        body: { action: 'list', status: filtroStatus || undefined }
      });

      if (error) throw error;
      setResgates(data.resgates || []);
    } catch (error: any) {
      console.error('Erro ao carregar resgates:', error);
      toast.error('Erro ao carregar resgates');
    } finally {
      setLoading(false);
    }
  };

  const abrirEdicao = (resgate: any) => {
    setResgateEdicao(resgate);
    setNovoStatus(resgate.status);
    setMotivoRecusa(resgate.motivo_recusa || '');
    setObservacoes(resgate.observacoes || '');
    setDialogAberto(true);
  };

  const salvarAlteracoes = async () => {
    if (novoStatus === 'RECUSADO' && !motivoRecusa.trim()) {
      toast.error('Motivo da recusa é obrigatório');
      return;
    }

    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-resgate-rubini-coins', {
        body: {
          action: 'update',
          resgateId: resgateEdicao.id,
          status: novoStatus,
          motivoRecusa: novoStatus === 'RECUSADO' ? motivoRecusa : undefined,
          observacoes
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Resgate atualizado com sucesso');
      setDialogAberto(false);
      carregarResgates();
    } catch (error: any) {
      console.error('Erro ao atualizar resgate:', error);
      toast.error('Erro ao atualizar resgate');
    } finally {
      setSalvando(false);
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Resgates de Rubini Coins
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtro */}
          <div className="flex items-center gap-4">
            <Label>Filtrar por status:</Label>
            <Select value={filtroStatus || "TODOS"} onValueChange={(value) => setFiltroStatus(value === "TODOS" ? "" : value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="PROCESSANDO">Processando</SelectItem>
                <SelectItem value="ENTREGUE">Entregue</SelectItem>
                <SelectItem value="RECUSADO">Recusado</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={carregarResgates} variant="outline" size="sm">
              Atualizar
            </Button>
          </div>

          {/* Lista de resgates */}
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : resgates.length === 0 ? (
            <p className="text-muted-foreground">Nenhum resgate encontrado</p>
          ) : (
            <div className="space-y-3">
              {resgates.map((resgate) => (
                <div 
                  key={resgate.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(resgate.status)}
                        <span className="font-semibold">{getStatusText(resgate.status)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Usuário:</span>{' '}
                          @{resgate.profiles?.twitch_username || 'Desconhecido'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Quantidade:</span>{' '}
                          <span className="font-semibold">{resgate.quantidade} Rubini Coins</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Personagem:</span>{' '}
                          {resgate.personagem}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Data:</span>{' '}
                          {format(new Date(resgate.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      {resgate.observacoes && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Observações:</span> {resgate.observacoes}
                        </div>
                      )}
                      {resgate.status === 'RECUSADO' && resgate.motivo_recusa && (
                        <div className="bg-destructive/10 text-destructive rounded p-2 text-sm">
                          <strong>Motivo da recusa:</strong> {resgate.motivo_recusa}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirEdicao(resgate)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Resgate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={novoStatus} onValueChange={setNovoStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="PROCESSANDO">Processando</SelectItem>
                  <SelectItem value="ENTREGUE">Entregue</SelectItem>
                  <SelectItem value="RECUSADO">Recusado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {novoStatus === 'RECUSADO' && (
              <div>
                <Label>Motivo da Recusa *</Label>
                <Textarea
                  value={motivoRecusa}
                  onChange={(e) => setMotivoRecusa(e.target.value)}
                  placeholder="Explique o motivo da recusa..."
                  rows={3}
                />
              </div>
            )}

            <div>
              <Label>Observações / Comprovante</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Notas internas, ID de entrega, etc..."
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={salvarAlteracoes} 
                disabled={salvando}
                className="flex-1"
              >
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => setDialogAberto(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}