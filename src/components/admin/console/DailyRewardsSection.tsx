import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DailyRewardTodaySection } from "../DailyRewardTodaySection";
import { StreakRulesSection } from "../StreakRulesSection";
import { DailyRewardSpecialConfigDialog } from "../../DailyRewardSpecialConfigDialog";
import { ManageDailyRewardsDialog } from "../../ManageDailyRewardsDialog";
import { Settings, Gift } from "lucide-react";

export function DailyRewardsSection() {
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Recompensas Diárias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => setShowManageDialog(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configurar Recompensas Diárias
            </Button>
            <Button onClick={() => setShowSpecialDialog(true)} variant="outline">
              <Gift className="h-4 w-4 mr-2" />
              Recompensas Especiais
            </Button>
          </div>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full" defaultValue="today">
        <AccordionItem value="today">
          <AccordionTrigger className="text-lg font-semibold">
            Participações de Hoje
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
