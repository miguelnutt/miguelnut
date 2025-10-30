import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Loader2, Search, UserX, Users, Wrench } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DuplicateGroup {
  key: string;
  count: number;
  profiles: Array<{
    id: string;
    twitch_username: string;
    twitch_user_id: string | null;
    created_at: string;
  }>;
}

interface MergePreview {
  rubini_coins: { duplicate: number; canonical: number; after: number };
  tickets: { duplicate: number; canonical: number; after: number };
}

export function ProfileConsolidation() {
  const [scanning, setScanning] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [mergeDialog, setMergeDialog] = useState(false);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [canonicalId, setCanonicalId] = useState<string>('');
  const [duplicateId, setDuplicateId] = useState<string>('');
  const [merging, setMerging] = useState(false);
  const [fixingAlmoco, setFixingAlmoco] = useState(false);

  const scanDuplicates = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('consolidate-profiles', {
        body: { action: 'scan' }
      });

      if (error) throw error;
      
      if (data.success) {
        setDuplicates(data.duplicates || []);
        toast.success(`Scanner concluído: ${data.duplicates?.length || 0} grupos duplicados encontrados`);
      }
    } catch (error: any) {
      console.error('Erro ao escanear duplicatas:', error);
      toast.error('Erro ao escanear duplicatas');
    } finally {
      setScanning(false);
    }
  };

  const openMergeDialog = async (group: DuplicateGroup) => {
    setSelectedGroup(group);
    
    // Sugerir canônico: perfil mais antigo
    const oldest = group.profiles.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0];
    
    setCanonicalId(oldest.id);
    const duplicateCandidate = group.profiles.find(p => p.id !== oldest.id);
    if (duplicateCandidate) {
      setDuplicateId(duplicateCandidate.id);
      
      // Buscar preview
      try {
        const { data, error } = await supabase.functions.invoke('consolidate-profiles', {
          body: { 
            action: 'merge',
            duplicateId: duplicateCandidate.id,
            canonicalId: oldest.id,
            dryRun: true
          }
        });

        if (error) throw error;
        if (data.success && data.preview) {
          setMergePreview(data.preview);
        }
      } catch (error) {
        console.error('Erro ao buscar preview:', error);
      }
    }
    
    setMergeDialog(true);
  };

  const executeMerge = async () => {
    if (!duplicateId || !canonicalId) {
      toast.error('Selecione perfis válidos');
      return;
    }

    setMerging(true);
    try {
      const { data, error } = await supabase.functions.invoke('consolidate-profiles', {
        body: { 
          action: 'merge',
          duplicateId,
          canonicalId,
          dryRun: false
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Perfis consolidados: +${data.merged.rubini_coins_added} RC, +${data.merged.tickets_added} Tickets`);
        setMergeDialog(false);
        setMergePreview(null);
        // Re-escanear
        scanDuplicates();
      }
    } catch (error: any) {
      console.error('Erro ao consolidar:', error);
      toast.error(error.message || 'Erro ao consolidar perfis');
    } finally {
      setMerging(false);
    }
  };

  const fixAlmoco10 = async () => {
    setFixingAlmoco(true);
    try {
      const { data, error } = await supabase.functions.invoke('populate-twitch-user-ids');

      if (error) throw error;

      if (data.success) {
        toast.success(`Almoco10 corrigido! RC: ${data.details.final_balances.rubini_coins}, Tickets: ${data.details.final_balances.tickets}`);
        // Re-escanear
        scanDuplicates();
      }
    } catch (error: any) {
      console.error('Erro ao corrigir Almoco10:', error);
      toast.error(error.message || 'Erro ao corrigir caso Almoco10');
    } finally {
      setFixingAlmoco(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Consolidação de Perfis Duplicados
          </CardTitle>
          <CardDescription>
            Scanner e ferramentas de consolidação para eliminar perfis duplicados e garantir identidade única por twitch_user_id
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={scanDuplicates}
              disabled={scanning}
              className="gap-2"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Escaneando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Escanear Duplicatas
                </>
              )}
            </Button>
            
            <Button
              onClick={fixAlmoco10}
              disabled={fixingAlmoco}
              variant="outline"
              className="gap-2"
            >
              {fixingAlmoco ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Corrigindo...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4" />
                  Corrigir Caso Almoco10
                </>
              )}
            </Button>
          </div>

          {duplicates.length === 0 && !scanning && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhuma duplicata encontrada. Execute o scanner para verificar.
              </AlertDescription>
            </Alert>
          )}

          {duplicates.length > 0 && (
            <div className="space-y-2">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Encontrados <strong>{duplicates.length}</strong> grupos de perfis duplicados
                </AlertDescription>
              </Alert>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Identificador</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Perfis</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicates.map((group, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">
                        {group.key.replace('twitch:', 'Twitch ID: ').replace('login:', 'Login: ')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{group.count} duplicatas</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {group.profiles.map(p => (
                            <div key={p.id} className="text-sm">
                              <span className="font-medium">@{p.twitch_username}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openMergeDialog(group)}
                        >
                          Consolidar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={mergeDialog} onOpenChange={setMergeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Consolidar Perfis Duplicados</DialogTitle>
            <DialogDescription>
              Revise as informações antes de consolidar. O perfil canônico será mantido e receberá todos os saldos.
            </DialogDescription>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Perfil Canônico (mantido)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedGroup.profiles
                      .filter(p => p.id === canonicalId)
                      .map(p => (
                        <div key={p.id} className="space-y-1">
                          <p className="font-medium">@{p.twitch_username}</p>
                          <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <UserX className="h-4 w-4" />
                      Perfil Duplicado (desativado)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedGroup.profiles
                      .filter(p => p.id === duplicateId)
                      .map(p => (
                        <div key={p.id} className="space-y-1">
                          <p className="font-medium">@{p.twitch_username}</p>
                          <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              </div>

              {mergePreview && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Preview de Consolidação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Rubini Coins:</span>
                      <span>
                        {mergePreview.rubini_coins.canonical} + {mergePreview.rubini_coins.duplicate} = 
                        <strong className="ml-1 text-primary">{mergePreview.rubini_coins.after}</strong>
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tickets:</span>
                      <span>
                        {mergePreview.tickets.canonical} + {mergePreview.tickets.duplicate} = 
                        <strong className="ml-1 text-primary">{mergePreview.tickets.after}</strong>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={executeMerge} disabled={merging}>
              {merging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Consolidando...
                </>
              ) : (
                'Consolidar Perfis'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
