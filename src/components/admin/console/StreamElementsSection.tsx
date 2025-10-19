import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StreamElementsMonitor } from "../StreamElementsMonitor";
import { StreamElementsLogsDialog } from "../StreamElementsLogsDialog";
import { Radio, FileText, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function StreamElementsSection() {
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-tibiatermo-logs');
      
      if (error) throw error;

      toast.success(
        `Backfill concluído: ${data.processados} eventos processados, ${data.duplicados} já existiam`
      );
      
      // Recarregar o monitor
      window.location.reload();
    } catch (error: any) {
      console.error('Erro no backfill:', error);
      toast.error('Erro ao processar backfill: ' + error.message);
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="space-y-6">
      <Accordion type="single" collapsible className="w-full" defaultValue="monitor">
        <AccordionItem value="monitor">
          <AccordionTrigger className="text-lg font-semibold">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Monitor de Sincronização
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <StreamElementsMonitor />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="config">
          <AccordionTrigger className="text-lg font-semibold">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Configuração e Status
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Status da Integração</CardTitle>
                <CardDescription>
                  Informações sobre a conexão com StreamElements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Status: <span className="text-green-600 font-semibold">Conectado</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Última verificação: {new Date().toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setShowLogsDialog(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Ver Logs Completos
                  </Button>
                  <Button 
                    onClick={handleBackfill} 
                    disabled={backfilling}
                    variant="outline"
                  >
                    <Database className={`h-4 w-4 mr-2 ${backfilling ? 'animate-spin' : ''}`} />
                    Backfill TibiaTermo Hoje
                  </Button>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="test">
          <AccordionTrigger className="text-lg font-semibold">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Teste Rápido
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Teste de Integração</CardTitle>
                <CardDescription>
                  Execute testes rápidos de conectividade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Funcionalidade em desenvolvimento
                </p>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <StreamElementsLogsDialog 
        open={showLogsDialog}
        onOpenChange={setShowLogsDialog}
      />
    </div>
  );
}
