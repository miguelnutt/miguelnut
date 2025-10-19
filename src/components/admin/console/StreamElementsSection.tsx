import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StreamElementsMonitor } from "@/components/admin/StreamElementsMonitor";
import { StreamElementsLogsDialog } from "@/components/admin/StreamElementsLogsDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function StreamElementsSection() {
  const [showLogsDialog, setShowLogsDialog] = useState(false);

  return (
    <div className="space-y-6">
      <Accordion type="single" collapsible className="w-full" defaultValue="monitor">
        <AccordionItem value="monitor">
          <AccordionTrigger className="text-lg font-semibold">
            Monitor de Sincronização
          </AccordionTrigger>
          <AccordionContent>
            <StreamElementsMonitor />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="config">
          <AccordionTrigger className="text-lg font-semibold">
            Configuração e Status
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Configuração StreamElements</CardTitle>
                <CardDescription>
                  Informações sobre a integração com StreamElements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Status da Integração</p>
                    <p className="text-sm text-muted-foreground">Operacional</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Última Verificação</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date().toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Button onClick={() => setShowLogsDialog(true)} variant="outline">
                    Ver Logs Detalhados
                  </Button>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="test">
          <AccordionTrigger className="text-lg font-semibold">
            Teste Rápido
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Teste de Sincronização</CardTitle>
                <CardDescription>
                  Simule um crédito de teste para verificar a integração
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Em desenvolvimento. Em breve você poderá testar o fluxo completo de crédito.
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
