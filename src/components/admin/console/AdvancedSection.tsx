import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MaintenanceSection } from "@/components/admin/MaintenanceSection";
import { RankingDisplaySection } from "@/components/admin/RankingDisplaySection";
import { PromotionalBarConfig } from "@/components/admin/PromotionalBarConfig";
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
import { AlertTriangle } from "lucide-react";

export function AdvancedSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <CardTitle>Operações Avançadas</CardTitle>
          </div>
          <CardDescription>
            Configurações e ações que devem ser usadas com cuidado
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

        <AccordionItem value="dangerous">
          <AccordionTrigger className="text-lg font-semibold text-red-600">
            Operações Críticas
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Ações Irreversíveis</CardTitle>
                <CardDescription>
                  Estas ações não podem ser desfeitas. Use com extremo cuidado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      Limpar Todo Histórico
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação irá APAGAR PERMANENTEMENTE todo o histórico do sistema.
                        Esta operação não pode ser desfeita.
                        <br /><br />
                        Digite <strong>CONFIRMAR</strong> para prosseguir.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => {/* Implementar com confirmação dupla */}}
                      >
                        Executar
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
