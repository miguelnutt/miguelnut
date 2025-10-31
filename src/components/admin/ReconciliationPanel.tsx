import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Users, TrendingUp } from 'lucide-react';

interface ReconciliationResult {
  userId: string;
  username: string;
  currentBalance: number;
  calculatedBalance: number;
  isConsistent: boolean;
  difference: number;
  fixed?: boolean;
  error?: string;
}

interface ReconciliationSummary {
  totalUsers: number;
  consistentUsers: number;
  inconsistentUsers: number;
  fixedUsers: number;
  totalDifference: number;
}

export function ReconciliationPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [specificUserId, setSpecificUserId] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [fixInconsistencies, setFixInconsistencies] = useState(false);
  const [results, setResults] = useState<ReconciliationResult[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runReconciliation = async (userId?: string) => {
    setIsLoading(true);
    try {
      console.log('🔍 Starting reconciliation:', { userId, dryRun, fixInconsistencies });

      const { data, error } = await supabase.functions.invoke('reconcile-balances', {
        body: {
          userId,
          dryRun,
          fixInconsistencies
        }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Reconciliation failed');
      }

      setResults(data.results);
      setSummary(data.summary);
      setLastRun(new Date());

      const inconsistentCount = data.summary.inconsistentUsers;
      if (inconsistentCount === 0) {
        toast.success('✅ Todos os saldos estão consistentes!');
      } else if (dryRun) {
        toast.warning(`⚠️ Encontradas ${inconsistentCount} inconsistências (modo simulação)`);
      } else if (fixInconsistencies) {
        toast.success(`✅ Corrigidas ${data.summary.fixedUsers} inconsistências`);
      } else {
        toast.info(`📊 Encontradas ${inconsistentCount} inconsistências`);
      }

    } catch (error) {
      console.error('❌ Reconciliation error:', error);
      toast.error(`Erro na reconciliação: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (result: ReconciliationResult) => {
    if (result.error) return <XCircle className="h-4 w-4 text-red-500" />;
    if (result.fixed) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (result.isConsistent) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusBadge = (result: ReconciliationResult) => {
    if (result.error) return <Badge variant="destructive">Erro</Badge>;
    if (result.fixed) return <Badge variant="default" className="bg-green-500">Corrigido</Badge>;
    if (result.isConsistent) return <Badge variant="default" className="bg-green-500">Consistente</Badge>;
    return <Badge variant="secondary">Inconsistente</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sistema de Reconciliação de Saldos
          </CardTitle>
          <CardDescription>
            Verifica e corrige inconsistências nos saldos de tickets dos usuários
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">Todos os Usuários</TabsTrigger>
              <TabsTrigger value="specific">Usuário Específico</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta operação verificará todos os usuários com saldos de tickets. 
                  Use o modo simulação primeiro para identificar problemas.
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-4">
                <Button 
                  onClick={() => runReconciliation()} 
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                  Verificar Todos os Usuários
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="specific" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">ID do Usuário</Label>
                <Input
                  id="userId"
                  placeholder="Digite o ID do usuário..."
                  value={specificUserId}
                  onChange={(e) => setSpecificUserId(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={() => runReconciliation(specificUserId)} 
                disabled={isLoading || !specificUserId.trim()}
                className="flex items-center gap-2"
              >
                {isLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                Verificar Usuário
              </Button>
            </TabsContent>
          </Tabs>

          <div className="mt-6 space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dryRun"
                  checked={dryRun}
                  onCheckedChange={setDryRun}
                />
                <Label htmlFor="dryRun">Modo Simulação (não faz alterações)</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fixInconsistencies"
                  checked={fixInconsistencies}
                  onCheckedChange={setFixInconsistencies}
                  disabled={dryRun}
                />
                <Label htmlFor="fixInconsistencies">Corrigir Inconsistências</Label>
              </div>
            </div>

            {!dryRun && fixInconsistencies && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-600">
                  ⚠️ ATENÇÃO: O modo de correção está ativado. Isso fará alterações permanentes no banco de dados!
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resumo da Reconciliação
            </CardTitle>
            {lastRun && (
              <CardDescription>
                Última execução: {lastRun.toLocaleString()}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{summary.totalUsers}</div>
                <div className="text-sm text-muted-foreground">Total de Usuários</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{summary.consistentUsers}</div>
                <div className="text-sm text-muted-foreground">Consistentes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{summary.inconsistentUsers}</div>
                <div className="text-sm text-muted-foreground">Inconsistentes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{summary.fixedUsers}</div>
                <div className="text-sm text-muted-foreground">Corrigidos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{summary.totalDifference}</div>
                <div className="text-sm text-muted-foreground">Diferença Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Resultados Detalhados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result) => (
                <div
                  key={result.userId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result)}
                    <div>
                      <div className="font-medium">{result.username}</div>
                      <div className="text-sm text-muted-foreground">ID: {result.userId}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm">
                        Atual: <span className="font-mono">{result.currentBalance}</span>
                      </div>
                      <div className="text-sm">
                        Calculado: <span className="font-mono">{result.calculatedBalance}</span>
                      </div>
                      {result.difference !== 0 && (
                        <div className="text-sm text-red-600">
                          Diferença: <span className="font-mono">{result.difference}</span>
                        </div>
                      )}
                    </div>
                    
                    {getStatusBadge(result)}
                  </div>
                  
                  {result.error && (
                    <div className="text-sm text-red-600 max-w-xs truncate" title={result.error}>
                      {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}