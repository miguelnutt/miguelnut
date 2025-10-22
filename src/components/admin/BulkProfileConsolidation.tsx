import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react';
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
      // Query direta para encontrar perfis duplicados
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, twitch_username, twitch_user_id, is_active')
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Agrupar por twitch_username
      const grouped = new Map<string, any[]>();
      for (const profile of allProfiles || []) {
        if (!profile.twitch_username) continue;
        const key = profile.twitch_username.toLowerCase();
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(profile);
      }

      // Identificar duplicatas (1 com twitch_user_id, 1 sem)
      const foundDuplicates: DuplicateProfile[] = [];
      
      for (const [username, profiles] of grouped.entries()) {
        if (profiles.length < 2) continue;
        
        const withId = profiles.find(p => p.twitch_user_id);
        const withoutId = profiles.find(p => !p.twitch_user_id);
        
        if (!withId || !withoutId) continue;

        // Buscar saldos
        const { data: tickets } = await supabase
          .from('tickets')
          .select('user_id, tickets_atual')
          .in('user_id', [withId.id, withoutId.id]);

        const { data: rc } = await supabase
          .from('rubini_coins_balance')
          .select('user_id, saldo')
          .in('user_id', [withId.id, withoutId.id]);

        const ticketsNew = tickets?.find(t => t.user_id === withId.id)?.tickets_atual || 0;
        const ticketsOld = tickets?.find(t => t.user_id === withoutId.id)?.tickets_atual || 0;
        const rcNew = rc?.find(r => r.user_id === withId.id)?.saldo || 0;
        const rcOld = rc?.find(r => r.user_id === withoutId.id)?.saldo || 0;

        // Só adicionar se houver saldo no perfil antigo
        if (ticketsOld > 0 || rcOld > 0) {
          foundDuplicates.push({
            profile_with_twitch_id: withId.id,
            profile_without_twitch_id: withoutId.id,
            twitch_username: withId.twitch_username,
            twitch_user_id: withId.twitch_user_id,
            tickets_novo: ticketsNew,
            tickets_antigo: ticketsOld,
            rc_novo: rcNew,
            rc_antigo: rcOld
          });
        }
      }

      setDuplicates(foundDuplicates);
      toast.success(`Encontrados ${foundDuplicates.length} perfis com saldo fragmentado`);
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

    if (!confirm(`⚠️ Confirma consolidação de ${duplicates.length} perfis?\n\nIsso irá:\n- Somar saldos de Tickets e RC\n- Migrar históricos\n- Desativar perfis antigos`)) {
      return;
    }

    setLoading(true);
    const consolidationResults: any[] = [];

    for (const dup of duplicates) {
      try {
        console.log(`🔄 Consolidando ${dup.twitch_username}...`);

        // Usar a função RPC do Supabase para consolidar
        const { data, error } = await supabase.rpc('merge_duplicate_profiles', {
          p_keep_profile_id: dup.profile_with_twitch_id,
          p_remove_profile_id: dup.profile_without_twitch_id
        });

        if (error) throw error;

        consolidationResults.push({
          username: dup.twitch_username,
          success: true,
          tickets_added: dup.tickets_antigo,
          rc_added: dup.rc_antigo,
          new_totals: {
            tickets: dup.tickets_novo + dup.tickets_antigo,
            rc: dup.rc_novo + dup.rc_antigo
          }
        });

        console.log(`✅ ${dup.twitch_username} consolidado`);
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
      toast.success(`✅ ${successCount} perfis consolidados! Saldos atualizados.`);
      setDuplicates([]);
      // Recarregar para ver resultados
      setTimeout(() => findDuplicates(), 2000);
    } else {
      toast.error(`⚠️ ${successCount} sucessos, ${failCount} falhas`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>🔧 Consolidação Automática de Saldos</CardTitle>
        <CardDescription>
          Detecta perfis duplicados (com/sem twitch_user_id) e consolida saldos fragmentados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm">
            <strong>Problema identificado:</strong> Tickets aparecem no ranking mas não no saldo do usuário porque estão em perfis diferentes (antigo vs novo).
            Esta ferramenta consolida os perfis automaticamente.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button onClick={findDuplicates} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <PlayCircle className="mr-2 h-4 w-4" />
            1. Buscar Perfis Duplicados
          </Button>
          {duplicates.length > 0 && (
            <Button onClick={consolidateAll} disabled={loading} variant="default" className="bg-green-600 hover:bg-green-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" />
              2. Consolidar Todos ({duplicates.length})
            </Button>
          )}
        </div>

        {duplicates.length > 0 && (
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <strong>Perfis com saldo fragmentado: {duplicates.length}</strong>
              <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                <li>Saldos serão somados no perfil COM twitch_user_id</li>
                <li>Históricos migrados para o perfil correto</li>
                <li>Perfis antigos desativados (não deletados)</li>
                <li>Auditoria completa registrada</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {duplicates.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <h4 className="font-semibold sticky top-0 bg-background pb-2">Perfis a consolidar:</h4>
            {duplicates.map((dup, idx) => (
              <div key={idx} className="p-3 border rounded text-sm space-y-1">
                <div className="font-medium flex items-center gap-2">
                  <span className="text-primary">{dup.twitch_username}</span>
                  <span className="text-xs text-muted-foreground">({dup.twitch_user_id})</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Perfil Antigo:</span>
                    <br />{dup.tickets_antigo} 🎫 | {dup.rc_antigo} 💰
                  </div>
                  <div>
                    <span className="text-muted-foreground">Perfil Novo:</span>
                    <br />{dup.tickets_novo} 🎫 | {dup.rc_novo} 💰
                  </div>
                  <div className="font-semibold text-green-600 dark:text-green-400">
                    <span className="text-muted-foreground">Total:</span>
                    <br />{dup.tickets_novo + dup.tickets_antigo} 🎫 | {dup.rc_novo + dup.rc_antigo} 💰
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">Resultados da Consolidação:</h4>
            {results.map((result, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 border rounded text-sm">
                {result.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium">{result.username}</div>
                      <div className="text-xs text-muted-foreground">
                        +{result.tickets_added} tickets, +{result.rc_added} RC → 
                        Novo total: {result.new_totals.tickets} tickets, {result.new_totals.rc} RC
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium">{result.username}</div>
                      <div className="text-xs text-destructive">{result.error}</div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {duplicates.length === 0 && !loading && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Clique em "Buscar Perfis Duplicados" para iniciar
          </div>
        )}
      </CardContent>
    </Card>
  );
}
