import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DailyRewardTodaySection } from "@/components/admin/DailyRewardTodaySection";
import { StreakRulesSection } from "@/components/admin/StreakRulesSection";
import { DailyRewardSpecialConfigDialog } from "@/components/DailyRewardSpecialConfigDialog";
import { ManageDailyRewardsDialog } from "@/components/ManageDailyRewardsDialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DailyRewardsSection() {
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Configurações da Diária</CardTitle>
          <CardDescription>
            Configure recompensas e regras do sistema de diária
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setShowManageDialog(true)} variant="outline">
              Configurar Recompensas Diárias
            </Button>
            <Button onClick={() => setShowSpecialDialog(true)} variant="outline">
              Recompensas Especiais
            </Button>
          </div>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="today">
          <AccordionTrigger className="text-lg font-semibold">
            Participações de Hoje (Brasília)
          </AccordionTrigger>
          <AccordionContent>
            <DailyRewardTodaySection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="rules">
          <AccordionTrigger className="text-lg font-semibold">
            Regras e Configurações
          </AccordionTrigger>
          <AccordionContent>
            <StreakRulesSection />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <DailyRewardSpecialConfigDialog 
        open={showSpecialDialog}
        onOpenChange={setShowSpecialDialog}
      />
      <ManageDailyRewardsDialog
        open={showManageDialog}
        onOpenChange={setShowManageDialog}
      />
    </div>
  );
}
