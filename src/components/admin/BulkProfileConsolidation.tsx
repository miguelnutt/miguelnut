import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DuplicateProfile {
  profile_with_twitch_id: string;
  profile_without_twitch_id: string;
  twitch_username: string;
  twitch_user_id: string;
  tickets_novo: number;
  tickets_antigo: number;
  rc_novo: number;
  rc_antigo: number;
}

export function BulkProfileConsolidation() {
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateProfile[]>([]);
  const [results, setResults] = useState<any[]>([]);

  const findDuplicates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('consolidate-profiles', {
        body: { action: 'scan' }
      });

      if (error) throw error;
      
      // Converter duplicates do scanner para nosso formato
      const foundDuplicates: DuplicateProfile[] = [];
      if (data?.duplicates) {
        for (const group of data.duplicates) {
          // Pegar perfil com twitch_user_id e sem twitch_user_id
          const withId = group.profiles.find((p: any) => p.twitch_user_id);
          const withoutId = group.profiles.find((p: any) => !p.twitch_user_id);
          
          if (withId && withoutId) {
            foundDuplicates.push({
              profile_with_twitch_id: withId.id,
              profile_without_twitch_id: withoutId.id,
              twitch_username: withId.twitch_username,
              twitch_user_id: withId.twitch_user_id,
              tickets_novo: 0,
              tickets_antigo: 0,
              rc_novo: 0,
              rc_antigo: 0
            });
          }
        }
      }
      
      setDuplicates(foundDuplicates);
      toast.success(`Encontrados ${foundDuplicates.length} perfis duplicados`);
    } catch (error: any) {
      console.error('Error finding duplicates:', error);
      toast.error('Erro ao buscar perfis duplicados');
    } finally {
      setLoading(false);
    }
  };

  const consolidateAll = async () => {
    if (duplicates.length === 0) {
      toast.error('Nenhum perfil duplicado encontrado');
      return;
    }

    setLoading(true);
    const consolidationResults: any[] = [];

    for (const dup of duplicates) {
      try {
        const { data, error } = await supabase.functions.invoke('consolidate-profiles', {
          body: {
            action: 'merge',
            canonicalId: dup.profile_with_twitch_id,
            duplicateId: dup.profile_without_twitch_id,
            dryRun: false
          }
        });

        if (error) throw error;

        consolidationResults.push({
          username: dup.twitch_username,
          success: true,
          data
        });

        console.log(`✅ Consolidado: ${dup.twitch_username}`);
      } catch (error: any) {
        console.error(`❌ Erro ao consolidar ${dup.twitch_username}:`, error);
        consolidationResults.push({
          username: dup.twitch_username,
          success: false,
          error: error.message
        });
      }
    }

    setResults(consolidationResults);
    setLoading(false);

    const successCount = consolidationResults.filter(r => r.success).length;
    const failCount = consolidationResults.filter(r => !r.success).length;

    if (failCount === 0) {
      toast.success(`✅ ${successCount} perfis consolidados com sucesso!`);
      setDuplicates([]);
    } else {
      toast.error(`⚠️ ${successCount} sucessos, ${failCount} falhas`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consolidação em Lote de Perfis</CardTitle>
        <CardDescription>
          Detecta e consolida perfis duplicados (com e sem twitch_user_id)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={findDuplicates} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Buscar Duplicados
          </Button>
          {duplicates.length > 0 && (
            <Button onClick={consolidateAll} disabled={loading} variant="destructive">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Consolidar Todos ({duplicates.length})
            </Button>
          )}
        </div>

        {duplicates.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Encontrados {duplicates.length} perfis duplicados. A consolidação irá:
              <ul className="list-disc list-inside mt-2">
                <li>Somar saldos de Tickets e Rubini Coins</li>
                <li>Migrar históricos para o perfil com twitch_user_id</li>
                <li>Desativar perfis antigos (sem twitch_user_id)</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {duplicates.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">Perfis a consolidar:</h4>
            {duplicates.map((dup, idx) => (
              <div key={idx} className="p-3 border rounded text-sm">
                <div className="font-medium">{dup.twitch_username}</div>
                <div className="text-muted-foreground">
                  Antigo: {dup.tickets_antigo} tickets, {dup.rc_antigo} RC →
                  Novo: {dup.tickets_novo} tickets, {dup.rc_novo} RC →
                  Total: {dup.tickets_novo + dup.tickets_antigo} tickets, {dup.rc_novo + dup.rc_antigo} RC
                </div>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">Resultados:</h4>
            {results.map((result, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 border rounded text-sm">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span>{result.username}</span>
                {!result.success && (
                  <span className="text-destructive text-xs">({result.error})</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
