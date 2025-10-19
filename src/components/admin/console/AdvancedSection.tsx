import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RankingDisplaySection } from "../RankingDisplaySection";
import { PromotionalBarConfig } from "../PromotionalBarConfig";
import { Settings } from "lucide-react";

export function AdvancedSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações Avançadas
          </CardTitle>
          <CardDescription>
            Configurações de sistema e exibição
          </CardDescription>
        </CardHeader>
      </Card>

      <Accordion type="single" collapsible className="w-full">
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
      </Accordion>
    </div>
  );
}
