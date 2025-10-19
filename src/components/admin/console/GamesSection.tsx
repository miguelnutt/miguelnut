import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TibiaTermoAdminPanel } from "@/components/admin/TibiaTermoAdminPanel";
import { Gamepad2 } from "lucide-react";

export function GamesSection() {
  return (
    <div className="space-y-6">
      <Accordion type="single" collapsible className="w-full" defaultValue="tibiatermo">
        <AccordionItem value="roletas">
          <AccordionTrigger className="text-lg font-semibold">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              Roletas
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Roletas</CardTitle>
                <CardDescription>
                  Configurações e histórico das roletas disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  As roletas podem ser gerenciadas através da página de Wheels (/wheels)
                </p>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tibiatermo">
          <AccordionTrigger className="text-lg font-semibold">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              TibiaTermo
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <TibiaTermoAdminPanel />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
