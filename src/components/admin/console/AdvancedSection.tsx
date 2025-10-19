import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MaintenanceSection } from "../MaintenanceSection";
import { RankingDisplaySection } from "../RankingDisplaySection";
import { PromotionalBarConfig } from "../PromotionalBarConfig";
import { Settings, AlertTriangle } from "lucide-react";

export function AdvancedSection() {
  const [confirmText, setConfirmText] = useState("");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Operações Avançadas
          </CardTitle>
          <CardDescription>
            Configurações e operações que requerem atenção especial
          </CardDescription>
        </CardHeader>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="maintenance">
          <AccordionTrigger className="text-lg font-semibold">
            Manutenção e Limpeza
          </AccordionTrigger>
          <AccordionContent>
            <MaintenanceSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ranking">
          <AccordionTrigger className="text-lg font-semibold">
            Configuração de Rankings
          </AccordionTrigger>
          <AccordionContent>
            <RankingDisplaySection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="promotional">
          <AccordionTrigger className="text-lg font-semibold">
            Barra Promocional
          </AccordionTrigger>
          <AccordionContent>
            <PromotionalBarConfig />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="critical">
          <AccordionTrigger className="text-lg font-semibold text-red-600">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Operações Críticas
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card className="border-red-500">
              <CardHeader>
                <CardTitle className="text-red-600">⚠️ Zona de Perigo</CardTitle>
                <CardDescription>
                  Estas operações são irreversíveis e podem afetar dados de produção
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      Limpar Todo Histórico (IRREVERSÍVEL)
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação NÃO pode ser desfeita. Isso irá permanentemente deletar
                        todo o histórico e remover os dados dos servidores.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600"
                        disabled={confirmText !== "CONFIRMAR"}
                      >
                        Confirmar Exclusão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
